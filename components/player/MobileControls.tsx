"use client";

import { useMemo, useState, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CaretLeft,
  CaretRight,
  ClosedCaptioning,
  CornersIn,
  CornersOut,
  FastForward,
  Gear,
  LockOpen,
  Pause,
  Play,
  Queue,
  Rewind,
  X,
} from "@phosphor-icons/react";
import ProgressBar from "./ProgressBar";
import type { CaptionTrack } from "./VideoPlayer";
import { formatTime, SPEED_OPTIONS } from "./utils";

type SettingsView = "main" | "quality" | "speed" | "captions";

interface MobileControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  isFullscreen: boolean;
  playbackRate: number;
  title?: string;
  hasEpisodes: boolean;
  qualities: string[];
  currentQuality: string;
  captions: CaptionTrack[];
  activeCaptionIdx: number;
  subtitleDelay: number;
  onTouchInteractionStart: () => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onLock: () => void;
  onFullscreenToggle: () => void;
  onEpisodesToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onQualityChange: (quality: string) => void;
  onCaptionChange: (idx: number) => void;
  onSubtitleDelayChange: (delta: number) => void;
}

export default function MobileControls({
  playing,
  currentTime,
  duration,
  buffered,
  isFullscreen,
  playbackRate,
  title,
  hasEpisodes,
  qualities,
  currentQuality,
  captions,
  activeCaptionIdx,
  subtitleDelay,
  onTouchInteractionStart,
  onPlayPause,
  onSeek,
  onLock,
  onFullscreenToggle,
  onEpisodesToggle,
  onSpeedChange,
  onQualityChange,
  onCaptionChange,
  onSubtitleDelayChange,
}: MobileControlsProps) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>("main");

  const touchButtonClass =
    "inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-black/50 text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur-sm transition active:scale-[0.98] active:bg-black/70";

  const qualityLabel = currentQuality === "auto" ? "Auto" : `${currentQuality}p`;
  const captionLabel = activeCaptionIdx < 0 ? "Off" : (captions[activeCaptionIdx]?.label ?? "On");
  const sheetTitle = useMemo(() => {
    switch (settingsView) {
      case "quality":
        return "Quality";
      case "speed":
        return "Playback Speed";
      case "captions":
        return "Captions";
      default:
        return "Playback Settings";
    }
  }, [settingsView]);

  function stopEvent(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  function withStop<T extends React.SyntheticEvent>(handler: () => void) {
    return (e: T) => {
      e.stopPropagation();
      handler();
    };
  }

  function withTouchStartAction(handler: () => void) {
    return (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onTouchInteractionStart();
      handler();
    };
  }

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <div
      data-player-ui
      className="pointer-events-auto absolute inset-0 z-20"
      onTouchStartCapture={onTouchInteractionStart}
      onPointerDownCapture={onTouchInteractionStart}
    >
      <div
        data-player-ui
        className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/85 via-black/35 to-transparent px-3 pb-16 pt-[max(env(safe-area-inset-top),0.9rem)]"
        onClick={stopEvent}
        onTouchEnd={stopEvent}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={withStop(handleBack)}
            onTouchStart={withTouchStartAction(handleBack)}
            onTouchEnd={stopEvent}
            className={`${touchButtonClass} flex-shrink-0`}
            aria-label="Go back"
          >
            <CaretLeft size={22} weight="bold" />
          </button>
          {title && (
            <p className="flex-1 truncate text-center text-sm font-medium text-white">{title}</p>
          )}
          <button
            type="button"
            onClick={withStop(onLock)}
            onTouchStart={withTouchStartAction(onLock)}
            onTouchEnd={stopEvent}
            className={`${touchButtonClass} flex-shrink-0`}
            aria-label="Lock controls"
          >
            <LockOpen size={22} />
          </button>
        </div>
      </div>

      <div
        data-player-ui
        className="absolute inset-0 flex items-center justify-center"
        onClick={stopEvent}
        onTouchEnd={stopEvent}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={withStop(() => onSeek(Math.max(0, currentTime - 10)))}
            onTouchEnd={stopEvent}
            className={`${touchButtonClass} min-h-14 min-w-14`}
            aria-label="Rewind 10 seconds"
          >
            <Rewind size={26} weight="fill" />
          </button>
          <button
            type="button"
            onClick={withStop(onPlayPause)}
            onTouchEnd={stopEvent}
            className={`${touchButtonClass} min-h-18 min-w-18`}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={42} weight="fill" /> : <Play size={42} weight="fill" />}
          </button>
          <button
            type="button"
            onClick={withStop(() => onSeek(Math.min(duration || currentTime + 10, currentTime + 10)))}
            onTouchEnd={stopEvent}
            className={`${touchButtonClass} min-h-14 min-w-14`}
            aria-label="Forward 10 seconds"
          >
            <FastForward size={26} weight="fill" />
          </button>
        </div>
      </div>

      <div
        data-player-ui
        className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-16"
        onClick={stopEvent}
        onTouchEnd={stopEvent}
      >
        <div className="rounded-2xl bg-black/25 px-3 py-2 backdrop-blur-[10px]">
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            buffered={buffered}
            onSeek={onSeek}
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="min-w-0 text-xs font-medium text-white/80">
              {formatTime(currentTime)}
              {duration > 0 && (
                <span className="text-white/45"> / {formatTime(duration)}</span>
              )}
            </span>

            <div className="flex items-center gap-2">
              {hasEpisodes && (
                <button
                  type="button"
                  onClick={withStop(onEpisodesToggle)}
                  onTouchEnd={stopEvent}
                  className={touchButtonClass}
                  aria-label="Episodes"
                >
                  <Queue size={22} weight="fill" />
                </button>
              )}
              <button
                type="button"
                onClick={withStop(() => {
                  setSettingsOpen(true);
                  setSettingsView("captions");
                })}
                onTouchEnd={stopEvent}
                className={`${touchButtonClass} ${activeCaptionIdx >= 0 ? "ring-1 ring-rose-300/70" : ""}`}
                aria-label="Captions"
              >
                <ClosedCaptioning size={22} weight={activeCaptionIdx >= 0 ? "fill" : "regular"} />
              </button>
              <button
                type="button"
                onClick={withStop(() => {
                  setSettingsOpen((prev) => !prev);
                  setSettingsView("main");
                })}
                onTouchEnd={stopEvent}
                className={touchButtonClass}
                aria-label="Settings"
              >
                <Gear size={22} weight="fill" />
              </button>
              <button
                type="button"
                onClick={withStop(onFullscreenToggle)}
                onTouchEnd={stopEvent}
                className={touchButtonClass}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <CornersIn size={22} weight="bold" />
                ) : (
                  <CornersOut size={22} weight="bold" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <button
          type="button"
          aria-label="Close settings"
          className="absolute inset-0 z-30 bg-black/40"
          onClick={withStop(() => setSettingsOpen(false))}
          onTouchEnd={stopEvent}
        />
      )}

      {settingsOpen && (
        <div
          data-player-ui
          className="absolute bottom-[calc(max(env(safe-area-inset-bottom),1rem)+5.75rem)] right-3 z-40 w-72 max-h-[min(24rem,60vh)] overflow-hidden rounded-3xl border border-white/10 bg-[#101010]/95 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl flex flex-col"
          onClick={stopEvent}
          onTouchEnd={stopEvent}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              {settingsView !== "main" && (
                <button
                  type="button"
                  onClick={withStop(() => setSettingsView("main"))}
                  onTouchEnd={stopEvent}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-white/6 text-white"
                >
                  <CaretLeft size={18} weight="bold" />
                </button>
              )}
              <p className="text-sm font-semibold text-white">{sheetTitle}</p>
            </div>
            <button
              type="button"
              onClick={withStop(() => setSettingsOpen(false))}
              onTouchEnd={stopEvent}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-white/6 text-white"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          {settingsView === "main" && (
            <div className="overflow-y-auto p-2">
              <MobileSettingsRow
                label="Quality"
                value={qualityLabel}
                onPress={() => setSettingsView("quality")}
              />
              <MobileSettingsRow
                label="Playback Speed"
                value={`${playbackRate}x`}
                onPress={() => setSettingsView("speed")}
              />
              <MobileSettingsRow
                label="Captions"
                value={captionLabel}
                onPress={() => setSettingsView("captions")}
              />
            </div>
          )}

          {settingsView === "quality" && (
            <div className="max-h-72 overflow-y-auto p-2">
              <MobileOptionRow
                active={currentQuality === "auto"}
                label="Auto"
                onPress={() => {
                  onQualityChange("auto");
                  setSettingsOpen(false);
                }}
              />
              {qualities.map((quality) => (
                <MobileOptionRow
                  key={quality}
                  active={currentQuality === quality}
                  label={quality === "4k" ? "4K" : `${quality}p`}
                  onPress={() => {
                    onQualityChange(quality);
                    setSettingsOpen(false);
                  }}
                />
              ))}
            </div>
          )}

          {settingsView === "speed" && (
            <div className="max-h-72 overflow-y-auto p-2">
              {SPEED_OPTIONS.map((speed) => (
                <MobileOptionRow
                  key={speed}
                  active={playbackRate === speed}
                  label={`${speed}x`}
                  onPress={() => {
                    onSpeedChange(speed);
                    setSettingsOpen(false);
                  }}
                />
              ))}
            </div>
          )}

          {settingsView === "captions" && (
            <div className="space-y-3 overflow-y-auto p-3">
              <div className="rounded-2xl bg-white/5 p-1">
                <MobileOptionRow
                  active={activeCaptionIdx < 0}
                  label="Off"
                  onPress={() => {
                    onCaptionChange(-1);
                    setSettingsOpen(false);
                  }}
                />
                {captions.map((caption, idx) => (
                  <MobileOptionRow
                    key={caption.id}
                    active={activeCaptionIdx === idx}
                    label={caption.label}
                    onPress={() => {
                      onCaptionChange(idx);
                      setSettingsOpen(false);
                    }}
                  />
                ))}
                {captions.length === 0 && (
                  <p className="px-4 py-3 text-sm text-white/45">
                    No captions available for this source.
                  </p>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MobileSettingsRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-white transition active:bg-white/10"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2 text-sm text-white/60">
        {value}
        <CaretRight size={16} weight="bold" />
      </span>
    </button>
  );
}

function MobileOptionRow({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition active:bg-white/10 ${
        active ? "bg-rose-500/15 font-semibold text-rose-300" : "text-white"
      }`}
    >
      <span>{label}</span>
    </button>
  );
}
