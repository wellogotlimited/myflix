"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MediaCard from "./MediaCard";
import NotificationBell from "./NotificationBell";
import { TMDBItem } from "@/lib/tmdb";

const SEARCH_GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 18, name: "Drama" },
  { id: 14, name: "Fantasy" },
  { id: 27, name: "Horror" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 53, name: "Thriller" },
  { id: 10759, name: "Action & Adventure" },
];

const RATING_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 6, label: "6+" },
  { value: 7, label: "7+" },
  { value: 8, label: "8+" },
];

export default function SearchClient({
  query,
  results,
}: {
  query: string;
  results: TMDBItem[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [genreFilter, setGenreFilter] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [suggestions, setSuggestions] = useState<{
    recent: string[];
    trending: string[];
    collections: Array<{ id: number; name?: string }>;
  }>({
    recent: [],
    trending: [],
    collections: [],
  });

  useEffect(() => {
    setValue(query);
  }, [query]);

  useEffect(() => {
    const q = value.trim();
    const controller = new AbortController();
    fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        setSuggestions({
          recent: Array.isArray(data?.recent) ? data.recent : [],
          trending: Array.isArray(data?.trending) ? data.trending : [],
          collections: Array.isArray(data?.collections) ? data.collections : [],
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [value]);

  useEffect(() => {
    const trimmed = value.trim();
    const currentQuery = query.trim();
    if (trimmed === currentQuery) return;

    const timer = setTimeout(() => {
      router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    }, 350);

    return () => clearTimeout(timer);
  }, [query, router, value]);

  useEffect(() => {
    if (!query.trim()) return;
    fetch("/api/search/recent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }).catch(() => {});
  }, [query]);

  // Only show genres that actually appear in the current results
  const availableGenreIds = useMemo(() => {
    const ids = new Set<number>();
    results.forEach((item) => (item.genre_ids ?? []).forEach((id) => ids.add(id)));
    return ids;
  }, [results]);

  const visibleGenres = SEARCH_GENRES.filter((g) => availableGenreIds.has(g.id));

  const filtered = useMemo(() => {
    return results.filter((item) => {
      if (typeFilter !== "all" && item.media_type !== typeFilter) return false;
      if (genreFilter !== null && !(item.genre_ids ?? []).includes(genreFilter)) return false;
      if (minRating > 0 && item.vote_average < minRating) return false;
      return true;
    });
  }, [results, typeFilter, genreFilter, minRating]);

  const pillClass = (active: boolean) =>
    `flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/[0.16]"
    }`;

  const ratingClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/[0.16]"
    }`;

  function submitSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    setValue(nextQuery);
    router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <div>
      <div className="mb-6 flex max-w-2xl items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-3">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch(value);
            }}
            placeholder="Search shows, movies, cast, collections..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={() => submitSearch(value)}
            className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black"
          >
            Search
          </button>
        </div>
        <div className="shrink-0">
          <NotificationBell size={18} panelAlign="right" />
        </div>
      </div>

      {(suggestions.recent.length > 0 || suggestions.trending.length > 0) && !query && (
        <div className="mb-6 space-y-4">
          {suggestions.recent.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/40">Recent</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.recent.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => submitSearch(item)}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/16"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
          {suggestions.trending.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/40">Trending searches</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.trending.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => submitSearch(item)}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/16"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {query && suggestions.collections.length > 0 && (
        <div className="mb-6">
          {suggestions.collections.length > 0 && (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/40">Collections</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.collections.map((collection) => (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => submitSearch(collection.name ?? "")}
                    className="rounded-full bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/16"
                  >
                    {collection.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="mb-6 space-y-3">
          {/* Type filter */}
          <div className="flex gap-2">
            {(["all", "movie", "tv"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={pillClass(typeFilter === t)}
              >
                {t === "all" ? "All" : t === "movie" ? "Movies" : "TV Shows"}
              </button>
            ))}
          </div>

          {/* Genre pills */}
          {visibleGenres.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setGenreFilter(null)}
                className={pillClass(genreFilter === null)}
              >
                All Genres
              </button>
              {visibleGenres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGenreFilter(genreFilter === g.id ? null : g.id)}
                  className={pillClass(genreFilter === g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {/* Rating filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/50">Rating:</span>
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMinRating(opt.value)}
                className={ratingClass(minRating === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => (
            <MediaCard key={`${item.media_type}-${item.id}`} item={item} layout="grid" />
          ))}
        </div>
      ) : (
        <p className="text-gray-400">
          {results.length > 0
            ? "No results match your filters."
            : query
              ? "No results found."
              : ""}
        </p>
      )}
    </div>
  );
}
