import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { appendNetworkDebug } from "@/lib/network-debug-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// LRU cache for immutable segments & encryption keys
// ---------------------------------------------------------------------------
type CacheEntry = {
  body: ArrayBuffer;
  status: number;
  headers: Record<string, string>;
  cachedAt: number;
};

const SEGMENT_CACHE_MAX = 256;
const SEGMENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const PLAYLIST_CACHE_MAX = 64;
const PLAYLIST_CACHE_TTL_MS = 4_000; // 4 s — media playlists refresh often

const segmentCache = new Map<string, CacheEntry>();
const playlistCache = new Map<string, { body: string; headers: Record<string, string>; status: number; cachedAt: number }>();

// Peek-buffer size for HLS detection (avoid buffering entire response)
const HLS_PEEK_BYTES = 4096;

function evictLru<T>(map: Map<string, T>, max: number) {
  if (map.size <= max) return;
  const first = map.keys().next().value;
  if (first !== undefined) map.delete(first);
}

function touchCache<T>(map: Map<string, T>, key: string, entry: T) {
  map.delete(key); // remove so re-insert puts it at the end
  map.set(key, entry);
  evictLru(map, map === (segmentCache as unknown as Map<string, T>) ? SEGMENT_CACHE_MAX : PLAYLIST_CACHE_MAX);
}

// ---------------------------------------------------------------------------
// Header maps
// ---------------------------------------------------------------------------
const HEADER_MAP: Record<string, string> = {
  "x-cookie": "cookie",
  "x-referer": "referer",
  "x-origin": "origin",
  "x-user-agent": "user-agent",
  "user-agent": "user-agent",
  "x-x-real-ip": "x-real-ip",
  range: "range",
  accept: "accept",
  "accept-language": "accept-language",
  "cache-control": "cache-control",
  "if-none-match": "if-none-match",
  "if-modified-since": "if-modified-since",
};

const RESPONSE_HEADER_ALLOWLIST = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
] as const;

