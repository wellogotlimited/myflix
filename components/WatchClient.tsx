"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Users } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createDebugSessionId,
  enableNetworkDebugCapture,
  resetNetworkDebug,
} from "@/lib/network-debug-client";
import {
  buildPartyWatchHref,
  matchesPartyMedia,
  type WatchPartyState,
} from "@/lib/party";
import { useProfileSession } from "@/lib/profile-session";
import type { TMDBEpisode, TMDBSeason } from "@/lib/tmdb";
import WatchPartyPanel from "./party/WatchPartyPanel";
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

type PartyRole = "host" | "guest" | null;

function mergePartyCodeIntoHref(href: string, partyCode: string | null) {
  const [pathname, search = ""] = href.split("?");
  const params = new URLSearchParams(search);

  if (partyCode) {
    params.set("party", partyCode);
  } else {
    params.delete("party");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const lastPartySyncRef = useRef(0);
  const playerPositionRef = useRef(0);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [partySeekTo, setPartySeekTo] = useState<{ position: number; nonce: number } | null>(null);
  const [partyPlayingState, setPartyPlayingState] = useState<{
    playing: boolean;
    nonce: number;
  } | null>(null);
  const initialPartyCode = useMemo(
    () => searchParams.get("party")?.trim().toUpperCase() ?? null,
    [searchParams]
  );
  const [partyCode, setPartyCode] = useState<string | null>(initialPartyCode);
  const [partyRole, setPartyRole] = useState<PartyRole>(initialPartyCode ? "guest" : null);
  const [partyState, setPartyState] = useState<WatchPartyState | null>(null);
  const [partyPanelOpen, setPartyPanelOpen] = useState(Boolean(initialPartyCode));

  if (devMode && !debugSessionIdRef.current) {
    debugSessionIdRef.current = createDebugSessionId();
  }

  useEffect(() => {
    setActiveMedia(media);
    setActiveShowNavigation(showNavigation);
  }, [media, showNavigation]);

  useEffect(() => {
    if (!initialPartyCode) return;
    setPartyCode((current) => (current === initialPartyCode ? current : initialPartyCode));
    setPartyRole((current) => current ?? "guest");
    setPartyPanelOpen(true);
  }, [initialPartyCode]);

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
  const isPartyHost = useMemo(() => {
    if (!partyCode || !profileId) return false;
    if (partyState) return partyState.hostProfileId === profileId;
    return partyRole === "host";
  }, [partyCode, partyRole, partyState, profileId]);
  const partyMatchesActiveMedia = useMemo(
    () =>
      !partyState ||
      matchesPartyMedia(partyState, {
        type: activeMedia.type,
        tmdbId: activeMedia.tmdbId,
        seasonNumber: activeMedia.season?.number ?? null,
        episodeNumber: activeMedia.episode?.number ?? null,
      }),
    [activeMedia, partyState]
  );
  const initialPlaybackPosition = useMemo(() => {
    if (partyCode && !isPartyHost) {
      return partyState?.positionSec;
    }

    return resumePosition;
  }, [isPartyHost, partyCode, partyState?.positionSec, resumePosition]);
  const buildCurrentPartyHref = useCallback(
    (nextPartyCode: string | null) => {
      const nextSearch = new URLSearchParams(searchParams.toString());
      if (nextPartyCode) {
        nextSearch.set("party", nextPartyCode);
      } else {
        nextSearch.delete("party");
      }

      const query = nextSearch.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams]
  );

  const scrape = useCallback(
    async (requestId: number, signal?: AbortSignal) => {
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
    },
    [activeMedia]
  );

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

      const nextHref = mergePartyCodeIntoHref(
        `/watch/${activeShowNavigation.type}/${activeShowNavigation.showId}?season=${seasonNumber}&episode=${episode.episode_number}`,
        partyCode
      );

      startTransition(() => {
        router.replace(nextHref, { scroll: false });
      });
    },
    [activeMedia, activeShowNavigation, partyCode, router]
  );

  const handlePartyStateChange = useCallback(
    (nextState: WatchPartyState | null) => {
      setPartyState(nextState);

      if (!nextState) {
        return;
      }

      if (profileId) {
        setPartyRole(nextState.hostProfileId === profileId ? "host" : "guest");
      }
    },
    [profileId]
  );

  const handlePartyCreated = useCallback(
    ({
      code,
      role,
      state,
    }: {
      code: string;
      role: "host" | "guest";
      state?: WatchPartyState;
    }) => {
      setPartyCode(code);
      setPartyRole(role);
      setPartyState(state ?? null);
      setPartyPanelOpen(true);

      if (state && role === "guest") {
        setPartySeekTo({ position: state.positionSec, nonce: Date.now() });
        setPartyPlayingState({ playing: state.isPlaying, nonce: Date.now() });
      }

      startTransition(() => {
        router.replace(buildCurrentPartyHref(code), { scroll: false });
      });
    },
    [buildCurrentPartyHref, router]
  );

  const handlePartyEnded = useCallback(() => {
    setPartyCode(null);
    setPartyRole(null);
    setPartyState(null);
    setPartySeekTo(null);
    setPartyPlayingState(null);

    startTransition(() => {
      router.replace(buildCurrentPartyHref(null), { scroll: false });
    });
  }, [buildCurrentPartyHref, router]);

  const syncPartyPlaybackState = useCallback((force = false) => {
    if (!partyCode || !isPartyHost) return;
    const now = Date.now();
    if (!force && now - lastPartySyncRef.current < 750) return;
    lastPartySyncRef.current = now;

    void fetch(`/api/party/${partyCode}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionSec: playerPositionRef.current,
        isPlaying: playerIsPlaying,
        season: activeMedia.season?.number ?? null,
        episode: activeMedia.episode?.number ?? null,
      }),
    }).catch(() => {});
  }, [
    activeMedia.episode?.number,
    activeMedia.season?.number,
    isPartyHost,
    partyCode,
    playerIsPlaying,
  ]);

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
    playerPositionRef.current = 0;
  }, [mediaKey]);

  useEffect(() => {
    if (!partyCode || !partyState || isPartyHost || partyMatchesActiveMedia) return;

    const nextHref = mergePartyCodeIntoHref(buildPartyWatchHref(partyState), partyCode);
    startTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  }, [isPartyHost, partyCode, partyMatchesActiveMedia, partyState, router]);

  useEffect(() => {
    if (!partyCode || !isPartyHost) return;

    syncPartyPlaybackState(true);
    const interval = setInterval(() => syncPartyPlaybackState(true), 1500);
    return () => clearInterval(interval);
  }, [isPartyHost, partyCode, syncPartyPlaybackState]);

  useEffect(() => {
    if (!partyCode || !isPartyHost) return;
    syncPartyPlaybackState(true);
  }, [
    activeMedia.episode?.number,
    activeMedia.season?.number,
    isPartyHost,
    partyCode,
    playerIsPlaying,
    syncPartyPlaybackState,
  ]);

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
      playerPositionRef.current = currentTime;
      if (partyCode && isPartyHost) {
        syncPartyPlaybackState();
      }

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
    [activeMedia, isPartyHost, partyCode, profileId, syncPartyPlaybackState]
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
          initialPosition={initialPlaybackPosition}
          onProgressUpdate={handleProgressUpdate}
          onPlayStateChange={setPlayerIsPlaying}
          partySeekTo={partySeekTo}
          partyPlayingState={partyPlayingState}
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

      <button
        type="button"
        onClick={() => setPartyPanelOpen(true)}
        className={`absolute right-4 top-4 z-40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur-sm transition ${
          partyCode
            ? "border-[#e50914] bg-[#e50914] text-white shadow-[0_12px_30px_rgba(229,9,20,0.35)]"
            : "border-white/15 bg-black/55 text-white/85 hover:bg-black/75"
        }`}
      >
        <Users size={18} weight="fill" />
        <span>{partyCode ? "Party Active" : "Watch Party"}</span>
      </button>

      {partyPanelOpen && (
        <>
          <button
            type="button"
            aria-label="Close watch party panel"
            onClick={() => setPartyPanelOpen(false)}
            className="absolute inset-0 z-40 bg-black/35"
          />
          <div className="absolute inset-y-0 right-0 z-50 w-full max-w-sm border-l border-white/10 bg-[#121212] shadow-2xl">
            <WatchPartyPanel
              tmdbId={Number(activeMedia.tmdbId)}
              mediaType={activeMedia.type === "movie" ? "movie" : "tv"}
              season={activeMedia.season?.number ?? null}
              episode={activeMedia.episode?.number ?? null}
              currentProfileId={profileId ?? ""}
              partyCode={partyCode}
              isHost={isPartyHost}
              playerPositionRef={playerPositionRef}
              isPlaying={playerIsPlaying}
              onSeekTo={(position) =>
                setPartySeekTo({ position, nonce: Date.now() })
              }
              onSetPlaying={(playing) =>
                setPartyPlayingState({ playing, nonce: Date.now() })
              }
              onPartyCreated={handlePartyCreated}
              onPartyStateChange={handlePartyStateChange}
              onPartyEnded={handlePartyEnded}
              onClose={() => setPartyPanelOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
