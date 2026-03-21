"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "myflix-offline-downloads-v1";
const CACHE_NAME = "popflix-offline-media-v1";
export const OFFLINE_DOWNLOAD_CHANGE_EVENT = "myflix-offline-downloads-change";
const DOWNLOAD_QUALITY_ORDER = ["480", "720", "360", "1080", "4k", "unknown"] as const;

type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "unsupported";

type StreamData = {
  type: "hls" | "file";
  playlist?: string;
  qualities?: Record<string, { type: string; url: string }>;
  headers?: Record<string, string>;
  preferredHeaders?: Record<string, string>;
  captions?: Array<{ language: string; url: string; type: string }>;
  flags?: string[];
};

export type OfflineMediaRequest = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  imdbId?: string | null;
  releaseYear?: number | null;
  seasonNumber?: number | null;
  seasonTmdbId?: string | null;
  seasonTitle?: string | null;
  episodeNumber?: number | null;
  episodeTmdbId?: string | null;
  episodeTitle?: string | null;
};

export type OfflineDownloadRecord = {
  key: string;
  downloadId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeTitle?: string | null;
  status: DownloadStatus;
  progressPct: number;
  reason?: string | null;
  playback: StreamData | null;
  cachedUrls: string[];
  updatedAt: string;
};

const activeDownloads = new Map<string, Promise<OfflineDownloadRecord>>();

export function isOfflineDownloadSupported() {
  return (
    typeof window !== "undefined" &&
    "caches" in window &&
    "serviceWorker" in navigator &&
    typeof window.localStorage !== "undefined"
  );
}

export function buildOfflineDownloadKey(media: Pick<OfflineMediaRequest, "tmdbId" | "mediaType" | "seasonNumber" | "episodeNumber">) {
  if (media.mediaType === "movie") {
    return `movie:${media.tmdbId}`;
  }

  return `tv:${media.tmdbId}:s${media.seasonNumber ?? 0}:e${media.episodeNumber ?? 0}`;
}

export function getOfflineDownload(media: Pick<OfflineMediaRequest, "tmdbId" | "mediaType" | "seasonNumber" | "episodeNumber">) {
  const downloads = readDownloadMap();
  return downloads[buildOfflineDownloadKey(media)] ?? null;
}

export function getOfflinePlayback(media: Pick<OfflineMediaRequest, "tmdbId" | "mediaType" | "seasonNumber" | "episodeNumber">) {
  const record = getOfflineDownload(media);
  return record?.status === "completed" && record.playback ? record.playback : null;
}

export function useOfflineDownloadStatus(
  media: Pick<OfflineMediaRequest, "tmdbId" | "mediaType" | "seasonNumber" | "episodeNumber"> | null
) {
  const [record, setRecord] = useState<OfflineDownloadRecord | null>(() =>
    media ? getOfflineDownload(media) : null
  );

  useEffect(() => {
    if (!media) {
      setRecord(null);
      return;
    }

    const sync = () => {
      setRecord(getOfflineDownload(media));
    };

    sync();
    return subscribeOfflineDownloads(sync);
  }, [media?.episodeNumber, media?.mediaType, media?.seasonNumber, media?.tmdbId]);

  return record;
}

export async function startOfflineDownload(media: OfflineMediaRequest) {
  const key = buildOfflineDownloadKey(media);
  const existing = activeDownloads.get(key);
  if (existing) return existing;

  const work = performOfflineDownload(media).finally(() => {
    activeDownloads.delete(key);
  });
  activeDownloads.set(key, work);
  return work;
}

export async function removeOfflineDownload(media: Pick<OfflineMediaRequest, "tmdbId" | "mediaType" | "seasonNumber" | "episodeNumber">) {
  const key = buildOfflineDownloadKey(media);
  const record = getOfflineDownload(media);
  if (!record) return;

  const cache = await caches.open(CACHE_NAME);
  await Promise.all(record.cachedUrls.map((url) => cache.delete(url)));
  updateStoredRecord(key, null);

  await fetch("/api/downloads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tmdbId: record.tmdbId,
      mediaType: record.mediaType,
      seasonNumber: record.seasonNumber ?? null,
      episodeNumber: record.episodeNumber ?? null,
    }),
  }).catch(() => {});
}

