"use client";

import { useEffect, useState } from "react";
import {
  CaretLeft,
  CaretRight,
  ClosedCaptioning,
  CornersIn,
  CornersOut,
  FastForward,
  Gear,
  Pause,
  PictureInPicture,
  Play,
  Queue,
  Rewind,
  SpeakerHigh,
  SpeakerLow,
  SpeakerSlash,
  UploadSimple,
} from "@phosphor-icons/react";
import ProgressBar from "./ProgressBar";
import type { CaptionTrack } from "./VideoPlayer";
import { formatTime, SPEED_OPTIONS } from "./utils";

type SettingsView = "main" | "quality" | "speed" | "captions";

interface ControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  qualities: string[];
  currentQuality: string;
  captions: CaptionTrack[];
  activeCaptionIdx: number;
  subtitleDelay: number;
  hasEpisodeSelector?: boolean;
  isEpisodeSelectorOpen?: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onMuteToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onFullscreenToggle: () => void;
  onPipToggle: () => void;
  onQualityChange: (quality: string) => void;
  onCaptionChange: (idx: number) => void;
  onSubtitleDelayChange: (delta: number) => void;
  onCustomCaptionLoad: (payload: { fileName: string; text: string }) => void;
  onEpisodeSelectorToggle?: () => void;
}