// Patterns for cacheable segment extensions
const IMMUTABLE_SEGMENT_RE =
  /\.(ts|m4s|m4v|m4a|aac|mp3|key|jpg|jpeg|png|gif|webp)($|[?#])/i;

function isCacheableSegment(url: string): boolean {
  return IMMUTABLE_SEGMENT_RE.test(url);
}

function isHlsUrl(url: string): boolean {
  return /\.m3u8($|[?#])/i.test(url);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  return handleProxy(req);
}

export async function HEAD(req: NextRequest) {
  return handleProxy(req);
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}

// ---------------------------------------------------------------------------
// Main proxy handler
// ---------------------------------------------------------------------------
async function handleProxy(req: NextRequest) {
  const payloadParam = req.nextUrl.searchParams.get("payload");
  const payload = decodePayload(payloadParam);
  const destination = payload?.url ?? req.nextUrl.searchParams.get("destination");
  const debugSessionId = payload?.debugSessionId ?? null;
  if (!destination) {
    return NextResponse.json({ error: "Missing destination" }, { status: 400 });
  }

  try {
    const startedAt = Date.now();
    const headers: Record<string, string> = normalizeHeaderRecord(payload?.headers ?? {});
    req.headers.forEach((value, key) => {
      const mapped = HEADER_MAP[key.toLowerCase()];
      if (mapped) {
        headers[mapped] = value;
      }
    });

    const method = req.method === "HEAD" ? "HEAD" : req.method;
    const body = method === "POST" ? await req.text() : undefined;

    const wantsHls = payload?.type === "hls" || isHlsUrl(destination);
    const cacheable = method === "GET" && isCacheableSegment(destination);
    const cacheKey = destination;

    // ---- Check segment cache ----
    if (cacheable) {
      const cached = segmentCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < SEGMENT_CACHE_TTL_MS) {
        touchCache(segmentCache, cacheKey, cached);
        const resHeaders = new Headers(cached.headers);
        resHeaders.set("X-Proxy-Cache", "HIT");
        deferLog(debugSessionId, {
          sessionId: debugSessionId,
          method,
          destination,
          status: cached.status,
          durationMs: Date.now() - startedAt,
          requestHeaders: sanitizeHeaders(headers),
          note: "segment-cache-hit",
        });
        return new NextResponse(cached.body, { status: cached.status, headers: resHeaders });
      }
    }

    // ---- Check playlist cache ----
    if (wantsHls) {
      const cached = playlistCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < PLAYLIST_CACHE_TTL_MS) {
        touchCache(playlistCache, cacheKey, cached);
        const resHeaders = new Headers(cached.headers);
        resHeaders.set("X-Proxy-Cache", "HIT");
        deferLog(debugSessionId, {
          sessionId: debugSessionId,
          method,
          destination,
          status: cached.status,
          durationMs: Date.now() - startedAt,
          requestHeaders: sanitizeHeaders(headers),
          note: "playlist-cache-hit",
        });
        return new NextResponse(cached.body, { status: cached.status, headers: resHeaders });
      }
    }

    // ---- Upstream fetch — allow runtime caching for segments ----
    const response = await fetch(destination, {
      method,
      headers,
      body,
      redirect: "follow",
      ...(cacheable ? {} : { cache: "no-store" as const }),
    });

    // ---- HLS playlist path ----
    if (wantsHls || shouldRewriteHls(response, destination)) {
      // Peek at the first few KB to decide if this is actually a playlist,
      // avoiding buffering the full body for large non-playlist responses.
      const reader = response.body?.getReader();
      if (!reader) {
        return streamError(response, debugSessionId, startedAt, method, destination, headers);
      }

      const peekChunks: Uint8Array[] = [];
      let peekLen = 0;
      let done = false;

      while (peekLen < HLS_PEEK_BYTES) {
        const result = await reader.read();
        if (result.done) { done = true; break; }
        peekChunks.push(result.value);
        peekLen += result.value.byteLength;
      }

      const peekBuf = concatUint8Arrays(peekChunks, peekLen);
      const peekText = new TextDecoder("utf-8", { fatal: false }).decode(peekBuf);

      if (looksLikeHlsPlaylist(peekText, response, destination)) {
        // It is a playlist — read the rest
        const restChunks: Uint8Array[] = [peekBuf];
        let totalLen = peekLen;
        if (!done) {
          while (true) {
            const result = await reader.read();
            if (result.done) break;
            restChunks.push(result.value);
            totalLen += result.value.byteLength;
          }
        }
        const fullBuf = concatUint8Arrays(restChunks, totalLen);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(fullBuf);

        const playlistBaseUrl = response.url || destination;
        const playlist = rewriteHlsPlaylist(
          text,
          playlistBaseUrl,
          payload?.headers ?? {},
          payload?.debugSessionId
        );

        const resHeaderMap: Record<string, string> = {
          "content-type":
            response.headers.get("content-type") || "application/vnd.apple.mpegurl",
          "cache-control": "no-store, no-cache, must-revalidate",
          pragma: "no-cache",
          expires: "0",
          "X-Final-Destination": response.url,
          "X-Proxy-Cache": "MISS",
        };

        // Cache the rewritten playlist
        playlistCache.set(cacheKey, {
          body: playlist,
          headers: resHeaderMap,
          status: response.status,
          cachedAt: Date.now(),
        });
        evictLru(playlistCache, PLAYLIST_CACHE_MAX);

        deferLog(debugSessionId, {
          sessionId: debugSessionId,
          method,
          destination,
          finalUrl: response.url,
          status: response.status,
          durationMs: Date.now() - startedAt,
          requestHeaders: sanitizeHeaders(headers),
          responseHeaders: pickResponseHeaders(response.headers),
          contentType: response.headers.get("content-type"),
          note: "rewrote-hls-playlist",
          snippet: text.slice(0, 1200),
        });

        return new NextResponse(playlist, {
          status: response.status,
          headers: new Headers(resHeaderMap),
        });
      }

      // Not a playlist — reconstruct a stream from peek + remainder and stream through
      const reconstructed = reconstructStream(peekBuf, done ? null : reader);
      const resHeaders = buildResponseHeaders(response);
      resHeaders.set("X-Proxy-Cache", "MISS");

      deferLog(debugSessionId, {
        sessionId: debugSessionId,
        method,
        destination,
        finalUrl: response.url,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestHeaders: sanitizeHeaders(headers),
        responseHeaders: pickResponseHeaders(response.headers),
        contentType: response.headers.get("content-type"),
        note: "streamed-non-playlist",
      });

      return new NextResponse(method === "HEAD" ? null : createPassthroughStream(reconstructed), {
        status: response.status,
        headers: resHeaders,
      });
    }

    // ---- Cacheable segment path — buffer & cache ----
    if (cacheable && response.ok) {
      const buffer = await response.arrayBuffer();
      const resHeaders = buildResponseHeaders(response);
      const headerRecord: Record<string, string> = {};
      resHeaders.forEach((v, k) => { headerRecord[k] = v; });

      segmentCache.set(cacheKey, {
        body: buffer,
        status: response.status,
        headers: headerRecord,
        cachedAt: Date.now(),
      });
      evictLru(segmentCache, SEGMENT_CACHE_MAX);

      resHeaders.set("X-Proxy-Cache", "MISS");

      deferLog(debugSessionId, {
        sessionId: debugSessionId,
        method,
        destination,
        finalUrl: response.url,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestHeaders: sanitizeHeaders(headers),
        responseHeaders: pickResponseHeaders(response.headers),
        contentType: response.headers.get("content-type"),
        note: "segment-cached",
      });

      return new NextResponse(buffer, {
        status: response.status,
        headers: resHeaders,
      });
    }

    // ---- Default: stream through ----
    const resHeaders = buildResponseHeaders(response);

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      resHeaders.set("X-Set-Cookie", setCookie);
    }

    deferLog(debugSessionId, {
      sessionId: debugSessionId,
      method,
      destination,
      finalUrl: response.url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      requestHeaders: sanitizeHeaders(headers),
      responseHeaders: pickResponseHeaders(response.headers),
      contentType: response.headers.get("content-type"),
    });

    return new NextResponse(method === "HEAD" ? null : createPassthroughStream(response.body), {
      status: response.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    deferLog(debugSessionId, {
      sessionId: debugSessionId,
      method: req.method,
      destination,
      durationMs: 0,
      requestHeaders: sanitizeHeaders(payload?.headers ?? {}),
      error: message,
      note: "proxy-exception",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildResponseHeaders(response: Response): Headers {
  const resHeaders = new Headers({
    "X-Final-Destination": response.url,
  });
  for (const header of RESPONSE_HEADER_ALLOWLIST) {
    const value = response.headers.get(header);
    if (value) resHeaders.set(header, value);
  }
  return resHeaders;
}

function streamError(
  response: Response,
  debugSessionId: string | null,
  startedAt: number,
  method: string,
  destination: string,
  headers: Record<string, string>,
) {
  deferLog(debugSessionId, {
    sessionId: debugSessionId,
    method,
    destination,
    finalUrl: response.url,
    status: response.status,
    durationMs: Date.now() - startedAt,
    requestHeaders: sanitizeHeaders(headers),
    note: "no-readable-body",
  });
  return new NextResponse(null, { status: response.status, headers: buildResponseHeaders(response) });
}

function concatUint8Arrays(chunks: Uint8Array[], totalLen: number): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function reconstructStream(
  head: Uint8Array,
  remainingReader: ReadableStreamDefaultReader<Uint8Array> | null,
): ReadableStream<Uint8Array> {
  let sentHead = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sentHead) {
        sentHead = true;
        controller.enqueue(head);
        if (!remainingReader) {
          controller.close();
          return;
        }
        return;
      }
      if (!remainingReader) {
        controller.close();
        return;
      }
      const { done, value } = await remainingReader.read();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
  });
}

function createPassthroughStream(
  body: ReadableStream<Uint8Array> | null,
): ReadableStream<Uint8Array> | null {
  if (!body) return null;

  const reader = body.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } catch {
        // Ignore upstream cancellation errors.
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Fire-and-forget logging via Next.js after()
// ---------------------------------------------------------------------------
function deferLog(sessionId: string | null, params: LogParams) {
  if (!sessionId) return;
  after(async () => {
    await appendNetworkDebug({
      ts: new Date().toISOString(),
      kind: "proxy-request",
      source: "proxy",
      sessionId: params.sessionId,
      method: params.method,
      url: params.destination,
      finalUrl: params.finalUrl,
      status: params.status,
      durationMs: params.durationMs,
      requestHeaders: params.requestHeaders,
      responseHeaders: params.responseHeaders,
      contentType: params.contentType,
      note: params.note,
      error: params.error,
      snippet: params.snippet,
    });
  });
}

type LogParams = {
  sessionId: string | null;
  method: string;
  destination: string;
  finalUrl?: string;
  status?: number;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  contentType?: string | null;
  note?: string;
  error?: string;
  snippet?: string;
};

type ProxyPayload = {
  url: string;
  type?: "hls" | "mp4";
  headers?: Record<string, string>;
  debugSessionId?: string;
  options?: {
    depth?: number;
  };
};

function decodePayload(payloadParam: string | null): ProxyPayload | null {
  if (!payloadParam) return null;

  try {
    const decoded = Buffer.from(payloadParam, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as ProxyPayload;
    if (!payload?.url) return null;
    return payload;
  } catch {
    return null;
  }
}

function shouldRewriteHls(response: Response, destination: string) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return (
    contentType.includes("mpegurl") ||
    contentType.includes("application/x-mpegurl") ||
    contentType.includes("audio/mpegurl") ||
    destination.toLowerCase().includes(".m3u8")
  );
}

function looksLikeHlsPlaylist(
  body: string,
  response: Response,
  destination: string
) {
  const trimmed = body.trim();
  // Body content check ALWAYS takes priority — if it starts with HTML tags it's not HLS
  if (trimmed.startsWith("<") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }
  const bodyLooksLikeHls =
    trimmed.startsWith("#EXTM3U") ||
    trimmed.includes("#EXT-X-") ||
    trimmed.includes("#EXTINF:");
  if (!bodyLooksLikeHls) return false;
  return shouldRewriteHls(response, destination) || bodyLooksLikeHls;
}

function rewriteHlsPlaylist(
  playlist: string,
  destination: string,
  headers: Record<string, string>,
  debugSessionId?: string
) {
  const lines = playlist.split(/\r?\n/);
  const rewritten: string[] = [];
  let expectVariantPlaylist = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const rewrittenLine = rewriteHlsLine(
      line,
      destination,
      headers,
      expectVariantPlaylist,
      debugSessionId
    );
    rewritten.push(rewrittenLine);

    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
      expectVariantPlaylist = true;
      continue;
    }

    if (!trimmed.startsWith("#")) {
      expectVariantPlaylist = false;
    }
  }

  return rewritten.join("\n");
}

function rewriteHlsLine(
  line: string,
  destination: string,
  headers: Record<string, string>,
  expectVariantPlaylist = false,
  debugSessionId?: string
) {
  const trimmed = line.trim();
  if (!trimmed) return line;

  if (!trimmed.startsWith("#")) {
    const resolved = resolvePlaylistUrl(destination, trimmed);
    const entryType = expectVariantPlaylist ? "hls" : inferPlaylistEntryType(resolved);
    const effectiveHeaders = getForwardedHeadersForPlaylistEntry(resolved, headers);
    const shouldForceProxy = shouldForceProxyPlaylistEntry(resolved);
    if (
      shouldForceProxy ||
      Object.keys(effectiveHeaders).length > 0 ||
      entryType === "hls"
    ) {
      return createPayloadProxyUrl(
        resolved,
        effectiveHeaders,
        entryType,
        debugSessionId
      );
    }
    return resolved;
  }

  if (trimmed.includes('URI="')) {
    return line.replace(/URI="([^"]+)"/g, (_match, url) => {
      const resolved = resolvePlaylistUrl(destination, url);
      const effectiveHeaders = getForwardedHeadersForPlaylistEntry(resolved, headers);
      const shouldForceProxy = shouldForceProxyPlaylistEntry(resolved);
      if (isLikelyHlsPlaylistUrl(resolved)) {
        return `URI="${createPayloadProxyUrl(
          resolved,
          effectiveHeaders,
          "hls",
          debugSessionId
        )}"`;
      }
      if (shouldForceProxy || Object.keys(effectiveHeaders).length > 0) {
        return `URI="${createPayloadProxyUrl(
          resolved,
          effectiveHeaders,
          undefined,
          debugSessionId
        )}"`;
      }
      return `URI="${resolved}"`;
    });
  }

  return line;
}

