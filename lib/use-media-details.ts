"use client";

import { useEffect, useState } from "react";
import { getMediaType, type TMDBItem, type TMDBMediaDetails } from "@/lib/tmdb";

const cache = new Map<string, TMDBMediaDetails>();

export function useMediaDetails(item: TMDBItem, enabled: boolean) {
  const type = getMediaType(item);
  const cacheKey = `${type}:${item.id}`;
  const cachedData = cache.get(cacheKey) ?? null;
  const [fetched, setFetched] = useState<{
    key: string;
    data: TMDBMediaDetails | null;
  }>({
    key: cacheKey,
    data: cachedData,
  });
  const data =
    fetched.key === cacheKey ? fetched.data ?? cachedData : cachedData;
  const loading = enabled && !data;

  useEffect(() => {
    if (!enabled) return;
    if (cachedData) return;

    const controller = new AbortController();

    fetch(`/api/tmdb/details?id=${item.id}&type=${type}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load details");
        }
        return response.json() as Promise<TMDBMediaDetails>;
      })
      .then((details) => {
        cache.set(cacheKey, details);
        setFetched({
          key: cacheKey,
          data: details,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
      });

    return () => controller.abort();
  }, [cacheKey, cachedData, enabled, item.id, type]);

  return { data, loading };
}
