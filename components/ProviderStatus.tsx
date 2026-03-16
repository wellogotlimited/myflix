"use client";

import { useMemo } from "react";

export interface SourceStatus {
  id: string;
  status: "pending" | "running" | "success" | "failure" | "notfound";
}

interface ProviderStatusProps {
  sources: SourceStatus[];
  backdropPath?: string | null;
  title?: string;
  subtitle?: string;
}

function statusMessage(sources: SourceStatus[]): string {
  if (!sources.length) return "Finding a source…";
  const success = sources.filter((s) => s.status === "success").length;
  const running = sources.filter((s) => s.status === "running").length;
  const done = sources.filter(
    (s) => s.status === "failure" || s.status === "notfound"
  ).length;

  if (success > 0) return "Got one, loading…";
  if (running > 0) return `Checking sources…`;
  if (done > 0 && done < sources.length) return `Tried ${done}, still looking…`;
  return "Finding a source…";
}

const DOT_COLORS: Record<SourceStatus["status"], string> = {
  pending: "bg-white/15",
  running: "bg-white",
  success: "bg-emerald-400",
  notfound: "bg-white/10",
  failure: "bg-red-400/40",
};

export default function ProviderStatus({
  sources,
  backdropPath,
  title,
  subtitle,
}: ProviderStatusProps) {
  const tried = sources.filter((s) => s.status !== "pending").length;
  const progress = sources.length > 0 ? Math.max(6, (tried / sources.length) * 100) : 8;
  const message = useMemo(() => statusMessage(sources), [sources]);
  const backdropUrl = backdropPath
    ? `https://image.tmdb.org/t/p/w1280${backdropPath}`
    : null;

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-black">
      {backdropUrl && (
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center blur-sm"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50" />

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          {title && (
            <h1 className="mb-1 truncate text-2xl font-bold tracking-tight text-white md:text-3xl">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mb-6 text-sm font-medium text-white/50">{subtitle}</p>
          )}
          {!subtitle && title && <div className="mb-6" />}

          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            {message}
          </p>

          <div className="mb-5 h-[3px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/70 transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {sources.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {sources.map((source) => (
                <span
                  key={source.id}
                  title={source.id}
                  className={`h-2 w-2 rounded-full transition-colors duration-300 ${DOT_COLORS[source.status]} ${
                    source.status === "running" ? "animate-pulse" : ""
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