export default function Controls(props: ControlsProps) {
  const {
    playing,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    playbackRate,
    isFullscreen,
    qualities,
    currentQuality,
    captions,
    activeCaptionIdx,
    subtitleDelay,
    hasEpisodeSelector,
    isEpisodeSelectorOpen,
    onPlayPause,
    onSeek,
    onVolumeChange,
    onMuteToggle,
    onSpeedChange,
    onFullscreenToggle,
    onPipToggle,
    onQualityChange,
    onCaptionChange,
    onSubtitleDelayChange,
    onCustomCaptionLoad,
    onEpisodeSelectorToggle,
  } = props;

  const [showTimeRemaining, setShowTimeRemaining] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>("main");
  const [volumeHover, setVolumeHover] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-settings-panel]")) {
        setSettingsOpen(false);
        setSettingsView("main");
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  const timeText = showTimeRemaining && duration > 0
    ? `-${formatTime((duration - currentTime) / playbackRate)}`
    : formatTime(currentTime);

  const VolumeIcon =
    muted || volume === 0 ? SpeakerSlash : volume < 0.5 ? SpeakerLow : SpeakerHigh;

  const handleVolumeBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onVolumeChange(fraction);
  };

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      <div className="relative px-3 pb-2 md:px-4 md:pb-2.5">
        <div className="px-2.5 py-2 md:px-3 md:py-2.5">
        <div className="relative">
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            buffered={buffered}
            onSeek={onSeek}
          />
        </div>

        <div className="mt-1.5 flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-1 md:gap-1.5">
            <button
              onClick={onPlayPause}
              className="rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-white"
              title={playing ? "Pause (Space)" : "Play (Space)"}
            >
              {playing ? <Pause size={30} weight="fill" /> : <Play size={30} weight="fill" />}
            </button>

            <button
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              className="rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-white"
              title="Rewind 10s (J)"
            >
              <Rewind size={28} weight="fill" />
            </button>

            <button
              onClick={() => onSeek(Math.min(duration, currentTime + 10))}
              className="rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-white"
              title="Forward 10s (L)"
            >
              <FastForward size={28} weight="fill" />
            </button>

            <div
              className="flex items-center"
              onMouseEnter={() => setVolumeHover(true)}
              onMouseLeave={() => setVolumeHover(false)}
            >
              <button
                onClick={onMuteToggle}
                className="rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-white"
                title={muted ? "Unmute (M)" : "Mute (M)"}
              >
                <VolumeIcon size={30} weight="fill" />
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ${
                  volumeHover ? "ml-2 w-32 opacity-100" : "w-0 opacity-0"
                }`}
              >
                <div
                  className="relative mr-2 h-1.5 cursor-pointer rounded-full bg-white/30"
                  onClick={handleVolumeBarClick}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    style={{ width: `${muted ? 0 : volume * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow"
                    style={{ left: `calc(${muted ? 0 : volume * 100}% - 8px)` }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowTimeRemaining(!showTimeRemaining)}
              className="ml-2 select-none rounded-full px-2.5 py-1.5 font-sans text-sm text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              title="Toggle remaining time"
            >
              {timeText}
              {duration > 0 && !showTimeRemaining && (
                <span className="text-white/50"> / {formatTime(duration)}</span>
              )}
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1 md:gap-1.5">
            {playbackRate !== 1 && (
              <span className="mr-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
                {playbackRate}x
              </span>
            )}

            {hasEpisodeSelector && onEpisodeSelectorToggle && (
              <button
                onClick={onEpisodeSelectorToggle}
                className={`rounded-full p-2 transition-colors ${
                  isEpisodeSelectorOpen
                    ? "bg-red-500/20 text-rose-300 hover:bg-red-500/25"
                    : "text-white hover:bg-white/10 hover:text-white"
                }`}
                title="Seasons and episodes (N)"
              >
                <Queue size={28} weight={isEpisodeSelectorOpen ? "fill" : "regular"} />
              </button>
            )}

            <button
              onClick={() => {
                setSettingsOpen(true);
                setSettingsView("captions");
              }}
                className={`rounded-full p-2 transition-colors ${
                  activeCaptionIdx >= 0
                    ? "bg-red-500/20 text-rose-300 hover:bg-red-500/25"
                    : "text-white hover:bg-white/10 hover:text-white"
                }`}
                title="Captions (C)"
              >
              <ClosedCaptioning size={28} weight={activeCaptionIdx >= 0 ? "fill" : "regular"} />
            </button>

            <div className="relative" data-settings-panel>
              <button
                onClick={() => {
                  setSettingsOpen(!settingsOpen);
                  setSettingsView("main");
                }}
                className="rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-white"
                title="Settings"
              >
                <Gear size={28} weight="fill" />
              </button>

              {settingsOpen && (
                <SettingsPanel
                  view={settingsView}
                  setView={setSettingsView}
                  qualities={qualities}
                  currentQuality={currentQuality}
                  playbackRate={playbackRate}
                  captions={captions}
                  activeCaptionIdx={activeCaptionIdx}
                  subtitleDelay={subtitleDelay}
                  onQualityChange={(quality) => {
                    onQualityChange(quality);
                    setSettingsOpen(false);
                    setSettingsView("main");
                  }}
                  onSpeedChange={onSpeedChange}
                  onCaptionChange={(idx) => {
                    onCaptionChange(idx);
                    setSettingsOpen(false);
                    setSettingsView("main");
                  }}
                  onSubtitleDelayChange={onSubtitleDelayChange}
                  onCustomCaptionLoad={(payload) => {
                    onCustomCaptionLoad(payload);
                    setSettingsOpen(false);
                    setSettingsView("main");
                  }}
                />
              )}
            </div>

            {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
              <button
                onClick={onPipToggle}
                className="rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-white"
                title="Picture-in-Picture"
              >
                <PictureInPicture size={27} weight="fill" />
              </button>
            )}

            <button
              onClick={onFullscreenToggle}
              className="rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-white"
              title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
            >
              {isFullscreen ? (
                <CornersIn size={28} weight="bold" />
              ) : (
                <CornersOut size={28} weight="bold" />
              )}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  view,
  setView,
  qualities,
  currentQuality,
  playbackRate,
  captions,
  activeCaptionIdx,
  subtitleDelay,
  onQualityChange,
  onSpeedChange,
  onCaptionChange,
  onSubtitleDelayChange,
  onCustomCaptionLoad,
}: {
  view: SettingsView;
  setView: (v: SettingsView) => void;
  qualities: string[];
  currentQuality: string;
  playbackRate: number;
  captions: CaptionTrack[];
  activeCaptionIdx: number;
  subtitleDelay: number;
  onQualityChange: (q: string) => void;
  onSpeedChange: (s: number) => void;
  onCaptionChange: (idx: number) => void;
  onSubtitleDelayChange: (delta: number) => void;
  onCustomCaptionLoad: (payload: { fileName: string; text: string }) => void;
}) {
  const qualityLabel = currentQuality === "auto" ? "Auto" : `${currentQuality}p`;
  const captionLabel = activeCaptionIdx < 0 ? "Off" : captions[activeCaptionIdx]?.label || "On";
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleSubtitleUpload = async (file?: File | null) => {
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["srt", "vtt"].includes(extension)) {
      setUploadError("Use an .srt or .vtt subtitle file.");
      return;
    }

    try {
      const text = await file.text();
      onCustomCaptionLoad({ fileName: file.name, text });
      setUploadError(null);
    } catch {
      setUploadError("Subtitle file could not be read.");
    }
  };

  return (
    <div
      className="absolute bottom-16 right-0 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#111111]/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      data-settings-panel
    >
      {view === "main" && (
        <div className="py-1">
          <SettingsRow label="Quality" value={qualityLabel} onClick={() => setView("quality")} />
          <SettingsRow label="Speed" value={`${playbackRate}x`} onClick={() => setView("speed")} />
          <SettingsRow label="Captions" value={captionLabel} onClick={() => setView("captions")} />
        </div>
      )}

      {view === "quality" && (
        <div className="py-1">
          <button
            onClick={() => setView("main")}
            className="flex w-full items-center gap-1.5 px-4 py-3 text-sm text-white/70 hover:bg-white/10"
          >
            <CaretLeft size={16} weight="bold" />
            Quality
          </button>
          <div className="border-t border-white/10" />
          <button
            onClick={() => onQualityChange("auto")}
            className={`w-full px-4 py-3 text-left text-sm hover:bg-white/10 ${
              currentQuality === "auto" ? "font-medium text-rose-300" : "text-white"
            }`}
          >
            Auto
          </button>
          {qualities.map((quality) => (
            <button
              key={quality}
              onClick={() => onQualityChange(quality)}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-white/10 ${
                currentQuality === quality ? "font-medium text-rose-300" : "text-white"
              }`}
            >
              {quality === "4k" ? "4K" : `${quality}p`}
            </button>
          ))}
        </div>
      )}

      {view === "speed" && (
        <div className="py-1">
          <button
            onClick={() => setView("main")}
            className="flex w-full items-center gap-1.5 px-4 py-3 text-sm text-white/70 hover:bg-white/10"
          >
            <CaretLeft size={16} weight="bold" />
            Speed
          </button>
          <div className="border-t border-white/10" />
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-white/10 ${
                playbackRate === speed ? "font-medium text-rose-300" : "text-white"
              }`}
            >
              {speed === 1 ? "Normal" : `${speed}x`}
            </button>
          ))}
        </div>
      )}

      {view === "captions" && (
        <div className="py-1">
          <button
            onClick={() => setView("main")}
            className="flex w-full items-center gap-1.5 px-4 py-3 text-sm text-white/70 hover:bg-white/10"
          >
            <CaretLeft size={16} weight="bold" />
            Captions
          </button>
          <div className="border-t border-white/10" />

          <div className="player-subtitles-scroll max-h-[18rem] overflow-y-auto">
            <button
              onClick={() => onCaptionChange(-1)}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-white/10 ${
                activeCaptionIdx < 0 ? "font-medium text-rose-300" : "text-white"
              }`}
            >
              Off
            </button>
            <label className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm text-white transition-colors hover:bg-white/10">
              <UploadSimple size={18} weight="bold" />
              <span>Upload subtitle</span>
              <input
                type="file"
                accept=".srt,.vtt,text/vtt,application/x-subrip"
                className="hidden"
                onChange={(event) => {
                  void handleSubtitleUpload(event.target.files?.[0] || null);
                  event.target.value = "";
                }}
              />
            </label>
            {uploadError && (
              <div className="px-4 pb-2 text-xs text-rose-300">{uploadError}</div>
            )}
            {captions.map((caption, index) => (
              <button
                key={caption.id}
                onClick={() => onCaptionChange(index)}
                className={`w-full px-4 py-3 text-left text-sm hover:bg-white/10 ${
                  activeCaptionIdx === index ? "font-medium text-rose-300" : "text-white"
                }`}
              >
                {caption.label || `Caption ${index + 1}`}
                <span className="ml-2 text-xs uppercase text-white/40">{caption.type}</span>
                {caption.source === "custom" && (
                  <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-white/30">
                    Custom
                  </span>
                )}
              </button>
            ))}
            {captions.length === 0 && (
              <div className="px-4 py-3 text-sm text-white/40">No captions available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between px-4 py-3 text-sm text-white transition-colors hover:bg-white/10"
    >
      <span>{label}</span>
      <span className="flex items-center gap-1 text-white/50">
        {value}
        <CaretRight size={16} weight="bold" />
      </span>
    </button>
  );
}
