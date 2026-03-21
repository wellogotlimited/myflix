"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CaretLeft, CaretRight, FastForward, Lock, Pause, Play, Rewind } from "@phosphor-icons/react";
import { useSkipSegments } from "./hooks/useSkipSegments";
import { useAirPlay } from "./hooks/useAirPlay";
import Hls from "hls.js";
import type { TMDBEpisode, TMDBSeason } from "@/lib/tmdb";
import {
  TV_PLAYER_CAPTION_COMMAND_EVENT,
  TV_PLAYER_CAPTION_STATE_EVENT,
  type TvPlayerCaptionStatePayload,
  type TvReceiverCommand,
} from "@/lib/tv-remote";
import Controls from "./Controls";
import EpisodeNavigator from "./EpisodeNavigator";
import MobileControls from "./MobileControls";
import MobileEpisodeDrawer from "./MobileEpisodeDrawer";
import SubtitleRenderer, { CaptionCue, parseCaptions } from "./SubtitleRenderer";
import { QUALITY_ORDER } from "./utils";
import { sendDebugEvent } from "@/lib/network-debug-client";

export interface CaptionTrack {
  id: string;
  language: string;
  label: string;
  type: string;
  source: "provider" | "custom";
  url?: string;
  content?: string;
}

interface StreamData {
  type: "hls" | "file";
  playlist?: string;
  qualities?: Record<string, { type: string; url: string }>;
  headers?: Record<string, string>;
  preferredHeaders?: Record<string, string>;
  captions?: Array<{ language: string; url: string; type: string }>;
  flags?: string[];
}

interface VideoPlayerProps {
  stream: StreamData;
  onError?: (msg: string) => void;
  title?: string;
  debugSessionId?: string;
  showNavigation?: {
    showId: string;
    imdbId?: string | null;
    type: string;
    seasons: TMDBSeason[];
    episodes: TMDBEpisode[];
    currentSeason: number;
    currentEpisode: number;
  };
  onEpisodeSelect?: (payload: {
    seasonNumber: number;
    episode: TMDBEpisode;
    episodes: TMDBEpisode[];
  }) => void;
  initialPosition?: number;
  onProgressUpdate?: (currentTime: number, duration: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  partySeekTo?: { position: number; nonce: number } | null;
  partyPlayingState?: { playing: boolean; nonce: number } | null;
}

type FullscreenCapableElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

type FullscreenCapableVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
  webkitDisplayingFullscreen?: boolean;
};

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitCancelFullScreen?: () => Promise<void> | void;
};

