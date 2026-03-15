"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react";
import { useSkipSegments } from "./hooks/useSkipSegments";
import Hls from "hls.js";
import type { TMDBEpisode, TMDBSeason } from "@/lib/tmdb";
import Controls from "./Controls";
import EpisodeNavigator from "./EpisodeNavigator";
import SubtitleRenderer, { CaptionCue, parseCaptions } from "./SubtitleRenderer";
import { QUALITY_ORDER } from "./utils";

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
}

interface VideoPlayerProps {
  stream: StreamData;
  onError?: (msg: string) => void;
  title?: string;
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
}

export default function VideoPlayer({
  stream,
  onError,
  title,
  showNavigation,
  onEpisodeSelect,
  initialPosition,
  onProgressUpdate,
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
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [subtitleFontSize] = useState(100);
  const [centerIndicator, setCenterIndicator] = useState<"play" | "pause" | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spaceHeldRef = useRef(false);
  const spaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preBoostSpeedRef = useRef(1);
  const centerIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamKey = useMemo(
    () => JSON.stringify([stream.type, stream.playlist, stream.qualities, stream.captions]),
    [stream]
  );

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

    queueMicrotask(() => {
      setLoading(true);
      setQualities([]);
      setCurrentQuality("auto");
    });

    if (stream.type === "hls" && stream.playlist) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: 120,
          maxMaxBufferLength: 240,
          fragLoadingMaxRetry: 10,
          fragLoadingRetryDelay: 1000,
          renderTextTracksNatively: false,
          xhrSetup: (xhr) => {
            const headers = {
              ...stream.preferredHeaders,
              ...stream.headers,
            };
            for (const [key, value] of Object.entries(headers)) {
              try {
                xhr.setRequestHeader(key, value);
              } catch {
                // Some headers can't be set.
              }
            }
          },
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, _data) => {
          if (initialPosition && initialPosition > 5) {
            video.currentTime = initialPosition;
          }
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
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
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            onError?.(`Playback error: ${data.type}`);
          }
        });

        hls.loadSource(stream.playlist);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = stream.playlist;
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
      } else {
        onError?.("HLS is not supported in this browser.");
      }
    } else if (stream.type === "file" && stream.qualities) {
      const available: string[] = [];
      let bestUrl = "";
      for (const q of QUALITY_ORDER) {
        const entry = stream.qualities[q];
        if (entry) {
          available.push(q);
          if (!bestUrl) bestUrl = entry.url;
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
  }, [stream, onError]);

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

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
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
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
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
    if (!videoEnded || !nextEpisode) return;

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
  }, [videoEnded]); // eslint-disable-line

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

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else container.requestFullscreen();
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
      } else if (stream.type === "file" && stream.qualities) {
        const entry = stream.qualities[quality];
        if (entry && videoRef.current) {
          const wasPlaying = !videoRef.current.paused;
          const previousTime = videoRef.current.currentTime;
          videoRef.current.src = entry.url;
          videoRef.current.currentTime = previousTime;
          if (wasPlaying) videoRef.current.play();
          setCurrentQuality(quality);
        }
      }
    },
    [stream]
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
    handlePlayPause();
    resetIdleTimer();
  }, [handlePlayPause, resetIdleTimer]);

  const handleDoubleClick = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full select-none bg-black ${
        showControls ? "cursor-default" : "cursor-none"
      }`}
      onMouseMove={resetIdleTimer}
      onMouseLeave={() => playing && !showEpisodePanel && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        onClick={handleVideoClick}
        onDoubleClick={handleDoubleClick}
      />

      {showControls && (title || showNavigation) && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 bg-gradient-to-b from-black/75 via-black/25 to-transparent px-5 pb-10 pt-6 md:px-7 md:pt-7">
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
        <EpisodeNavigator
          showNavigation={showNavigation}
          onClose={() => setShowEpisodePanel(false)}
          onEpisodeSelect={onEpisodeSelect}
        />
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
    </div>
  );
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
