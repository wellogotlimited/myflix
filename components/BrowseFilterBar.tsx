"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const MOVIE_GENRES = [
  { id: "28", name: "Action" },
  { id: "12", name: "Adventure" },
  { id: "35", name: "Comedy" },
  { id: "80", name: "Crime" },
  { id: "18", name: "Drama" },
  { id: "14", name: "Fantasy" },
  { id: "27", name: "Horror" },
  { id: "9648", name: "Mystery" },
  { id: "10749", name: "Romance" },
  { id: "878", name: "Sci-Fi" },
  { id: "53", name: "Thriller" },
  { id: "10752", name: "War" },
  { id: "37", name: "Western" },
];

const TV_GENRES = [
  { id: "10759", name: "Action & Adventure" },
  { id: "35", name: "Comedy" },
  { id: "80", name: "Crime" },
  { id: "18", name: "Drama" },
  { id: "14", name: "Fantasy" },
  { id: "27", name: "Horror" },
  { id: "9648", name: "Mystery" },
  { id: "10749", name: "Romance" },
  { id: "10765", name: "Sci-Fi & Fantasy" },
  { id: "53", name: "Thriller" },
  { id: "10768", name: "War & Politics" },
];

const SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most Popular" },
  { value: "vote_average.desc", label: "Highest Rated" },
  { value: "release_date.desc", label: "Newest First" },
  { value: "release_date.asc", label: "Oldest First" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any Rating" },
  { value: "6", label: "6+" },
  { value: "7", label: "7+" },
  { value: "8", label: "8+" },
];

export default function BrowseFilterBar({
  contentType,
}: {
  contentType: "movie" | "tv" | "anime";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const genre = searchParams.get("genre") ?? "";
  const sort = searchParams.get("sort") ?? "popularity.desc";
  const minRating = searchParams.get("minRating") ?? "";

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const genres = contentType === "movie" ? MOVIE_GENRES : TV_GENRES;

  return (
    <div className="space-y-3 pb-6">
      {/* Genre pills — hidden for anime since it's already genre-specific */}
      {contentType !== "anime" && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            onClick={() => setParam("genre", null)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              !genre
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/16"
            }`}
          >
            All
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setParam("genre", genre === g.id ? null : g.id)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                genre === g.id
                  ? "bg-white text-black"
                  : "bg-white/10 text-white hover:bg-white/16"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Sort + Rating row */}
      <div className="flex flex-wrap gap-2">
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none transition hover:bg-white/16"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#181818]">
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          {RATING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setParam("minRating", minRating === opt.value ? null : opt.value || null)
              }
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                minRating === opt.value
                  ? "bg-white text-black"
                  : "bg-white/10 text-white hover:bg-white/16"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
