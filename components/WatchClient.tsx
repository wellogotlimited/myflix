"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  createDebugSessionId,
  enableNetworkDebugCapture,
  resetNetworkDebug,
} from "@/lib/network-debug-client";
import { useProfileSession } from "@/lib/profile-session";
import type { TMDBEpisode, TMDBSeason } from "@/lib/tmdb";
import VideoPlayer from "./player/VideoPlayer";
import ProviderStatus, { SourceStatus } from "./ProviderStatus";
import WatchErrorState from "./WatchErrorState";

interface MediaInfo {
  type: "movie" | "show";
  tmdbId: string;
  title: string;
  releaseYear: number;
  imdbId?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  season?: {
    number: number;
    tmdbId: string;
    title: string;
  };
  episode?: {
    number: number;
    tmdbId: string;
    title?: string;
    overview?: string;
  };
}

interface ShowNavigation {
  showId: string;
  imdbId?: string | null;
  type: string;
  seasons: TMDBSeason[];
  episodes: TMDBEpisode[];
  currentSeason: number;
  currentEpisode: number;
}

interface StreamResult {
  type: "hls" | "file";
  playlist?: string;
  qualities?: Record<string, { type: string; url: string }>;
  headers?: Record<string, string>;
  preferredHeaders?: Record<string, string>;
  captions?: Array<{ language: string; url: string; type: string }>;
  id: string;
  flags: string[];
}

