"use client";

import { useState, useMemo } from "react";
import MediaCard from "./MediaCard";
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
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [genreFilter, setGenreFilter] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(0);

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

  return (
    <div>
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