export default function VideoPlayer({
  stream,
  onError,
  title,
  debugSessionId,
  showNavigation,
  onEpisodeSelect,
  initialPosition,
  onProgressUpdate,
  onPlayStateChange,
  partySeekTo,
  partyPlayingState,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = window.localStorage.getItem("myflix-volume");
    const parsedVolume = saved ? parseFloat(saved) : NaN;
    return isFinite(parsedVolume) ? parsedVolume : 1;
  });
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);

  const [qualities, setQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState("auto");

  const [activeCaptionIdx, setActiveCaptionIdx] = useState(-1);
  const [captionCues, setCaptionCues] = useState<CaptionCue[]>([]);
  const [customCaptionState, setCustomCaptionState] = useState<{
    streamKey: string;
    tracks: CaptionTrack[];
  }>({
    streamKey: "",
    tracks: [],
  });
  const [subtitleDelay, setSubtitleDelay] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = window.localStorage.getItem("myflix-subtitle-delay");
    return saved ? Number(saved) || 0 : 0;
  });
  const [subtitleFontSize] = useState(100);
  const [centerIndicator, setCenterIndicator] = useState<"play" | "pause" | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [doubleTapInfo, setDoubleTapInfo] = useState<{ side: "left" | "right"; key: number } | null>(null);
  const [isTouchDevice] = useState(() =>
    typeof navigator !== "undefined" ? navigator.maxTouchPoints > 0 : false
  );
  const [devMode] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("myflix-dev-mode") === "true"
  );
  const [proxyEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const val = localStorage.getItem("myflix-proxy-enabled");
    return val === null ? false : val === "true";
  });
  const [defaultCaptionsEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("myflix-captions-enabled") === "true";
  });
  const [autoplayNextEpisode] = useState(() => {
    if (typeof window === "undefined") return true;
    const value = localStorage.getItem("myflix-autoplay-next");
    return value === null ? true : value === "true";
  });
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [hlsMode, setHlsMode] = useState<"hlsjs" | "native" | "file" | "none">("none");
  const [manifestPreview, setManifestPreview] = useState<string | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string>("");

  function dbg(msg: string) {
    setDebugLog((prev) => [...prev.slice(-50), `${new Date().toISOString().slice(11, 23)} ${msg}`]);
    if (devMode) {
      sendDebugEvent(debugSessionId, {
        kind: "player-event",
        source: "player",
        message: msg,
      });
    }
  }

  async function fetchManifestPreview(url: string) {
    try {
      dbg(`fetching manifest for preview...`);
      const res = await fetch(url);
      const text = await res.text();
      dbg(`manifest fetch status=${res.status} length=${text.length}`);
      setManifestPreview(text.slice(0, 1000));
    } catch (e) {
      dbg(`manifest fetch error: ${e}`);
      setManifestPreview(`ERROR: ${e}`);
    }
  }
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spaceHeldRef = useRef(false);
  const spaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preBoostSpeedRef = useRef(1);
  const centerIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const lastTouchTimeRef = useRef(0);
  const consumeNextContainerTouchRef = useRef(false);

  const streamKey = useMemo(
    () => JSON.stringify([stream.type, stream.playlist, stream.qualities, stream.captions]),
    [stream]
  );
  const playbackStream = stream;

  // Next episode within the current season (null if last episode or no show)
  const nextEpisode = useMemo(() => {
    if (!showNavigation) return null;
    const { episodes, currentEpisode, currentSeason } = showNavigation;
    const idx = episodes.findIndex((e) => e.episode_number === currentEpisode);
    if (idx !== -1 && idx < episodes.length - 1) {
      return { episode: episodes[idx + 1], seasonNumber: currentSeason, episodes };
    }
    return null;
  }, [showNavigation]);

  // ── AirPlay ────────────────────────────────────────────────────────────
  const airPlay = useAirPlay(videoRef);

  // Fetch real intro/recap/credits/preview timestamps via server-side proxy
  const segments = useSkipSegments(
    showNavigation?.showId ?? null,
    showNavigation?.currentSeason ?? null,
    showNavigation?.currentEpisode ?? null,
    showNavigation?.imdbId,
  );

  // Which segment is the player currently inside (if any)
  const activeSegment = useMemo(() => {
    if (!segments.length) return null;
    return (
      segments.find((seg) => {
        const end = seg.endSec ?? (duration || Infinity);
        return currentTime >= seg.startSec && currentTime < end;
      }) ?? null
    );
  }, [segments, currentTime, duration]);
  const customCaptions = useMemo(
    () => (customCaptionState.streamKey === streamKey ? customCaptionState.tracks : []),
    [customCaptionState, streamKey]
  );
  const captions = useMemo<CaptionTrack[]>(
    () => [
      ...(stream.captions || []).map((caption, index) => ({
        id: `provider-${index}`,
        language: normalizeCaptionLanguage(caption.language),
        label: formatCaptionLabel(caption.language),
        type: resolveCaptionType(caption.url, caption.type),
        source: "provider" as const,
        url: caption.url,
      })),
      ...customCaptions,
    ],
    [customCaptions, stream.captions]
  );
  const activeCaption = captions[activeCaptionIdx] || null;
  const visibleCaptionCues = useMemo(() => {
    if (!activeCaption) return [];
    if (activeCaption.content) return parseCaptions(activeCaption.content);
    return captionCues;
  }, [activeCaption, captionCues]);
  useEffect(() => {
    if (!defaultCaptionsEnabled || captions.length === 0 || activeCaptionIdx >= 0) return;
    setActiveCaptionIdx(0);
  }, [activeCaptionIdx, captions.length, defaultCaptionsEnabled]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("myflix-subtitle-delay", String(subtitleDelay));
  }, [subtitleDelay]);
  useEffect(() => {
    const emitCaptionState = () => {
      const payload: TvPlayerCaptionStatePayload = {
        captionsAvailable: captions.length > 0,
        captionsEnabled: activeCaptionIdx >= 0,
        captions: captions.map((caption, index) => ({
          index,
          label: caption.label,
        })),
        activeCaptionIndex: activeCaptionIdx,
      };

      window.dispatchEvent(
        new CustomEvent<TvPlayerCaptionStatePayload>(TV_PLAYER_CAPTION_STATE_EVENT, {
          detail: payload,
        })
      );
    };

    emitCaptionState();
  }, [activeCaptionIdx, captions.length]);

  useEffect(() => {
    const handleCaptionCommand = (event: Event) => {
      const command = (event as CustomEvent<TvReceiverCommand>).detail;
      if (!command || command.kind !== "caption" || command.action !== "set") {
        return;
      }

      setActiveCaptionIdx(() => {
        if (command.captionIndex < 0) return -1;
        return command.captionIndex < captions.length ? command.captionIndex : -1;
      });
    };

    window.addEventListener(
      TV_PLAYER_CAPTION_COMMAND_EVENT,
      handleCaptionCommand as EventListener
    );
    return () => {
      window.removeEventListener(
        TV_PLAYER_CAPTION_COMMAND_EVENT,
        handleCaptionCommand as EventListener
      );
    };
  }, [captions.length]);
  const currentEpisodeMeta = useMemo(
    () =>
      showNavigation?.episodes.find(
        (episode) => episode.episode_number === showNavigation.currentEpisode
      ) || null,
    [showNavigation]
  );
  const resetIdleTimer = useCallback(() => {
    setShowControls(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (playing && !showEpisodePanel) setShowControls(false);
    }, 3000);
  }, [playing, showEpisodePanel]);

  // Force landscape orientation on mobile
  useEffect(() => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    orientation.lock?.("landscape").catch(() => {});
    return () => { orientation.unlock?.(); };
  }, []);

  useEffect(() => {
    if (showEpisodePanel) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }

    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [playing, showEpisodePanel]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Hard-reset video element so the browser's MSE pipeline doesn't get stuck
    video.removeAttribute("src");
    video.load();

    queueMicrotask(() => {
      setLoading(true);
      setQualities([]);
      setCurrentQuality("auto");
    });

    if (playbackStream.type === "hls" && playbackStream.playlist) {
      dbg(`stream=hls url=${playbackStream.playlist.slice(0, 80)}`);
      dbg(`headers=${JSON.stringify({ ...playbackStream.preferredHeaders, ...playbackStream.headers })}`);
      const supportsNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
      dbg(`Hls.isSupported=${Hls.isSupported()} nativeHls=${supportsNativeHls} touch=${isTouchDevice}`);
      // Use HLS.js whenever it's supported (p-stream approach: native HLS only when HLS.js unavailable)
      // All requests go through /api/proxy which sets Referer/Origin server-side
      if (Hls.isSupported()) {
        setHlsMode("hlsjs");
        dbg("engine=hls.js");

        const hlsHeaders = { ...playbackStream.preferredHeaders, ...playbackStream.headers };
        const hasHlsHeaders = Object.keys(hlsHeaders).length > 0;
        const shouldProxyHls = hasHlsHeaders && (proxyEnabled || isTouchDevice);
        const hlsSource = shouldProxyHls
          ? `/api/proxy?payload=${encodePayload({
              url: playbackStream.playlist,
              type: "hls",
              headers: hlsHeaders,
              debugSessionId,
            })}`
          : playbackStream.playlist;
        dbg(`hlsjs src=${shouldProxyHls ? "[proxied]" : "[direct]"}`);
        setManifestUrl(hlsSource);

        const hls = new Hls({
          autoStartLoad: true,
          maxBufferLength: 120, // 120 seconds
          maxMaxBufferLength: 240,
          abrEwmaDefaultEstimate: 5 * 1000 * 1000, // 5 Mbps default bandwidth estimate for better ABR decisions
          fragLoadPolicy: {
            default: {
              maxLoadTimeMs: 30 * 1000, // allow it load extra long, fragments are slow if requested for the first time on an origin
              maxTimeToFirstByteMs: 30 * 1000,
              errorRetry: {
                maxNumRetry: 10,
                retryDelayMs: 1000,
                maxRetryDelayMs: 10000,
              },
              timeoutRetry: {
                maxNumRetry: 10,
                retryDelayMs: 1000,
                maxRetryDelayMs: 8000,
              },
            },
          },
          renderTextTracksNatively: false,
        });
        hlsRef.current = hls;

        const mediaAttachedTimer = setTimeout(() => dbg("WARN: media attached never fired after 4s"), 4000);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => { clearTimeout(mediaAttachedTimer); dbg("media attached"); });
        hls.on(Hls.Events.MANIFEST_LOADING, (_e, data) => dbg(`manifest loading: ${data.url.slice(0, 60)}`));
        hls.on(Hls.Events.MANIFEST_LOADED, (_e, data) => dbg(`manifest loaded status=${JSON.stringify((data.networkDetails as XMLHttpRequest)?.status)}`));

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          dbg(`manifest parsed levels=${data.levels.length}`);
          const levelsSet = new Set<string>();
          data.levels.forEach((level) => {
            const h = level.height;
            if (h >= 2160) levelsSet.add("4k");
            else if (h >= 1080) levelsSet.add("1080");
            else if (h >= 720) levelsSet.add("720");
            else if (h >= 480) levelsSet.add("480");
            else if (h >= 360) levelsSet.add("360");
            else levelsSet.add("unknown");
          });
          const sorted = QUALITY_ORDER.filter((q) => levelsSet.has(q)) as string[];
          setQualities(sorted);
          setLoading(false);
          if (initialPosition && initialPosition > 5) {
            video.currentTime = initialPosition;
          }
          video.play().catch((e) => dbg(`play() rejected: ${e}`));
        });

        let mediaRecoveryAttempts = 0;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          dbg(`hls error fatal=${data.fatal} type=${data.type} details=${data.details}`);
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              dbg("fatal network error — calling startLoad() to recover");
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryAttempts < 2) {
              mediaRecoveryAttempts += 1;
              dbg(`fatal media error — calling recoverMediaError() (attempt ${mediaRecoveryAttempts})`);
              hls.recoverMediaError();
              return;
            }
            onError?.(`Playback error: ${data.type}`);
          }
        });

        hls.attachMedia(video);
        hls.loadSource(hlsSource);
        dbg("hls.attachMedia+loadSource called");
      } else if (supportsNativeHls) {
        setHlsMode("native");
        dbg("engine=native-hls");
        // iOS can't set request headers — proxy the manifest so the server adds them
        const headers = { ...playbackStream.preferredHeaders, ...playbackStream.headers };
        const hasHeaders = Object.keys(headers).length > 0;
        const shouldProxyNative = hasHeaders && (proxyEnabled || isTouchDevice);
        const manifestUrl = shouldProxyNative
          ? `/api/proxy?payload=${encodePayload({
              url: playbackStream.playlist,
              type: "hls",
              headers,
              debugSessionId,
            })}`
          : playbackStream.playlist;
        dbg(`native src=${shouldProxyNative ? "[proxied]" : "[direct]"} proxy=${proxyEnabled}`);
        setManifestUrl(manifestUrl);
        video.src = manifestUrl;
        video.addEventListener("loadedmetadata", () => {
          dbg("native: loadedmetadata fired");
          setLoading(false);
          setShowControls(true);
          if (initialPosition && initialPosition > 5) {
            video.currentTime = initialPosition;
          }
          // iOS requires play() from a user gesture — attempt it but don't force
          video.play().catch((e) => dbg(`native play() blocked: ${e} — tap play to start`));
        }, { once: true });
        video.addEventListener("error", () => {
          const err = video.error;
          dbg(`native error code=${err?.code} msg=${err?.message}`);
          onError?.("Stream failed to load. Try again.");
          setLoading(false);
        }, { once: true });
      } else {
        setHlsMode("none");
        dbg("engine=none (HLS not supported)");
        onError?.("HLS is not supported in this browser.");
      }
    } else if (playbackStream.type === "file" && playbackStream.qualities) {
      setHlsMode("file");
      dbg(`stream=file qualities=${Object.keys(playbackStream.qualities).join(",")}`);
      const fileHeaders = { ...playbackStream.preferredHeaders, ...playbackStream.headers };
      const shouldProxyFile = Object.keys(fileHeaders).length > 0;
      const available: string[] = [];
      let bestUrl = "";
      for (const q of QUALITY_ORDER) {
        const entry = playbackStream.qualities[q];
        if (entry) {
          available.push(q);
          if (!bestUrl) {
            bestUrl = shouldProxyFile
              ? `/api/proxy?payload=${encodePayload({
                  url: entry.url,
                  type: "mp4",
                  headers: fileHeaders,
                  debugSessionId,
                })}`
              : entry.url;
          }
        }
      }
      queueMicrotask(() => {
        setQualities(available);
        setCurrentQuality(available[0] || "unknown");
      });
      if (bestUrl) {
        video.src = bestUrl;
      }
      video.addEventListener(
        "loadedmetadata",
        () => {
          setLoading(false);
          if (initialPosition && initialPosition > 5) {
            video.currentTime = initialPosition;
          }
          video.play().catch(() => {});
        },
        { once: true }
      );
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [initialPosition, onError, playbackStream]);

  // Reset ended/countdown state whenever a new stream is loaded
  useEffect(() => {
    setVideoEnded(false);
    setAutoNextCountdown(null);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [streamKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => { setPlaying(true); onPlayStateChange?.(true); };
    const onPause = () => { setPlaying(false); onPlayStateChange?.(false); };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onProgressUpdate?.(video.currentTime, video.duration || 0);
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onRateChange = () => setPlaybackRate(video.playbackRate);
    const onEnded = () => {
      setPlaying(false);
      setShowControls(true);
      setVideoEnded(true);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("progress", onProgress);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("ratechange", onRateChange);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !partySeekTo) return;

    if (Math.abs(video.currentTime - partySeekTo.position) < 0.75) {
      return;
    }

    video.currentTime = partySeekTo.position;
  }, [partySeekTo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !partyPlayingState) return;

    if (partyPlayingState.playing) {
      if (video.paused) {
        video.play().catch(() => {});
      }
      return;
    }

    if (!video.paused) {
      video.pause();
    }
  }, [partyPlayingState]);

  useEffect(() => {
    const doc = document as FullscreenCapableDocument;
    const video = videoRef.current as FullscreenCapableVideo | null;
    const handler = () =>
      setIsFullscreen(
        !!doc.fullscreenElement ||
          !!doc.webkitFullscreenElement ||
          !!video?.webkitDisplayingFullscreen
      );

    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler as EventListener);
    handler();

    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (centerIndicatorTimerRef.current) {
        clearTimeout(centerIndicatorTimerRef.current);
      }
    };
  }, []);

  // Auto-next episode countdown when video ends
  useEffect(() => {
    if (!videoEnded || !nextEpisode || !autoplayNextEpisode) return;

    let count = 5;
    setAutoNextCountdown(count);

    const intervalId = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(intervalId);
        countdownIntervalRef.current = null;
        setAutoNextCountdown(null);
        setVideoEnded(false);
        onEpisodeSelect?.(nextEpisode);
      } else {
        setAutoNextCountdown(count);
      }
    }, 1000);

    countdownIntervalRef.current = intervalId;
    return () => clearInterval(intervalId);
  }, [autoplayNextEpisode, videoEnded]); // eslint-disable-line

  const cancelAutoNext = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoNextCountdown(null);
    setVideoEnded(false);
  }, []);

  const handleNextEpisode = useCallback(() => {
    if (!nextEpisode) return;
    cancelAutoNext();
    onEpisodeSelect?.(nextEpisode);
  }, [nextEpisode, cancelAutoNext, onEpisodeSelect]);

  const handleSkipSegment = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeSegment) return;
    const target = activeSegment.endSec ?? video.duration;
    video.currentTime = Math.min(video.duration, target);
  }, [activeSegment]);

  useEffect(() => {
    if (!activeCaption?.url) {
      return;
    }

    let cancelled = false;

    fetch(activeCaption.url)
      .then((response) => response.text())
      .then((text) => {
        if (!cancelled) {
          setCaptionCues(parseCaptions(text));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCaptionCues([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCaption]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    localStorage.setItem("myflix-volume", String(volume));
  }, [volume]);

  const flashCenterIndicator = useCallback((type: "play" | "pause") => {
    setCenterIndicator(type);
    if (centerIndicatorTimerRef.current) {
      clearTimeout(centerIndicatorTimerRef.current);
    }
    centerIndicatorTimerRef.current = setTimeout(() => {
      setCenterIndicator(null);
    }, 650);
  }, []);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      flashCenterIndicator("play");
      video.play();
    } else {
      flashCenterIndicator("pause");
      video.pause();
    }
  }, [flashCenterIndicator]);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = vol;
    video.muted = false;
  }, []);

  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as FullscreenCapableDocument;
    const container = containerRef.current as FullscreenCapableElement | null;
    const video = videoRef.current as FullscreenCapableVideo | null;

    if (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      video?.webkitDisplayingFullscreen
    ) {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
          return;
        }
        if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
          return;
        }
        if (doc.webkitCancelFullScreen) {
          await doc.webkitCancelFullScreen();
          return;
        }
      } catch {
        return;
      }
    }

    if (!container && !video) return;

    try {
      if (container?.requestFullscreen) {
        await container.requestFullscreen();
        return;
      }
      if (container?.webkitRequestFullscreen) {
        await container.webkitRequestFullscreen();
        return;
      }
      if (container?.webkitRequestFullScreen) {
        await container.webkitRequestFullScreen();
        return;
      }
      if (video?.webkitSupportsFullscreen && video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch {
      // Ignore unsupported fullscreen failures.
    }
  }, []);

  const handlePipToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else {
      video.requestPictureInPicture();
    }
  }, []);

  const handleQualityChange = useCallback(
    (quality: string) => {
      const hls = hlsRef.current;
      if (hls) {
        if (quality === "auto") {
          hls.currentLevel = -1;
        } else {
          const targetHeight =
            quality === "4k"
              ? 2160
              : quality === "1080"
                ? 1080
                : quality === "720"
                  ? 720
                  : quality === "480"
                    ? 480
                    : quality === "360"
                      ? 360
                      : 0;

          const levelIdx = hls.levels.findIndex(
            (level) =>
              (targetHeight >= 2160 && level.height >= 2160) ||
              (targetHeight < 2160 &&
                level.height >= targetHeight &&
                level.height < targetHeight * 1.5)
          );

          if (levelIdx >= 0) hls.currentLevel = levelIdx;
        }
        setCurrentQuality(quality);
      } else if (playbackStream.type === "file" && playbackStream.qualities) {
        const entry = playbackStream.qualities[quality];
        if (entry && videoRef.current) {
          const fileHeaders = { ...playbackStream.preferredHeaders, ...playbackStream.headers };
          const nextUrl =
            Object.keys(fileHeaders).length > 0
              ? `/api/proxy?payload=${encodePayload({
                  url: entry.url,
                  type: "mp4",
                  headers: fileHeaders,
                  debugSessionId,
                })}`
              : entry.url;
          const wasPlaying = !videoRef.current.paused;
          const previousTime = videoRef.current.currentTime;
          videoRef.current.src = nextUrl;
          videoRef.current.currentTime = previousTime;
          if (wasPlaying) videoRef.current.play();
          setCurrentQuality(quality);
        }
      }
    },
    [playbackStream]
  );

  const cycleSpeed = useCallback(
    (direction: 1 | -1) => {
      const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
      const currentIndex = speeds.indexOf(playbackRate);
      const nextIndex = Math.max(
        0,
        Math.min(speeds.length - 1, (currentIndex >= 0 ? currentIndex : 3) + direction)
      );
      handleSpeedChange(speeds[nextIndex]);
    },
    [playbackRate, handleSpeedChange]
  );

  const handleSubtitleDelayChange = useCallback((delta: number) => {
    setSubtitleDelay((delay) => Math.round((delay + delta) * 10) / 10);
  }, []);

  const handleCustomCaptionLoad = useCallback(
    ({ fileName, text }: { fileName: string; text: string }) => {
      const customTrack: CaptionTrack = {
        id: "custom-caption",
        language: normalizeCaptionLanguage(fileName),
        label: formatCustomCaptionLabel(fileName),
        type: getCaptionFileType(fileName),
        source: "custom",
        content: text,
      };

      setCustomCaptionState({
        streamKey,
        tracks: [customTrack],
      });
      setActiveCaptionIdx((stream.captions || []).length);
    },
    [stream.captions, streamKey]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      resetIdleTimer();

      switch (e.key) {
        case " ": {
          e.preventDefault();
          if (!spaceHeldRef.current) {
            spaceHeldRef.current = true;
            spaceTimerRef.current = setTimeout(() => {
              preBoostSpeedRef.current = video.playbackRate;
              video.playbackRate = 2;
            }, 300);
          }
          break;
        }
        case "k":
        case "K":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "m":
        case "M":
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "n":
        case "N":
          if (showNavigation) {
            e.preventDefault();
            setShowControls(true);
            setShowEpisodePanel((prev) => !prev);
          }
          break;
        case "j":
        case "J":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "l":
        case "L":
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case "c":
        case "C":
          e.preventDefault();
          if (activeCaptionIdx >= 0) setActiveCaptionIdx(-1);
          else if (captions.length > 0) setActiveCaptionIdx(0);
          break;
        case ">":
          e.preventDefault();
          cycleSpeed(1);
          break;
        case "<":
          e.preventDefault();
          cycleSpeed(-1);
          break;
        case "[":
          e.preventDefault();
          setSubtitleDelay((delay) => Math.round((delay - 0.5) * 10) / 10);
          break;
        case "]":
          e.preventDefault();
          setSubtitleDelay((delay) => Math.round((delay + 0.5) * 10) / 10);
          break;
        default:
          if (e.key >= "0" && e.key <= "9") {
            e.preventDefault();
            video.currentTime = video.duration * (parseInt(e.key, 10) / 10);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== " ") return;

      e.preventDefault();
      const video = videoRef.current;
      if (!video) return;
      spaceHeldRef.current = false;

      if (spaceTimerRef.current) {
        clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = null;
        handlePlayPause();
      } else {
        video.playbackRate = preBoostSpeedRef.current;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    activeCaptionIdx,
    captions,
    cycleSpeed,
    handlePlayPause,
    resetIdleTimer,
    showNavigation,
    toggleFullscreen,
  ]);

  const handleVideoClick = useCallback(() => {
    if (Date.now() - lastTouchTimeRef.current < 600) return;
    handlePlayPause();
    resetIdleTimer();
  }, [handlePlayPause, resetIdleTimer]);

  const handleDoubleClick = useCallback(() => {
    if (Date.now() - lastTouchTimeRef.current < 600) return;
    toggleFullscreen();
  }, [toggleFullscreen]);

  const handleContainerTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (consumeNextContainerTouchRef.current) {
        consumeNextContainerTouchRef.current = false;
        return;
      }

      lastTouchTimeRef.current = Date.now();

      if (locked) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-player-ui]")) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const now = Date.now();
      const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
      const x = touch.clientX;
      const isLeftHalf = x < containerWidth / 2;
      const last = lastTapRef.current;

      if (last && now - last.time < 300 && Math.abs(x - last.x) < 80) {
        // Double-tap → seek
        lastTapRef.current = null;
        const video = videoRef.current;
        if (!video) return;
        if (isLeftHalf) {
          video.currentTime = Math.max(0, video.currentTime - 10);
          setDoubleTapInfo((prev) => ({ side: "left", key: (prev?.key ?? 0) + 1 }));
        } else {
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          setDoubleTapInfo((prev) => ({ side: "right", key: (prev?.key ?? 0) + 1 }));
        }
        setTimeout(() => setDoubleTapInfo(null), 700);
        setShowControls(true);
        resetIdleTimer();
      } else {
        // Single tap → toggle controls
        lastTapRef.current = { time: now, x };
        if (showControls) {
          setShowControls(false);
          if (idleTimer.current) clearTimeout(idleTimer.current);
        } else {
          setShowControls(true);
          resetIdleTimer();
        }
      }
    },
    [locked, showControls, resetIdleTimer]
  );

  const markControlsTouchInteraction = useCallback(() => {
    consumeNextContainerTouchRef.current = true;
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full select-none bg-black ${
        showControls ? "cursor-default" : "cursor-none"
      }`}
      onMouseMove={resetIdleTimer}
      onMouseLeave={() => playing && !showEpisodePanel && setShowControls(false)}
      onTouchEnd={handleContainerTouchEnd}
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        // AirPlay — allow the browser to route playback to AirPlay targets
        {...{ "x-webkit-airplay": "allow" }}
        onClick={handleVideoClick}
        onDoubleClick={handleDoubleClick}
      />

      {!isTouchDevice && showControls && (title || showNavigation) && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex flex-col bg-gradient-to-b from-black/75 via-black/25 to-transparent px-5 pb-10 pt-6 md:px-7 md:pt-7">
          <div className="pointer-events-auto min-w-0">
            <div className="flex items-center gap-2 text-sm text-white/75">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 transition hover:text-white"
              >
                <CaretLeft size={16} weight="bold" />
                <span>Home</span>
              </Link>
              <span className="text-white/35">/</span>
              {title && (
                <span className="truncate font-medium text-white">{title}</span>
              )}
            </div>
          </div>
          {showNavigation && currentEpisodeMeta && (
            <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 md:top-7">
              <p className="flex gap-2 items-center truncate rounded-full bg-black/35 px-3 py-1 text-sm font-bold text-white/85 backdrop-blur-sm">
                <span>S{showNavigation.currentSeason} - E{showNavigation.currentEpisode}</span>
                <span className="text-white/50 font-medium">{currentEpisodeMeta.name}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {showNavigation && showEpisodePanel && (
        isTouchDevice ? (
          <MobileEpisodeDrawer
            showNavigation={showNavigation}
            onClose={() => setShowEpisodePanel(false)}
            onEpisodeSelect={onEpisodeSelect}
          />
        ) : (
          <EpisodeNavigator
            showNavigation={showNavigation}
            onClose={() => setShowEpisodePanel(false)}
            onEpisodeSelect={onEpisodeSelect}
          />
        )
      )}

      {loading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        </div>
      )}

      {activeCaptionIdx >= 0 && visibleCaptionCues.length > 0 && (
        <SubtitleRenderer
          cues={visibleCaptionCues}
          currentTime={currentTime}
          delay={subtitleDelay}
          fontSize={subtitleFontSize}
          controlsVisible={showControls}
        />
      )}

      {/* Segment skip button — shown when inside an intro/recap/credits/preview */}
      {activeSegment && !videoEnded && (() => {
        // Credits that run to the end of video → show "Next Episode" if available
        const isEndingCredits =
          activeSegment.type === "credits" && activeSegment.endSec === null;

        if (isEndingCredits && nextEpisode) {
          return (
            <div className="absolute bottom-24 right-4 z-30 md:right-7">
              <button
                onClick={handleNextEpisode}
                className="flex items-center gap-2 rounded border border-white/50 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white hover:text-black"
              >
                Next Episode
                <CaretRight size={14} weight="bold" />
              </button>
            </div>
          );
        }

        const label =
          activeSegment.type === "intro" ? "Skip Intro"
          : activeSegment.type === "recap" ? "Skip Recap"
          : activeSegment.type === "credits" ? "Skip Credits"
          : "Skip Preview";

        return (
          <div className="absolute bottom-24 right-4 z-30 md:right-7">
            <button
              onClick={handleSkipSegment}
              className="flex items-center gap-2 rounded border border-white/50 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white hover:text-black"
            >
              {label}
              <CaretRight size={14} weight="bold" />
            </button>
          </div>
        );
      })()}

      {/* Auto-next countdown overlay */}
      {autoNextCountdown !== null && nextEpisode && (
        <div className="absolute bottom-24 right-4 z-30 flex flex-col items-end gap-2 md:right-7">
          <p className="text-sm text-white/70">
            Next episode in{" "}
            <span className="font-bold text-white">{autoNextCountdown}s</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={cancelAutoNext}
              className="rounded border border-white/40 bg-black/70 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleNextEpisode}
              className="flex items-center gap-1.5 rounded border border-white/50 bg-black/70 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white hover:text-black"
            >
              Play Now
              <CaretRight size={14} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {centerIndicator && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="animate-[fade-center_650ms_ease-out_forwards] rounded-full bg-black/55 p-5 text-white shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur-sm">
            {centerIndicator === "play" ? (
              <Play size={42} weight="fill" />
            ) : (
              <Pause size={42} weight="fill" />
            )}
          </div>
        </div>
      )}

      {!isTouchDevice && (
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <Controls
          videoRef={videoRef}
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          volume={volume}
          muted={muted}
          playbackRate={playbackRate}
          isFullscreen={isFullscreen}
          qualities={qualities}
          currentQuality={currentQuality}
          captions={captions}
          activeCaptionIdx={activeCaptionIdx}
          subtitleDelay={subtitleDelay}
          hasEpisodeSelector={!!showNavigation}
          isEpisodeSelectorOpen={showEpisodePanel}
          airPlayAvailable={airPlay.available}
          airPlayActive={airPlay.active}
          onAirPlayToggle={airPlay.toggleAirPlay}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onSpeedChange={handleSpeedChange}
          onFullscreenToggle={toggleFullscreen}
          onPipToggle={handlePipToggle}
          onQualityChange={handleQualityChange}
          onCaptionChange={setActiveCaptionIdx}
          onSubtitleDelayChange={handleSubtitleDelayChange}
          onCustomCaptionLoad={handleCustomCaptionLoad}
          onEpisodeSelectorToggle={() => {
            setShowControls(true);
            setShowEpisodePanel((prev) => !prev);
          }}
        />
      </div>
      )}

      {/* Mobile controls */}
      {isTouchDevice && (
      <div className={`absolute inset-0 transition-opacity duration-300 ${showControls && !locked ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <MobileControls
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          isFullscreen={isFullscreen}
          playbackRate={playbackRate}
          title={title}
          hasEpisodes={!!showNavigation}
          qualities={qualities}
          currentQuality={currentQuality}
          captions={captions}
          activeCaptionIdx={activeCaptionIdx}
          subtitleDelay={subtitleDelay}
          onTouchInteractionStart={markControlsTouchInteraction}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onLock={() => { setLocked(true); setShowControls(false); }}
          onFullscreenToggle={toggleFullscreen}
          onEpisodesToggle={() => { setShowControls(true); setShowEpisodePanel((prev) => !prev); }}
          onSpeedChange={handleSpeedChange}
          onQualityChange={handleQualityChange}
          onCaptionChange={setActiveCaptionIdx}
          onSubtitleDelayChange={handleSubtitleDelayChange}
        />
      </div>
      )}

      {/* Lock screen overlay — mobile only */}
      {isTouchDevice && locked && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <button
            type="button"
            onClick={() => { setLocked(false); setShowControls(true); resetIdleTimer(); }}
            data-player-ui
            className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/55 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm"
          >
            <Lock size={18} weight="fill" />
            Tap to unlock
          </button>
        </div>
      )}

      {/* Dev mode debug overlay */}
      {devMode && (
        <div className="absolute left-0 top-0 z-[999] max-w-[100vw] p-2" style={{ maxWidth: "100vw" }}>
          <div className="rounded-lg bg-black/85 p-2 font-mono text-[10px] leading-tight text-green-400 backdrop-blur-sm" style={{ maxWidth: "calc(100vw - 16px)" }}>
            <div className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-white/60">
              <span>engine: <span className="text-yellow-300">{hlsMode}</span></span>
              <span>touch: <span className="text-yellow-300">{String(isTouchDevice)}</span></span>
              <span>quality: <span className="text-yellow-300">{currentQuality}</span></span>
              <span>{Math.floor(currentTime)}s / {Math.floor(duration)}s</span>
              <span>buf: {Math.floor(buffered)}s</span>
              <span className={loading ? "text-red-400" : "text-green-400"}>{loading ? "loading" : "ready"}</span>
            </div>
            <div className="max-h-32 overflow-y-auto mb-1">
              {debugLog.map((line, i) => (
                <div key={i} className="text-green-300 break-all">{line}</div>
              ))}
              {debugLog.length === 0 && <div className="text-white/30">no logs yet</div>}
            </div>
            {manifestUrl && (
              <button
                type="button"
                onClick={() => fetchManifestPreview(manifestUrl)}
                className="mb-1 rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/80 active:bg-white/20"
              >
                Fetch Manifest
              </button>
            )}
            {manifestPreview && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded bg-black/60 p-1">
                <pre className="whitespace-pre-wrap break-all text-[9px] text-cyan-300">{manifestPreview}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Double-tap seek indicator — mobile only */}
      {isTouchDevice && doubleTapInfo && (
        <div
          key={doubleTapInfo.key}
          className={`pointer-events-none absolute top-1/2 z-30 -translate-y-1/2 ${
            doubleTapInfo.side === "left" ? "left-8" : "right-8"
          }`}
        >
          <div className="animate-[doubletap-ripple_650ms_ease-out_forwards] flex flex-col items-center gap-1">
            <div className="rounded-full bg-white/20 p-6">
              {doubleTapInfo.side === "left" ? (
                <Rewind size={28} weight="fill" className="text-white" />
              ) : (
                <FastForward size={28} weight="fill" className="text-white" />
              )}
            </div>
            <span className="text-xs font-semibold text-white drop-shadow">
              {doubleTapInfo.side === "left" ? "-10s" : "+10s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function encodePayload(payload: {
  url: string;
  type: string;
  headers: Record<string, string>;
  debugSessionId?: string;
}) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function formatCaptionLabel(language: string) {
  const normalized = normalizeCaptionLanguage(language);
  if (!normalized) return "Unknown";

  try {
    const displayName = new Intl.DisplayNames(["en"], { type: "language" }).of(normalized);
    return displayName || normalized.toUpperCase();
  } catch {
    return normalized.toUpperCase();
  }
}

function formatCustomCaptionLabel(fileName: string) {
  const language = formatCaptionLabel(fileName);
  return language === "Unknown" ? "Custom Subtitle" : `${language} Custom`;
}

function normalizeCaptionLanguage(value: string) {
  const base = value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .find((part) => LANGUAGE_ALIASES[part] || /^[a-z]{2,3}$/.test(part));

  if (!base) return "";
  return LANGUAGE_ALIASES[base] || base;
}

function getCaptionFileType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension || "subtitle";
}

function resolveCaptionType(url?: string, fallbackType?: string) {
  const fromUrl = getCaptionExtensionFromUrl(url);
  return fromUrl || fallbackType || "subtitle";
}

function getCaptionExtensionFromUrl(url?: string) {
  if (!url) return "";

  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase();
    return extension || "";
  } catch {
    const sanitizedUrl = url.split("?")[0].split("#")[0];
    const extension = sanitizedUrl.split(".").pop()?.toLowerCase();
    return extension || "";
  }
}

const LANGUAGE_ALIASES: Record<string, string> = {
  english: "en",
  eng: "en",
  spanish: "es",
  espanol: "es",
  espanollatino: "es",
  latino: "es",
  french: "fr",
  francais: "fr",
  german: "de",
  deutsch: "de",
  italian: "it",
  portuguese: "pt",
  portugues: "pt",
  brazilian: "pt",
  japanese: "ja",
  japan: "ja",
  korean: "ko",
  chinese: "zh",
  mandarin: "zh",
  arabic: "ar",
  hindi: "hi",
  russian: "ru",
  turkish: "tr",
  ukrainian: "uk",
  indonesian: "id",
  vietnamese: "vi",
  thai: "th",
  polish: "pl",
  dutch: "nl",
  swedish: "sv",
  norwegian: "no",
  danish: "da",
  finnish: "fi",
};