export default function WatchClient({
  media,
  title,
  showNavigation,
}: {
  media: MediaInfo;
  title?: string;
  showNavigation?: ShowNavigation;
}) {
  const router = useRouter();
  const { profileId } = useProfileSession();
  const [devMode] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("myflix-dev-mode") === "true"
  );
  const [stream, setStream] = useState<StreamResult | null>(null);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const debugSessionIdRef = useRef<string | null>(null);
  const [activeMedia, setActiveMedia] = useState(media);
  const [activeShowNavigation, setActiveShowNavigation] = useState(showNavigation);
  const [resumePosition, setResumePosition] = useState<number | undefined>(undefined);
  const lastSaveRef = useRef(0);

  if (devMode && !debugSessionIdRef.current) {
    debugSessionIdRef.current = createDebugSessionId();
  }

  useEffect(() => {
    setActiveMedia(media);
    setActiveShowNavigation(showNavigation);
  }, [media, showNavigation]);

  useEffect(() => {
    if (!devMode || !debugSessionIdRef.current) return;

    void resetNetworkDebug(debugSessionIdRef.current);
    return enableNetworkDebugCapture(debugSessionIdRef.current);
  }, [devMode]);

  const mediaKey = useMemo(
    () =>
      activeMedia.type === "movie"
        ? `movie:${activeMedia.tmdbId}`
        : `show:${activeMedia.tmdbId}:s${activeMedia.season?.number ?? 0}:e${activeMedia.episode?.number ?? 0}`,
    [activeMedia]
  );

  const activeTitle = useMemo(
    () => (activeMedia.type === "movie" ? title : activeMedia.title),
    [activeMedia, title]
  );
  const activeSubtitle = useMemo(
    () =>
      activeMedia.type === "show" && activeMedia.season && activeMedia.episode
        ? `S${activeMedia.season.number} / E${activeMedia.episode.number}${activeMedia.episode.title ? ` - ${activeMedia.episode.title}` : ""}`
        : undefined,
    [activeMedia]
  );
  const scrape = useCallback(async (requestId: number, signal?: AbortSignal) => {
    setError(null);
    setStream(null);
    setSources([]);

    try {
      const scrapeMedia =
        activeMedia.type === "movie"
          ? {
              type: "movie" as const,
              title: activeMedia.title,
              releaseYear: activeMedia.releaseYear,
              tmdbId: activeMedia.tmdbId,
              imdbId: activeMedia.imdbId,
            }
          : {
              type: "show" as const,
              title: activeMedia.title,
              releaseYear: activeMedia.releaseYear,
              tmdbId: activeMedia.tmdbId,
              imdbId: activeMedia.imdbId,
              season: {
                number: activeMedia.season!.number,
                tmdbId: activeMedia.season!.tmdbId,
                title: activeMedia.season!.title,
              },
              episode: {
                number: activeMedia.episode!.number,
                tmdbId: activeMedia.episode!.tmdbId,
              },
            };

      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scrapeMedia),
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to scrape API");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            const data = JSON.parse(line.slice(6));
            handleEvent(requestId, eventType, data);
            eventType = "";
          }
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Scraping failed");
    }
  }, [activeMedia]);

  const startScrape = useCallback(() => {
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    void scrape(nextRequestId);
  }, [scrape]);

  const handleExitWatch = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }, [router]);

  const handleEpisodeSelect = useCallback(
    ({
      seasonNumber,
      episode,
      episodes,
    }: {
      seasonNumber: number;
      episode: TMDBEpisode;
      episodes: TMDBEpisode[];
    }) => {
      if (activeMedia.type !== "show" || !activeShowNavigation) return;

      const selectedSeason =
        activeShowNavigation.seasons.find(
          (season) => season.season_number === seasonNumber
        ) ?? null;

      if (!selectedSeason) return;

      setActiveMedia({
        ...activeMedia,
        season: {
          number: seasonNumber,
          tmdbId: String(selectedSeason.id),
          title: selectedSeason.name,
        },
        episode: {
          number: episode.episode_number,
          tmdbId: String(episode.id),
          title: episode.name,
          overview: episode.overview,
        },
      });

      setActiveShowNavigation({
        ...activeShowNavigation,
        currentSeason: seasonNumber,
        currentEpisode: episode.episode_number,
        episodes,
      });

      startTransition(() => {
        router.replace(
          `/watch/${activeShowNavigation.type}/${activeShowNavigation.showId}?season=${seasonNumber}&episode=${episode.episode_number}`,
          { scroll: false }
        );
      });
    },
    [activeMedia, activeShowNavigation, router]
  );

  function handleEvent(requestId: number, event: string, data: unknown) {
    if (requestId !== requestIdRef.current) return;

    const d = data as Record<string, unknown>;
    switch (event) {
      case "init": {
        const sourceIds = d.sourceIds as string[];
        setSources(sourceIds.map((id) => ({ id, status: "pending" })));
        break;
      }
      case "start": {
        const id = d.id as string;
        setSources((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: "running" } : s))
        );
        break;
      }
      case "update": {
        const id = d.id as string;
        const status = d.status as string;
        setSources((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status:
                    status === "success"
                      ? "success"
                      : status === "notfound"
                        ? "notfound"
                        : status === "failure"
                          ? "failure"
                          : s.status,
                }
              : s
          )
        );
        break;
      }
      case "discoverEmbeds": {
        const embeds = d.embeds as Array<{ id: string }>;
        setSources((prev) => [
          ...prev,
          ...embeds.map((e) => ({ id: e.id, status: "pending" as const })),
        ]);
        break;
      }
      case "result": {
        const nextStream = d.stream as StreamResult;
        setStream(nextStream);
        break;
      }
      case "error": {
        setError((d.message as string) || "No working sources found.");
        break;
      }
    }
  }

  useEffect(() => {
    if (!profileId) return;
    setResumePosition(undefined);

    const seasonParam = activeMedia.season?.number ?? null;
    const episodeParam = activeMedia.episode?.number ?? null;
    const params = new URLSearchParams({
      mediaType: activeMedia.type === "movie" ? "movie" : "tv",
      ...(seasonParam !== null ? { season: String(seasonParam) } : {}),
      ...(episodeParam !== null ? { episode: String(episodeParam) } : {}),
    });

    fetch(`/api/progress/${activeMedia.tmdbId}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.positionSec && data.positionSec > 30 && !data.completed) {
          setResumePosition(data.positionSec);
        }
      })
      .catch(() => {});
  }, [mediaKey, profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProgressUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (!profileId) return;
      if (!duration || duration < 10) return;
      const now = Date.now();
      if (now - lastSaveRef.current < 15_000) return;
      lastSaveRef.current = now;

      fetch(`/api/progress/${activeMedia.tmdbId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType: activeMedia.type === "movie" ? "movie" : "tv",
          title: activeMedia.title,
          posterPath: activeMedia.posterPath ?? null,
          backdropPath: activeMedia.backdropPath ?? null,
          seasonNumber: activeMedia.season?.number ?? null,
          episodeNumber: activeMedia.episode?.number ?? null,
          episodeTitle: activeMedia.episode?.title ?? null,
          positionSec: currentTime,
          durationSec: duration,
          genreIds: [],
        }),
      }).catch(() => {});
    },
    [activeMedia, profileId]
  );

  useEffect(() => {
    return () => {
      if (!profileId) return;
      const video = document.querySelector("video");
      if (!video || !video.duration || video.currentTime < 10) return;

      const body = JSON.stringify({
        mediaType: activeMedia.type === "movie" ? "movie" : "tv",
        title: activeMedia.title,
        posterPath: activeMedia.posterPath ?? null,
        backdropPath: activeMedia.backdropPath ?? null,
        seasonNumber: activeMedia.season?.number ?? null,
        episodeNumber: activeMedia.episode?.number ?? null,
        episodeTitle: activeMedia.episode?.title ?? null,
        positionSec: video.currentTime,
        durationSec: video.duration,
        genreIds: [],
      });

      navigator.sendBeacon(
        `/api/progress/${activeMedia.tmdbId}`,
        new Blob([body], { type: "application/json" })
      );
    };
  }, [activeMedia, profileId]);

  useEffect(() => {
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    const controller = new AbortController();

    scrape(nextRequestId, controller.signal);

    return () => {
      controller.abort();
    };
  }, [mediaKey, scrape]);

  return (
    <div className="relative h-screen w-full bg-black">
      {stream ? (
        <VideoPlayer
          stream={stream}
          onError={setError}
          title={activeTitle}
          debugSessionId={debugSessionIdRef.current ?? undefined}
          showNavigation={activeShowNavigation}
          onEpisodeSelect={handleEpisodeSelect}
          initialPosition={resumePosition}
          onProgressUpdate={handleProgressUpdate}
        />
      ) : error ? (
        <WatchErrorState
          error={error}
          title={activeTitle}
          subtitle={activeSubtitle}
          backdropPath={activeMedia.backdropPath}
          posterPath={activeMedia.posterPath}
          sources={sources}
          onRetry={startScrape}
          onBack={handleExitWatch}
          onHome={() => router.push("/")}
        />
      ) : (
        <ProviderStatus
          sources={sources}
          backdropPath={activeMedia.backdropPath}
          title={activeTitle}
          subtitle={
            activeMedia.type === "show" && activeMedia.season && activeMedia.episode
              ? `S${activeMedia.season.number} · E${activeMedia.episode.number}${activeMedia.episode.title ? ` · ${activeMedia.episode.title}` : ""}`
              : undefined
          }
        />
      )}
    </div>
  );
}