function resolvePlaylistUrl(base: string, value: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function createPayloadProxyUrl(
  url: string,
  headers: Record<string, string>,
  type?: "hls" | "mp4",
  debugSessionId?: string
) {
  const payload: ProxyPayload = {
    url,
    headers,
    debugSessionId,
  };
  if (type) {
    payload.type = type;
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `/api/proxy?payload=${encoded}`;
}

function shouldForceProxyPlaylistEntry(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.has("headers") ||
      parsed.searchParams.has("preferredHeaders")
    );
  } catch {
    return false;
  }
}

function getForwardedHeadersForPlaylistEntry(
  url: string,
  inheritedHeaders: Record<string, string>
) {
  return normalizeHeaderRecord(inheritedHeaders);
}

function isLikelyHlsPlaylistUrl(url: string) {
  return /\.m3u8($|[?#])/i.test(url);
}

function inferPlaylistEntryType(url: string): "hls" | undefined {
  if (isLikelyHlsPlaylistUrl(url)) return "hls";

  const path = getPathname(url).toLowerCase();
  const mediaSegmentPattern =
    /\.(ts|m4s|m4v|mp4|m4a|aac|mp3|vtt|webvtt|jpg|jpeg|png|gif|webp|key)($|[?#])/i;

  if (mediaSegmentPattern.test(path)) {
    return undefined;
  }

  const extensionMatch = path.match(/\.([a-z0-9]+)($|[?#])/i);
  if (!extensionMatch) {
    return "hls";
  }

  return undefined;
}

function getPathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function sanitizeHeaders(headers: Record<string, string>) {
  const output = { ...headers };
  if (output.cookie) output.cookie = "[redacted]";
  return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeHeaderRecord(headers: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function pickResponseHeaders(headers: Headers) {
  const picked: Record<string, string> = {};
  for (const name of [
    "content-type",
    "content-length",
    "cache-control",
    "content-range",
    "accept-ranges",
  ]) {
    const value = headers.get(name);
    if (value) picked[name] = value;
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
}
