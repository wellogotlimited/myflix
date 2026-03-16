"use client";

import Image from "next/image";
import {
  ArrowClockwise,
  CaretLeft,
  FilmSlate,
  House,
  WarningCircle,
} from "@phosphor-icons/react";
import { backdropUrl, posterUrl } from "@/lib/tmdb";
import type { SourceStatus } from "./ProviderStatus";

interface WatchErrorStateProps {
  error: string;
  title?: string;
  subtitle?: string;
  backdropPath?: string | null;
  posterPath?: string | null;
  sources: SourceStatus[];
  onRetry: () => void;
  onBack: () => void;
  onHome: () => void;
}

const STATUS_STYLES: Record<SourceStatus["status"], string> = {
  pending: "border-white/10 bg-white/5 text-white/45",
  running: "border-white/20 bg-white/10 text-white",
  success: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
  failure: "border-red-400/30 bg-red-400/12 text-red-200",
  notfound: "border-white/10 bg-white/5 text-white/55",
};

function prettifySourceId(id: string) {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function WatchErrorState({
  error,
  title,
  subtitle,
  backdropPath,
  posterPath,
  sources,
  onRetry,
  onBack,
  onHome,
}: WatchErrorStateProps) {
  const failedCount = sources.filter(
    (source) => source.status === "failure" || source.status === "notfound"
  ).length;
  const runningCount = sources.filter((source) => source.status === "running").length;
  const backdrop = backdropPath ? backdropUrl(backdropPath, "w1280") : null;
  const poster = posterPath ? posterUrl(posterPath, "w342") : null;
  const sourceSummary = sources.length
    ? `We checked ${failedCount || sources.length} source${failedCount === 1 ? "" : "s"} and couldn't find the video you're looking for.`
    : "We couldn't find a playable source for this title right now.";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#060606] text-white">
      {backdrop ? (
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center opacity-35 blur-md"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.22),transparent_35%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/82 to-black" />

      <div className="relative flex h-full flex-col px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),1rem)] md:px-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/14 bg-black/45 px-4 text-sm font-medium text-white shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-white/25 hover:bg-black/60"
          >
            <CaretLeft size={18} weight="bold" />
            Back
          </button>

          <button
            type="button"
            onClick={onHome}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 text-sm font-medium text-white/85 backdrop-blur-md transition hover:border-white/20 hover:bg-white/12"
          >
            <House size={18} weight="fill" />
            Home
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center py-8 md:py-12">
          <div className="grid w-full items-center gap-8 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:gap-10">
            <div className="hidden md:block">
              <div className="mx-auto max-w-[240px] overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
                {poster ? (
                  <div className="relative aspect-[2/3] w-full">
                    <Image src={poster} alt="" fill sizes="240px" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center bg-white/5 text-white/30">
                    <FilmSlate size={58} />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">

              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white md:text-5xl">
                  No working sources found
                </h1>
                {title ? (
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-white/92 md:text-2xl">{title}</p>
                    {subtitle ? (
                      <p className="text-sm font-medium text-white/55 md:text-base">{subtitle}</p>
                    ) : null}
                  </div>
                ) : null}
                <p className="max-w-2xl text-sm leading-6 text-white/68 md:text-base">
                  {sourceSummary} Retry the scan, go back to the title, or jump home and try something else.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  <ArrowClockwise size={18} weight="bold" />
                  Retry sources
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/16 bg-white/6 px-5 text-sm font-semibold text-white transition hover:border-white/26 hover:bg-white/10"
                >
                  <CaretLeft size={18} weight="bold" />
                  Go back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
