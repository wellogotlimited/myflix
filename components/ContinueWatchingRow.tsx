"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useProfileSession } from "@/lib/profile-session";
import { posterUrl } from "@/lib/tmdb";

interface ProgressItem {
  _id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeTitle?: string | null;
  positionSec: number;
  durationSec: number;
  updatedAt: string;
}

export default function ContinueWatchingRow() {
  const { profileId, profileName } = useProfileSession();
  const [items, setItems] = useState<ProgressItem[]>([]);

  useEffect(() => {
    if (!profileId) {
      setItems([]);
      return;
    }

    let cancelled = false;

    fetch("/api/progress")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setItems(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const visibleItems = useMemo(() => {
    const grouped = new Map<string, ProgressItem>();

    for (const item of items) {
      if (item.mediaType !== "movie") continue;
      const key = `${item.mediaType}:${item.tmdbId}`;
      const existing = grouped.get(key);

      if (!existing || compareProgressItems(item, existing) > 0) {
        grouped.set(key, item);
      }
    }

    return Array.from(grouped.values())
      .sort((left, right) => {
        const updatedAtDiff =
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

        if (updatedAtDiff !== 0) return updatedAtDiff;
        return compareProgressItems(right, left);
      })
      .slice(0, 12);
  }, [items]);

  if (visibleItems.length === 0) return null;

  function dismiss(item: ProgressItem) {
    fetch(`/api/progress/${item.tmdbId}`, { method: "DELETE" }).catch(() => {});
    setItems((prev) =>
      prev.filter(
        (entry) =>
          entry.tmdbId !== item.tmdbId || entry.mediaType !== item.mediaType
      )
    );
  }

  return (
    <div className="mb-2 px-4 md:px-10">
      <h2 className="mb-3 text-base font-semibold text-white md:text-lg">
        {profileName ? `Continue Watching for ${profileName}` : "Continue Watching"}
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {visibleItems.map((item) => {
          const href = `/watch/movie/${item.tmdbId}`;

          const progress =
            item.durationSec > 0 ? (item.positionSec / item.durationSec) * 100 : 0;

          return (
            <div key={`${item.mediaType}-${item.tmdbId}`} className="group relative w-36 flex-shrink-0 md:w-44">
              <Link href={href} className="block">
                <div className="relative overflow-hidden rounded">
                  {item.posterPath || item.backdropPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterUrl(item.posterPath ?? item.backdropPath ?? "", "w300")}
                      alt={item.title}
                      className="h-52 w-full object-cover md:h-64"
                    />
                  ) : (
                    <div className="h-52 w-full bg-black/40 md:h-64" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                    <div
                      className="h-full bg-[#e50914] transition-all"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>

                <p className="mt-1.5 truncate text-xs text-gray-300">{item.title}</p>
                <p className="truncate text-xs text-white/80">{getResumeLabel(item)}</p>
              </Link>

              <button
                onClick={() => dismiss(item)}
                className="absolute right-1 top-1 hidden rounded-full bg-black/70 p-1 text-white/60 transition hover:text-white group-hover:flex"
                title="Remove"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function compareProgressItems(left: ProgressItem, right: ProgressItem) {
  const progressDiff = getProgressRatio(left) - getProgressRatio(right);
  if (progressDiff !== 0) return progressDiff;

  const updatedAtDiff =
    new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  if (updatedAtDiff !== 0) return updatedAtDiff;

  const seasonDiff = (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0);
  if (seasonDiff !== 0) return seasonDiff;

  return (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0);
}

function getProgressRatio(item: ProgressItem) {
  if (!item.durationSec || item.durationSec <= 0) return 0;
  return item.positionSec / item.durationSec;
}

function getResumeLabel(item: ProgressItem) {
  return `Resume from ${formatTime(item.positionSec)}`;
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
