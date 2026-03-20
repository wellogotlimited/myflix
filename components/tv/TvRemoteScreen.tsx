"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  CaretLeft,
  ClosedCaptioning,
  FastForward,
  Pause,
  Play,
  Queue,
  Rewind,
  TelevisionSimple,
} from "@phosphor-icons/react";
import type { TMDBEpisode, TMDBSeason } from "@/lib/tmdb";
import { backdropUrl, posterUrl } from "@/lib/tmdb";
import type { TvReceiverStatusPayload } from "@/lib/tv-remote";
import ProgressBar from "@/components/player/ProgressBar";
import MobileEpisodeDrawer from "@/components/player/MobileEpisodeDrawer";
import { formatTime } from "@/components/player/utils";

interface ShowNavigation {
  showId: string;
  seasons: TMDBSeason[];
  episodes: TMDBEpisode[];
  currentSeason: number;
  currentEpisode: number;
}

export default function TvRemoteScreen({
  title,
  subtitle,
  posterPath,
  backdropPath,
  showNavigation,
  remoteStatus,
  launchState,
  error,
  onBack,
  onTogglePlay,
  onSetCaption,
  onSeekBy,
  onSeekTo,
  onEpisodeSelect,
}: {
  title: string;
  subtitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  showNavigation?: ShowNavigation;
  remoteStatus: TvReceiverStatusPayload | null;
  launchState: "idle" | "sending" | "sent";
  error: string | null;
  onBack: () => void;
  onTogglePlay: () => void;
  onSetCaption: (captionIndex: number) => void;
  onSeekBy: (delta: number) => void;
  onSeekTo: (positionSec: number) => void;
  onEpisodeSelect?: (payload: {
    seasonNumber: number;
    episode: TMDBEpisode;
    episodes: TMDBEpisode[];
  }) => void;
}) {
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasEpisodes = Boolean(showNavigation && onEpisodeSelect);

  useEffect(() => {
    if (!remoteStatus?.isPlaying) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [remoteStatus?.isPlaying]);

  const currentDuration = remoteStatus?.durationSec ?? 0;
  const displayTime = useMemo(() => {
    if (!remoteStatus?.updatedAt) {
      return remoteStatus?.currentTimeSec ?? 0;
    }

    if (!remoteStatus.isPlaying) {
      return remoteStatus.currentTimeSec;
    }

    const elapsed =
      (nowMs - new Date(remoteStatus.updatedAt).getTime()) / 1000;
    const nextTime = remoteStatus.currentTimeSec + Math.max(0, elapsed);

    if (currentDuration > 0) {
      return Math.min(currentDuration, nextTime);
    }

    return nextTime;
  }, [currentDuration, nowMs, remoteStatus]);

  const titleText = remoteStatus?.title || title;
  const captionsAvailable = remoteStatus?.captionsAvailable ?? false;
  const captionsEnabled = remoteStatus?.captionsEnabled ?? false;
  const captionTracks = remoteStatus?.captions ?? [];
  const activeCaptionIndex = remoteStatus?.activeCaptionIndex ?? -1;
  const statusText =
    launchState === "sending"
      ? "Starting on your TV"
      : remoteStatus?.isPlaying
        ? "Playing on your TV"
        : "Ready on your TV";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {backdropPath ? (
        <Image
          src={backdropUrl(backdropPath, "w1280")}
          alt=""
          fill
          priority
          className="object-cover opacity-30"
        />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_26%),linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.82)_38%,#050505_100%)]" />

      <div className="relative flex min-h-screen flex-col px-4 pb-8 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-white/88 backdrop-blur-sm"
            aria-label="Go back"
          >
            <CaretLeft size={22} weight="bold" />
          </button>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-xs text-white/64 backdrop-blur-sm">
            <TelevisionSimple size={16} weight="fill" />
            <span>{statusText}</span>
          </div>
        </div>

        <div className="mt-10 flex items-start gap-4">
          <div className="relative h-32 w-[5.9rem] flex-shrink-0 overflow-hidden rounded-2xl bg-white/6">
            {posterPath ? (
              <Image
                src={posterUrl(posterPath, "w342")}
                alt={titleText}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <p className="text-[0.7rem] uppercase tracking-[0.24em] text-white/38">
              Remote Control
            </p>
            <h1 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-white/95">
              {titleText}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm text-white/52">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-auto">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <div className="relative">
              <ProgressBar
                currentTime={displayTime}
                duration={currentDuration}
                buffered={displayTime}
                onSeek={onSeekTo}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-white/48">
              <span>{formatTime(displayTime)}</span>
              <span>{currentDuration > 0 ? formatTime(currentDuration) : "--:--"}</span>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => onSeekBy(-10)}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/8 text-white/88"
                aria-label="Rewind 10 seconds"
              >
                <Rewind size={26} weight="fill" />
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white text-black shadow-[0_18px_45px_rgba(255,255,255,0.18)]"
                aria-label={remoteStatus?.isPlaying ? "Pause" : "Play"}
              >
                {remoteStatus?.isPlaying ? (
                  <Pause size={34} weight="fill" />
                ) : (
                  <Play size={34} weight="fill" className="translate-x-[2px]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onSeekBy(10)}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/8 text-white/88"
                aria-label="Forward 10 seconds"
              >
                <FastForward size={26} weight="fill" />
              </button>
            </div>

            {hasEpisodes ? (
              <button
                type="button"
                onClick={() => setEpisodesOpen(true)}
                className="mt-6 flex w-full items-center justify-between rounded-2xl bg-white/7 px-4 py-4 text-left text-sm text-white/82"
              >
                <span>Select Episode</span>
                <Queue size={20} weight="fill" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setCaptionsOpen(true)}
              disabled={!captionsAvailable}
              className={`mt-3 flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm transition ${
                captionsAvailable
                  ? captionsEnabled
                    ? "bg-white text-black"
                    : "bg-white/7 text-white/82"
                  : "bg-white/5 text-white/35"
              }`}
            >
              <span>Captions</span>
              <span className="flex items-center gap-2">
                <span>{captionsAvailable ? (captionsEnabled ? "On" : "Off") : "Unavailable"}</span>
                <ClosedCaptioning size={20} weight={captionsEnabled ? "fill" : "regular"} />
              </span>
            </button>

            {error ? (
              <p className="mt-4 text-sm text-red-300">{error}</p>
            ) : null}
          </div>
        </div>
      </div>

      {episodesOpen && showNavigation && onEpisodeSelect ? (
        <MobileEpisodeDrawer
          showNavigation={showNavigation}
          onClose={() => setEpisodesOpen(false)}
          onEpisodeSelect={onEpisodeSelect}
        />
      ) : null}
      {captionsOpen ? (
        <>
          <button
            type="button"
            aria-label="Close captions"
            className="fixed inset-0 z-40 bg-black/55"
            onClick={() => setCaptionsOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t border-white/10 bg-[#0d0d0d] p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-medium text-white">Captions</h2>
              <ClosedCaptioning size={20} className="text-white/55" />
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  onSetCaption(-1);
                  setCaptionsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm ${
                  activeCaptionIndex < 0 ? "bg-white text-black" : "bg-white/7 text-white/82"
                }`}
              >
                <span>Off</span>
              </button>
              {captionTracks.map((track) => (
                <button
                  key={track.index}
                  type="button"
                  onClick={() => {
                    onSetCaption(track.index);
                    setCaptionsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm ${
                    activeCaptionIndex === track.index
                      ? "bg-white text-black"
                      : "bg-white/7 text-white/82"
                  }`}
                >
                  <span>{track.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
