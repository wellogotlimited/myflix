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
}

const SEGMENT_TYPES: SegmentType[] = ["intro", "recap", "credits", "preview"];

function parseSegments(data: Record<string, RawSegment[]>): Segment[] {
  const result: Segment[] = [];
  for (const type of SEGMENT_TYPES) {
    const list = data[type];
    if (!Array.isArray(list)) continue;
    for (const seg of list) {
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
 * Fetches intro/recap/credits/preview segment timestamps from TheIntroDB.
 * Segments are only available for TV episodes; pass null values for movies.
 */
export function useSkipSegments(
  tmdbId: string | null,
  season: number | null,
  episode: number | null
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

    fetch(
      `https://api.theintrodb.org/v2/media?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`
    )
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
  }, [tmdbId, season, episode]);

  return segments;
}