async function performOfflineDownload(media: OfflineMediaRequest) {
  const key = buildOfflineDownloadKey(media);
  const downloadId = crypto.randomUUID();

  let record: OfflineDownloadRecord = {
    key,
    downloadId,
    tmdbId: media.tmdbId,
    mediaType: media.mediaType,
    title: media.title,
    posterPath: media.posterPath ?? null,
    backdropPath: media.backdropPath ?? null,
    seasonNumber: media.seasonNumber ?? null,
    episodeNumber: media.episodeNumber ?? null,
    episodeTitle: media.episodeTitle ?? null,
    status: "queued",
    progressPct: 0,
    reason: null,
    playback: null,
    cachedUrls: [],
    updatedAt: new Date().toISOString(),
  };

  updateStoredRecord(key, record);
  await syncServerDownload(record);

  if (!isOfflineDownloadSupported()) {
    record = {
      ...record,
      status: "unsupported",
      reason: "Offline playback is not supported in this browser yet.",
      updatedAt: new Date().toISOString(),
    };
    updateStoredRecord(key, record);
    await syncServerDownload(record);
    return record;
  }

  try {
    await ensureServiceWorkerReady();

    record = { ...record, status: "downloading", progressPct: 2, updatedAt: new Date().toISOString() };
    updateStoredRecord(key, record);
    await syncServerDownload(record);

    const stream = await resolveStreamForDownload(media);
    const packaged = await packageStreamForOffline(stream, media, downloadId, (progressPct, cachedUrls) => {
      record = {
        ...record,
        status: "downloading",
        progressPct,
        cachedUrls,
        updatedAt: new Date().toISOString(),
      };
      updateStoredRecord(key, record);
      void syncServerDownload(record);
    });

    record = {
      ...record,
      status: "completed",
      progressPct: 100,
      reason: null,
      playback: packaged.playback,
      cachedUrls: packaged.cachedUrls,
      updatedAt: new Date().toISOString(),
    };
    updateStoredRecord(key, record);
    await syncServerDownload(record);
    return record;
  } catch (error) {
    const current = getOfflineDownload(media) ?? record;
    if (current.cachedUrls.length) {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(current.cachedUrls.map((url) => cache.delete(url)));
    }

    record = {
      ...record,
      status: "failed",
      progressPct: 0,
      playback: null,
      cachedUrls: [],
      reason: error instanceof Error ? error.message : "Download failed.",
      updatedAt: new Date().toISOString(),
    };
    updateStoredRecord(key, record);
    await syncServerDownload(record);
    return record;
  }
}

async function packageStreamForOffline(
  stream: StreamData,
  media: OfflineMediaRequest,
  downloadId: string,
  onProgress: (progressPct: number, cachedUrls: string[]) => void
) {
  const cachedUrls: string[] = [];

  if (stream.type === "file" && stream.qualities) {
    const packaged = await packageFileStream(stream, downloadId, cachedUrls, onProgress);
    return { playback: { ...packaged, flags: [...(stream.flags ?? []), "offline"] }, cachedUrls };
  }

  if (stream.type === "hls" && stream.playlist) {
    const packaged = await packageHlsStream(stream, media, downloadId, cachedUrls, onProgress);
    return { playback: { ...packaged, flags: [...(stream.flags ?? []), "offline"] }, cachedUrls };
  }

  throw new Error("This source cannot be downloaded yet.");
}

async function packageFileStream(
  stream: StreamData,
  downloadId: string,
  cachedUrls: string[],
  onProgress: (progressPct: number, cachedUrls: string[]) => void
) {
  const headers = collectForwardHeaders(stream);
  const qualityLabel = pickPreferredQuality(stream.qualities ?? {});
  const selected = stream.qualities?.[qualityLabel];
  if (!selected) {
    throw new Error("No downloadable file stream was found.");
  }

  const videoUrl = buildOfflineAssetUrl(downloadId, `video-${qualityLabel}${inferExtension(selected.url, ".mp4")}`);
  const videoBlob = await fetchBlobWithProgress(
    createFetchUrl(selected.url, "mp4", headers),
    (fraction) => {
      onProgress(Math.max(5, Math.min(92, Math.round(fraction * 90))), cachedUrls);
    }
  );
  await putCachedBlob(videoUrl, videoBlob.blob, videoBlob.contentType);
  cachedUrls.push(videoUrl);
  onProgress(92, cachedUrls);

  const captions = await cacheCaptions(
    stream.captions ?? [],
    downloadId,
    cachedUrls,
    onProgress,
    92,
    headers
  );

  return {
    type: "file" as const,
    qualities: {
      [qualityLabel]: {
        type: selected.type,
        url: videoUrl,
      },
    },
    captions,
  };
}

