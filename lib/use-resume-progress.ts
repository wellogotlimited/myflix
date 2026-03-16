"use client";

import { useEffect, useState } from "react";
import { useProfileSession } from "@/lib/profile-session";
import { getMediaType, type TMDBItem } from "@/lib/tmdb";

export interface ResumeProgressEntry {
  mediaType: "movie" | "tv";
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  positionSec: number;
  durationSec: number;
  completed?: boolean;
}

export function formatResumeTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function useResumeProgress(item: TMDBItem, enabled = true) {
  const { profileId, status } = useProfileSession();
  const [progressState, setProgressState] = useState<{
    key: string;
    value: ResumeProgressEntry | null;
  } | null>(null);
  const mediaType = getMediaType(item);
  const itemKey = `${mediaType}:${item.id}`;

  useEffect(() => {
    if (!enabled) return;
    if (status !== "authenticated" || !profileId) return;

    let cancelled = false;

    fetch(`/api/progress/${item.id}?mediaType=${mediaType}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load resume progress");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setProgressState({ key: itemKey, value: data ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProgressState({ key: itemKey, value: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, item.id, itemKey, mediaType, profileId, status]);

  if (!enabled || status !== "authenticated" || !profileId) return null;
  return progressState?.key === itemKey ? progressState.value : null;
}
