"use client";

import { useEffect, useRef, useState } from "react";

export type SegmentType = "intro" | "recap" | "credits" | "preview";

export interface Segment {
  type: SegmentType;
  startSec: number;
  /** null means the segment runs to the very end of the video */
  endSec: number | null;
}

interface RawSegment {
  start_ms: number | null;
  end_ms: number | null;
  submission_count?: number;
}

const SEGMENT_TYPES: SegmentType[] = ["intro", "recap", "credits", "preview"];

function parseSegments(data: Record<string, RawSegment[]>): Segment[] {
  const result: Segment[] = [];
  for (const type of SEGMENT_TYPES) {
    const list = data[type];
    if (!Array.isArray(list)) continue;
    for (const seg of list) {
      // Skip unverified segments (same filter p-stream uses)
      if ((seg.submission_count ?? 0) < 1) continue;
      result.push({
        type,
        startSec: (seg.start_ms ?? 0) / 1000,
        endSec: seg.end_ms !== null ? seg.end_ms / 1000 : null,
      });
    }
  }
  return result;
}

/**
 * Fetches intro/recap/credits/preview segment timestamps via our server-side
 * proxy (/api/segments) which calls TheIntroDB then falls back to introdb.app.
 * Proxying avoids browser CORS restrictions on the external APIs.
 */
export function useSkipSegments(
  tmdbId: string | null,
  season: number | null,
  episode: number | null,
  imdbId?: string | null,
): Segment[] {
  const [segments, setSegments] = useState<Segment[]>([]);
  const cacheRef = useRef<Record<string, Segment[]>>({});

  useEffect(() => {
    if (!tmdbId || season === null || episode === null) {
      setSegments([]);
      return;
    }

    const cacheKey = `${tmdbId}-${season}-${episode}`;

    if (cacheRef.current[cacheKey]) {
      setSegments(cacheRef.current[cacheKey]);
      return;
    }

    let cancelled = false;

    const params = new URLSearchParams({
      tmdbId,
      season: String(season),
      episode: String(episode),
      ...(imdbId ? { imdbId } : {}),
    });

    fetch(`/api/segments?${params}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json() as Promise<Record<string, RawSegment[]>>;
      })
      .then((data) => {
        if (cancelled || !data) return;
        const parsed = parseSegments(data);
        cacheRef.current[cacheKey] = parsed;
        setSegments(parsed);
      })
      .catch(() => {
        if (!cancelled) setSegments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, season, episode, imdbId]);

  return segments;
}