async function packageHlsStream(
  stream: StreamData,
  media: OfflineMediaRequest,
  downloadId: string,
  cachedUrls: string[],
  onProgress: (progressPct: number, cachedUrls: string[]) => void
) {
  const headers = collectForwardHeaders(stream);
  const selectedQuality = pickPreferredQuality(stream.qualities ?? {});
  const selectedEntry = stream.qualities?.[selectedQuality];

  if (selectedEntry && !looksLikePlaylist(selectedEntry.url, selectedEntry.type)) {
    return packageFileStream(
      {
        ...stream,
        type: "file",
        qualities: { [selectedQuality]: selectedEntry },
      },
      downloadId,
      cachedUrls,
      onProgress
    );
  }

  let playlistUrl = selectedEntry?.url ?? stream.playlist;
  if (!playlistUrl) {
    throw new Error("No playlist was available for offline playback.");
  }
  let playlistText = await fetchTextContent(createFetchUrl(playlistUrl, "hls", headers));

  if (isMasterPlaylist(playlistText)) {
    const variant = pickVariantFromMaster(playlistText, playlistUrl);
    playlistUrl = variant.url;
    playlistText = await fetchTextContent(createFetchUrl(playlistUrl, "hls", headers));
  }

  const resources = extractPlaylistResources(playlistText, playlistUrl);
  const totalResources = Math.max(1, resources.length + (stream.captions?.length ?? 0));
  let completedResources = 0;
  const rewrittenLines: string[] = [];

  for (const line of playlistText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      rewrittenLines.push(line);
      continue;
    }

    if (!trimmed.startsWith("#")) {
      const resolved = resolveUrl(playlistUrl, trimmed);
      const offlineUrl = buildOfflineAssetUrl(
        downloadId,
        `segment-${completedResources}${inferExtension(resolved, ".bin")}`
      );
      const blobResult = await fetchBlobWithProgress(createFetchUrl(resolved, "mp4", headers));
      await putCachedBlob(offlineUrl, blobResult.blob, blobResult.contentType);
      cachedUrls.push(offlineUrl);
      completedResources += 1;
      onProgress(Math.round((completedResources / totalResources) * 88) + 5, cachedUrls);
      rewrittenLines.push(offlineUrl);
      continue;
    }

    if (!trimmed.includes('URI="')) {
      rewrittenLines.push(line);
      continue;
    }

    let nextLine = line;
    const matches = [...line.matchAll(/URI="([^"]+)"/g)];
    for (const match of matches) {
      const resolved = resolveUrl(playlistUrl, match[1]);
      const offlineUrl = buildOfflineAssetUrl(
        downloadId,
        `asset-${completedResources}${inferExtension(resolved, ".bin")}`
      );
      const blobResult = await fetchBlobWithProgress(createFetchUrl(resolved, "mp4", headers));
      await putCachedBlob(offlineUrl, blobResult.blob, blobResult.contentType);
      cachedUrls.push(offlineUrl);
      nextLine = nextLine.replace(match[1], offlineUrl);
      completedResources += 1;
      onProgress(Math.round((completedResources / totalResources) * 88) + 5, cachedUrls);
    }
    rewrittenLines.push(nextLine);
  }

  const captions = await cacheCaptions(
    stream.captions ?? [],
    downloadId,
    cachedUrls,
    () => {
      completedResources += 1;
      onProgress(Math.round((completedResources / totalResources) * 88) + 5, cachedUrls);
    },
    90,
    headers
  );

  const offlinePlaylistUrl = buildOfflineAssetUrl(downloadId, media.mediaType === "movie" ? "movie.m3u8" : `episode-s${media.seasonNumber ?? 0}-e${media.episodeNumber ?? 0}.m3u8`);
  await putCachedText(
    offlinePlaylistUrl,
    rewrittenLines.join("\n"),
    "application/vnd.apple.mpegurl"
  );
  cachedUrls.push(offlinePlaylistUrl);
  onProgress(95, cachedUrls);

  return {
    type: "hls" as const,
    playlist: offlinePlaylistUrl,
    captions,
  };
}

