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

const LANGUAGE_OPTIONS = [
  { value: "", label: "Any Language" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];

const RUNTIME_OPTIONS = [
  { value: "", label: "Any Length" },
  { value: "short", label: "Under 100m" },
  { value: "medium", label: "100-140m" },
  { value: "long", label: "140m+" },
];

const YEAR_OPTIONS = [
  { value: "", label: "Any Year" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "2022", label: "2022" },
];

const NETWORK_OPTIONS = [
  { value: "", label: "Any Network" },
  { value: "213", label: "Netflix" },
  { value: "49", label: "HBO" },
  { value: "2552", label: "Apple TV+" },
  { value: "2739", label: "Disney+" },
  { value: "453", label: "Hulu" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Any Status" },
  { value: "0", label: "Ended" },
  { value: "2", label: "Returning" },
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
  const year = searchParams.get("year") ?? "";
  const language = searchParams.get("language") ?? "";
  const runtime = searchParams.get("runtime") ?? "";
  const network = searchParams.get("network") ?? "";
  const status = searchParams.get("status") ?? "";

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

      <div className="flex flex-wrap gap-2">
        <select
          value={year}
          onChange={(e) => setParam("year", e.target.value || null)}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none transition hover:bg-white/16"
        >
          {YEAR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#181818]">
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={language}
          onChange={(e) => setParam("language", e.target.value || null)}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none transition hover:bg-white/16"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#181818]">
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={runtime}
          onChange={(e) => setParam("runtime", e.target.value || null)}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none transition hover:bg-white/16"
        >
          {RUNTIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#181818]">
              {opt.label}
            </option>
          ))}
        </select>

        {contentType === "tv" && (
          <>
            <select
              value={network}
              onChange={(e) => setParam("network", e.target.value || null)}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none transition hover:bg-white/16"
            >
              {NETWORK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#181818]">
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setParam("status", e.target.value || null)}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none transition hover:bg-white/16"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#181818]">
                  {opt.label}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
