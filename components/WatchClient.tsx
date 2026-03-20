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
import {
  TV_RECEIVER_COMMAND_EVENT,
  TV_PLAYER_CAPTION_COMMAND_EVENT,
  TV_PLAYER_CAPTION_STATE_EVENT,
  TV_RECEIVER_STORAGE_KEY,
  TV_REMOTE_TARGET_STORAGE_KEY,
  type TvReceiverCommand,
  type TvPlayerCaptionStatePayload,
  type TvReceiverStatusPayload,
  readRemoteSettings,
  readStorageValue,
  writeStorageValue,
} from "@/lib/tv-remote";
import type { TMDBEpisode, TMDBSeason } from "@/lib/tmdb";
import WatchPartyPanel from "./party/WatchPartyPanel";
import VideoPlayer from "./player/VideoPlayer";
import ProviderStatus, { SourceStatus } from "./ProviderStatus";
import TvRemoteScreen from "./tv/TvRemoteScreen";
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

function getEstimatedReceiverTime(status: TvReceiverStatusPayload | null) {
  if (!status) return 0;
  if (!status.updatedAt || !status.isPlaying) {
    return status.currentTimeSec;
  }

  const elapsed = (Date.now() - new Date(status.updatedAt).getTime()) / 1000;
  const nextTime = status.currentTimeSec + Math.max(0, elapsed);
  if (status.durationSec > 0) {
    return Math.min(status.durationSec, nextTime);
  }

  return nextTime;
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
  const lastPartyPlaybackRef = useRef<{ code: string; playing: boolean } | null>(null);
  const currentPartyCodeRef = useRef<string | null>(null);
  const suppressPartyLeaveRef = useRef(false);
  const playerPositionRef = useRef(0);
  const playerCaptionStateRef = useRef<TvPlayerCaptionStatePayload>({
    captionsAvailable: false,
    captionsEnabled: false,
  });
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
  const [tvReceiverId, setTvReceiverId] = useState<string | null>(null);
  const [remoteReceiverId, setRemoteReceiverId] = useState<string | null>(null);
  const [remoteLaunchState, setRemoteLaunchState] = useState<"idle" | "sending" | "sent">("idle");
  const [remoteLaunchError, setRemoteLaunchError] = useState<string | null>(null);
  const [remoteReceiverStatus, setRemoteReceiverStatus] = useState<TvReceiverStatusPayload | null>(
    null
  );

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
    currentPartyCodeRef.current = partyCode;
    if (partyCode) {
      suppressPartyLeaveRef.current = false;
    }
  }, [partyCode]);

  useEffect(() => {
    if (!devMode || !debugSessionIdRef.current) return;

    void resetNetworkDebug(debugSessionIdRef.current);
    return enableNetworkDebugCapture(debugSessionIdRef.current);
  }, [devMode]);

  useEffect(() => {
    setTvReceiverId(readStorageValue(TV_RECEIVER_STORAGE_KEY));
    setRemoteReceiverId(readStorageValue(TV_REMOTE_TARGET_STORAGE_KEY));
  }, []);

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
  const remoteWatchPath = useMemo(() => {
    const basePath = `/watch/${activeMedia.type === "movie" ? "movie" : "tv"}/${activeMedia.tmdbId}`;

    if (activeMedia.type !== "show") {
      return basePath;
    }

    const params = new URLSearchParams();
    if (activeMedia.season?.number != null) {
      params.set("season", String(activeMedia.season.number));
    }
    if (activeMedia.episode?.number != null) {
      params.set("episode", String(activeMedia.episode.number));
    }

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }, [activeMedia]);
  const syncReceiverStatus = useCallback(
    async ({
      currentTime,
      duration,
      isPlaying,
    }: {
      currentTime: number;
      duration: number;
      isPlaying: boolean;
    }) => {
      if (!tvReceiverId) return;

      await fetch(`/api/tv/receiver/${tvReceiverId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: remoteWatchPath,
          title: activeTitle,
          captionsAvailable: playerCaptionStateRef.current.captionsAvailable,
          captionsEnabled: playerCaptionStateRef.current.captionsEnabled,
          captions: playerCaptionStateRef.current.captions,
          activeCaptionIndex: playerCaptionStateRef.current.activeCaptionIndex,
          isPlaying,
          currentTimeSec: currentTime,
          durationSec: duration,
          mediaType: activeMedia.type === "movie" ? "movie" : "tv",
          tmdbId: activeMedia.tmdbId,
          seasonNumber: activeMedia.season?.number ?? null,
          episodeNumber: activeMedia.episode?.number ?? null,
        }),
      }).catch(() => {});
    },
    [activeMedia, activeTitle, remoteWatchPath, tvReceiverId]
  );
  const sendRemoteCommand = useCallback(
    async (command: TvReceiverCommand) => {
      if (!remoteReceiverId) return;

      const response = await fetch(`/api/tv/receiver/${remoteReceiverId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      }).catch(() => null);

      if (!response?.ok) {
        writeStorageValue(TV_REMOTE_TARGET_STORAGE_KEY, null);
        setRemoteReceiverId(null);
        setRemoteLaunchState("idle");
        setRemoteLaunchError("TV connection was lost. Playing on this device instead.");
        throw new Error("Remote command failed");
      }

      if (command.kind === "navigate") {
        setRemoteLaunchState("sent");
      }
    },
    [remoteReceiverId]
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

  // Keep a stable ref to the latest scrape function so the scrape effect
  // can call it without adding scrape to the deps (which would restart
  // scraping on every router.replace, e.g. when joining a watch party).
  const scrapeRef = useRef(scrape);
  scrapeRef.current = scrape;

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

    router.push(tvReceiverId ? "/tv" : "/");
  }, [router, tvReceiverId]);
  const handleRemoteBack = useCallback(() => {
    void sendRemoteCommand({
      kind: "navigate",
      path: "/tv",
      title: "TV Remote",
      settings: readRemoteSettings(),
    }).finally(() => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }

      router.push("/");
    });
  }, [router, sendRemoteCommand]);

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

  const handlePartySeekTo = useCallback((position: number) => {
    setPartySeekTo({ position, nonce: Date.now() });
  }, []);

  const handlePartyPlayingUpdate = useCallback((playing: boolean) => {
    setPartyPlayingState({ playing, nonce: Date.now() });
  }, []);

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
      suppressPartyLeaveRef.current = false;
      currentPartyCodeRef.current = code;
      lastPartyPlaybackRef.current = null;
      setPartyCode(code);
      setPartyRole(role);
      setPartyState(state ?? null);
      setPartyPanelOpen(true);

      if (state && role === "guest") {
        handlePartySeekTo(state.positionSec);
        handlePartyPlayingUpdate(state.isPlaying);
      }

      startTransition(() => {
        router.replace(buildCurrentPartyHref(code), { scroll: false });
      });
    },
    [buildCurrentPartyHref, handlePartyPlayingUpdate, handlePartySeekTo, router]
  );

  const handlePartyEnded = useCallback(() => {
    suppressPartyLeaveRef.current = true;
    currentPartyCodeRef.current = null;
    lastPartyPlaybackRef.current = null;
    setPartyCode(null);
    setPartyRole(null);
    setPartyState(null);
    setPartySeekTo(null);
    setPartyPlayingState(null);

    startTransition(() => {
      router.replace(buildCurrentPartyHref(null), { scroll: false });
    });
  }, [buildCurrentPartyHref, router]);

  const syncPartyPlaybackState = useCallback((isPlaying: boolean) => {
    if (!partyCode || !isPartyHost) return;

    void fetch(`/api/party/${partyCode}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionSec: playerPositionRef.current,
        isPlaying,
        season: activeMedia.season?.number ?? null,
        episode: activeMedia.episode?.number ?? null,
      }),
    }).catch(() => {});
  }, [
    activeMedia.episode?.number,
    activeMedia.season?.number,
    isPartyHost,
    partyCode,
  ]);

  const leaveParty = useCallback((code: string) => {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(
        `/api/party/${code}/leave`,
        new Blob([], { type: "application/json" })
      );
      if (sent) return;
    }

    void fetch(`/api/party/${code}/leave`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, []);

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
    if (!tvReceiverId) return;

    const getVideo = () => document.querySelector("video") as HTMLVideoElement | null;
    const handleCommand = (event: Event) => {
      const nextCommand = (event as CustomEvent<TvReceiverCommand>).detail;
      if (!nextCommand) return;

      if (nextCommand.kind === "caption") {
        window.dispatchEvent(
          new CustomEvent(TV_PLAYER_CAPTION_COMMAND_EVENT, {
            detail: nextCommand,
          })
        );
        return;
      }

      if (nextCommand.kind !== "playback") return;

      const video = getVideo();
      if (!video) return;

      switch (nextCommand.action) {
        case "play":
          if (video.paused) {
            void video.play().catch(() => {});
          }
          break;
        case "pause":
          if (!video.paused) {
            video.pause();
          }
          break;
        case "toggle":
          if (video.paused) {
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
          break;
        case "seek":
          if (typeof nextCommand.positionSec === "number") {
            video.currentTime = nextCommand.positionSec;
            playerPositionRef.current = nextCommand.positionSec;
          }
          break;
      }
    };

    window.addEventListener(TV_RECEIVER_COMMAND_EVENT, handleCommand as EventListener);
    return () => {
      window.removeEventListener(TV_RECEIVER_COMMAND_EVENT, handleCommand as EventListener);
    };
  }, [tvReceiverId]);

  useEffect(() => {
    if (!tvReceiverId || remoteReceiverId) return;

    const handleCaptionState = (event: Event) => {
      const nextState = (event as CustomEvent<TvPlayerCaptionStatePayload>).detail;
      playerCaptionStateRef.current = nextState;

      const video = document.querySelector("video") as HTMLVideoElement | null;
      if (!video) return;

      void syncReceiverStatus({
        currentTime: video.currentTime || 0,
        duration: video.duration || 0,
        isPlaying: !video.paused && !video.ended,
      });
    };

    window.addEventListener(TV_PLAYER_CAPTION_STATE_EVENT, handleCaptionState as EventListener);
    return () => {
      window.removeEventListener(
        TV_PLAYER_CAPTION_STATE_EVENT,
        handleCaptionState as EventListener
      );
    };
  }, [remoteReceiverId, syncReceiverStatus, tvReceiverId]);

  useEffect(() => {
    if (!tvReceiverId || remoteReceiverId) return;

    const events: Array<keyof HTMLMediaElementEventMap> = [
      "play",
      "pause",
      "seeked",
      "durationchange",
      "ended",
    ];
    let boundVideo: HTMLVideoElement | null = null;

    const syncVideoState = () => {
      const video = boundVideo;
      if (!video) return;

      playerPositionRef.current = video.currentTime || 0;
      void syncReceiverStatus({
        currentTime: video.currentTime || 0,
        duration: video.duration || 0,
        isPlaying: !video.paused && !video.ended,
      });
    };

    const unbind = () => {
      if (!boundVideo) return;
      for (const eventName of events) {
        boundVideo.removeEventListener(eventName, syncVideoState);
      }
      boundVideo = null;
    };

    const bind = () => {
      const nextVideo = document.querySelector("video") as HTMLVideoElement | null;
      if (!nextVideo || nextVideo === boundVideo) return;

      unbind();
      boundVideo = nextVideo;
      for (const eventName of events) {
        boundVideo.addEventListener(eventName, syncVideoState);
      }
      syncVideoState();
    };

    bind();
    const bindTimer = window.setInterval(bind, 500);

    return () => {
      window.clearInterval(bindTimer);
      unbind();
    };
  }, [remoteReceiverId, syncReceiverStatus, tvReceiverId]);

  useEffect(() => {
    if (!remoteReceiverId) {
      setRemoteReceiverStatus(null);
      return;
    }

    const eventSource = new EventSource(`/api/tv/receiver/${remoteReceiverId}/events`);
    eventSource.addEventListener("status", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TvReceiverStatusPayload;
      setRemoteReceiverStatus(payload);
    });
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
      }
    };

    return () => {
      eventSource.close();
    };
  }, [remoteReceiverId]);

  useEffect(() => {
    if (!remoteReceiverId) {
      setRemoteLaunchState("idle");
      setRemoteLaunchError(null);
      return;
    }

    let cancelled = false;
    setRemoteLaunchState("sending");
    setRemoteLaunchError(null);

    void sendRemoteCommand({
      kind: "navigate",
      path: remoteWatchPath,
      title: activeTitle,
      settings: readRemoteSettings(),
    })
      .then(() => {
        if (cancelled) return;
        setRemoteLaunchState("sent");
      })
      .catch(() => {
        if (cancelled) return;
        writeStorageValue(TV_REMOTE_TARGET_STORAGE_KEY, null);
        setRemoteReceiverId(null);
        setRemoteLaunchState("idle");
        setRemoteLaunchError("TV connection was lost. Playing on this device instead.");
      });

    return () => {
      cancelled = true;
    };
  }, [activeTitle, remoteReceiverId, remoteWatchPath, sendRemoteCommand]);

  useEffect(() => {
    if (remoteReceiverId) return;

    if (!partyCode || !partyState || isPartyHost || partyMatchesActiveMedia) return;

    const nextHref = mergePartyCodeIntoHref(buildPartyWatchHref(partyState), partyCode);
    startTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  }, [isPartyHost, partyCode, partyMatchesActiveMedia, partyState, remoteReceiverId, router]);

  useEffect(() => {
    if (remoteReceiverId) return;

    if (!partyCode || !isPartyHost) {
      lastPartyPlaybackRef.current = null;
      return;
    }

    const lastPlayback = lastPartyPlaybackRef.current;
    if (!lastPlayback || lastPlayback.code !== partyCode) {
      lastPartyPlaybackRef.current = { code: partyCode, playing: playerIsPlaying };
      return;
    }

    if (lastPlayback.playing === playerIsPlaying) {
      return;
    }

    lastPartyPlaybackRef.current = { code: partyCode, playing: playerIsPlaying };
    syncPartyPlaybackState(playerIsPlaying);
  }, [isPartyHost, partyCode, playerIsPlaying, remoteReceiverId, syncPartyPlaybackState]);

  useEffect(() => {
    if (remoteReceiverId) return;

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
  const handleRemoteTogglePlay = useCallback(() => {
    setRemoteReceiverStatus((current) =>
      current
        ? {
            ...current,
            isPlaying: !current.isPlaying,
            updatedAt: new Date().toISOString(),
          }
        : current
    );
    void sendRemoteCommand({ kind: "playback", action: "toggle" });
  }, [sendRemoteCommand]);
  const handleRemoteSetCaption = useCallback((captionIndex: number) => {
    setRemoteReceiverStatus((current) =>
      current
        ? {
            ...current,
            captionsEnabled: captionIndex >= 0,
            activeCaptionIndex: captionIndex,
          }
        : current
    );
    void sendRemoteCommand({ kind: "caption", action: "set", captionIndex });
  }, [sendRemoteCommand]);
  const handleRemoteSeekTo = useCallback(
    (positionSec: number) => {
      const maxDuration = remoteReceiverStatus?.durationSec ?? 0;
      const clamped =
        maxDuration > 0
          ? Math.max(0, Math.min(maxDuration, positionSec))
          : Math.max(0, positionSec);

      setRemoteReceiverStatus((current) =>
        current
          ? {
              ...current,
              currentTimeSec: clamped,
              updatedAt: new Date().toISOString(),
            }
          : current
      );

      void sendRemoteCommand({
        kind: "playback",
        action: "seek",
        positionSec: clamped,
      });
    },
    [remoteReceiverStatus?.durationSec, sendRemoteCommand]
  );
  const handleRemoteSeekBy = useCallback(
    (delta: number) => {
      const nextPosition = getEstimatedReceiverTime(remoteReceiverStatus) + delta;
      void handleRemoteSeekTo(nextPosition);
    },
    [handleRemoteSeekTo, remoteReceiverStatus]
  );

  useEffect(() => {
    const handlePageHide = () => {
      const currentPartyCode = currentPartyCodeRef.current;
      if (!currentPartyCode || suppressPartyLeaveRef.current) return;

      suppressPartyLeaveRef.current = true;
      leaveParty(currentPartyCode);
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);

      const currentPartyCode = currentPartyCodeRef.current;
      if (!currentPartyCode || suppressPartyLeaveRef.current) return;

      suppressPartyLeaveRef.current = true;
      leaveParty(currentPartyCode);
    };
  }, [leaveParty]);

  useEffect(() => {
    if (remoteReceiverId) return;

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
  }, [activeMedia, profileId, remoteReceiverId]);

  useEffect(() => {
    if (remoteReceiverId) return;

    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    const controller = new AbortController();

    scrapeRef.current(nextRequestId, controller.signal);

    return () => {
      controller.abort();
    };
  }, [mediaKey, remoteReceiverId]); // intentionally omit scrape — use scrapeRef to avoid restarting on every router.replace

  if (remoteReceiverId) {
    return (
      <TvRemoteScreen
        title={activeTitle}
        subtitle={activeSubtitle}
        posterPath={activeMedia.posterPath}
        backdropPath={activeMedia.backdropPath}
        showNavigation={activeShowNavigation}
        remoteStatus={remoteReceiverStatus}
        launchState={remoteLaunchState}
        error={remoteLaunchError}
        onBack={handleRemoteBack}
        onTogglePlay={handleRemoteTogglePlay}
        onSetCaption={handleRemoteSetCaption}
        onSeekBy={handleRemoteSeekBy}
        onSeekTo={handleRemoteSeekTo}
        onEpisodeSelect={handleEpisodeSelect}
      />
    );
  }

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
          onHome={() => router.push(tvReceiverId ? "/tv" : "/")}
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
              onSeekTo={handlePartySeekTo}
              onSetPlaying={handlePartyPlayingUpdate}
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