async function cacheCaptions(
  captions: Array<{ language: string; url: string; type: string }>,
  downloadId: string,
  cachedUrls: string[],
  onProgress: ((progressPct: number, cachedUrls: string[]) => void) | (() => void),
  baseProgress: number,
  headers: Record<string, string>
) {
  const cachedCaptions: Array<{ language: string; url: string; type: string }> = [];

  for (const [index, caption] of captions.entries()) {
    const offlineUrl = buildOfflineAssetUrl(
      downloadId,
      `caption-${index}${inferExtension(caption.url, ".vtt")}`
    );
    const blobResult = await fetchBlobWithProgress(createFetchUrl(caption.url, undefined, headers));
    await putCachedBlob(offlineUrl, blobResult.blob, blobResult.contentType ?? caption.type);
    cachedUrls.push(offlineUrl);
    cachedCaptions.push({
      language: caption.language,
      type: caption.type,
      url: offlineUrl,
    });

    if (onProgress.length >= 2) {
      (onProgress as (progressPct: number, cachedUrls: string[]) => void)(
        Math.min(98, baseProgress + Math.round(((index + 1) / Math.max(1, captions.length)) * 8)),
        cachedUrls
      );
    } else {
      (onProgress as () => void)();
    }
  }

  return cachedCaptions;
}

async function resolveStreamForDownload(media: OfflineMediaRequest) {
  const payload =
    media.mediaType === "movie"
      ? {
          type: "movie" as const,
          title: media.title,
          releaseYear: media.releaseYear ?? 0,
          tmdbId: String(media.tmdbId),
          imdbId: media.imdbId ?? undefined,
        }
      : {
          type: "show" as const,
          title: media.title,
          releaseYear: media.releaseYear ?? 0,
          tmdbId: String(media.tmdbId),
          imdbId: media.imdbId ?? undefined,
          season: {
            number: media.seasonNumber ?? 1,
            tmdbId: media.seasonTmdbId ?? String(media.seasonNumber ?? 1),
            title: media.seasonTitle ?? `Season ${media.seasonNumber ?? 1}`,
          },
          episode: {
            number: media.episodeNumber ?? 1,
            tmdbId: media.episodeTmdbId ?? String(media.episodeNumber ?? 1),
          },
        };

  const response = await fetch("/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error("Could not start the download.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
        continue;
      }

      if (!line.startsWith("data: ") || !eventType) continue;

      const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
      if (eventType === "result" && data.stream) {
        return data.stream as StreamData;
      }
      if (eventType === "error") {
        throw new Error((data.message as string) || "No downloadable source was found.");
      }

      eventType = "";
    }
  }

  throw new Error("No downloadable source was found.");
}

async function ensureServiceWorkerReady() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) {
    await navigator.serviceWorker.register("/sw.js");
  }
  await navigator.serviceWorker.ready;
}

async function fetchTextContent(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not fetch the playlist for offline playback.");
  }
  return response.text();
}

async function fetchBlobWithProgress(url: string, onProgress?: (fraction: number) => void) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not fetch a media segment for offline playback.");
  }

  const contentType = response.headers.get("content-type");
  const totalBytes = Number(response.headers.get("content-length") ?? 0);
  if (!response.body || totalBytes <= 0) {
    const blob = await response.blob();
    onProgress?.(1);
    return { blob, contentType };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(Math.min(1, received / totalBytes));
  }

  return {
    blob: new Blob(
      chunks.map((chunk) => chunk.slice().buffer as ArrayBuffer),
      { type: contentType ?? undefined }
    ),
    contentType,
  };
}

async function putCachedBlob(url: string, blob: Blob, contentType?: string | null) {
  const cache = await caches.open(CACHE_NAME);
  const headers = new Headers();
  if (contentType) {
    headers.set("content-type", contentType);
  }
  await cache.put(url, new Response(blob, { headers }));
}

async function putCachedText(url: string, text: string, contentType: string) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    url,
    new Response(text, {
      headers: {
        "content-type": contentType,
      },
    })
  );
}

async function syncServerDownload(record: OfflineDownloadRecord) {
  await fetch("/api/downloads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tmdbId: record.tmdbId,
      mediaType: record.mediaType,
      title: record.title,
      posterPath: record.posterPath ?? null,
      seasonNumber: record.seasonNumber ?? null,
      episodeNumber: record.episodeNumber ?? null,
      episodeTitle: record.episodeTitle ?? null,
      status: record.status,
      progressPct: record.progressPct,
      reason: record.reason ?? null,
    }),
  }).catch(() => {});
}

function subscribeOfflineDownloads(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const onChange = () => callback();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };

  window.addEventListener(OFFLINE_DOWNLOAD_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(OFFLINE_DOWNLOAD_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_DOWNLOAD_CHANGE_EVENT));
}

function readDownloadMap() {
  if (typeof window === "undefined") return {} as Record<string, OfflineDownloadRecord>;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, OfflineDownloadRecord>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, OfflineDownloadRecord>;
  }
}

function updateStoredRecord(key: string, record: OfflineDownloadRecord | null) {
  if (typeof window === "undefined") return;
  const current = readDownloadMap();
  if (record) {
    current[key] = record;
  } else {
    delete current[key];
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  emitChange();
}

function collectForwardHeaders(stream: StreamData) {
  return {
    ...(stream.preferredHeaders ?? {}),
    ...(stream.headers ?? {}),
  };
}

function pickPreferredQuality(qualities: Record<string, { type: string; url: string }>) {
  for (const quality of DOWNLOAD_QUALITY_ORDER) {
    if (qualities[quality]) return quality;
  }

  return Object.keys(qualities)[0] ?? "unknown";
}

function createFetchUrl(
  url: string,
  type?: "hls" | "mp4",
  headers?: Record<string, string>
) {
  if (!shouldUseProxy(url, headers)) return url;

  const payload = {
    url,
    type,
    headers: headers ?? {},
  };

  return `/api/proxy?payload=${encodePayload(payload)}`;
}

function shouldUseProxy(url: string, headers?: Record<string, string>) {
  if (headers && Object.keys(headers).length > 0) return true;
  if (typeof window === "undefined") return false;

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function encodePayload(payload: { url: string; type?: string; headers: Record<string, string> }) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildOfflineAssetUrl(downloadId: string, fileName: string) {
  return `/offline-media/${downloadId}/${fileName}`;
}

function inferExtension(url: string, fallback: string) {
  try {
    const pathname = new URL(url, "https://offline.local").pathname;
    const match = pathname.match(/\.[a-z0-9]+$/i);
    return match?.[0] ?? fallback;
  } catch {
    return fallback;
  }
}

function looksLikePlaylist(url: string, type?: string) {
  return (
    /\.m3u8($|[?#])/i.test(url) ||
    (type?.toLowerCase().includes("mpegurl") ?? false)
  );
}

function isMasterPlaylist(text: string) {
  return text.includes("#EXT-X-STREAM-INF");
}

function pickVariantFromMaster(playlistText: string, baseUrl: string) {
  const lines = playlistText.split(/\r?\n/);
  const candidates: Array<{ score: number; url: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line?.startsWith("#EXT-X-STREAM-INF")) continue;
    const nextLine = lines[index + 1]?.trim();
    if (!nextLine || nextLine.startsWith("#")) continue;

    const resolutionMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
    const height = resolutionMatch ? Number(resolutionMatch[1]) : 0;
    const score = Math.abs(height - 480);
    candidates.push({
      score,
      url: resolveUrl(baseUrl, nextLine),
    });
  }

  if (!candidates.length) {
    throw new Error("Could not find a playable variant for offline playback.");
  }

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0];
}

function extractPlaylistResources(playlistText: string, baseUrl: string) {
  const resources: string[] = [];
  for (const line of playlistText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!trimmed.startsWith("#")) {
      resources.push(resolveUrl(baseUrl, trimmed));
      continue;
    }

    for (const match of line.matchAll(/URI="([^"]+)"/g)) {
      resources.push(resolveUrl(baseUrl, match[1]));
    }
  }
  return resources;
}

function resolveUrl(baseUrl: string, value: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}
