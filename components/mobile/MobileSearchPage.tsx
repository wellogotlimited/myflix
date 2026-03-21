"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react";
import MediaDetailsModal from "@/components/MediaDetailsModal";
import MediaCard from "@/components/MediaCard";
import { TMDBItem, backdropUrl, getTitle, getMediaType } from "@/lib/tmdb";

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

function RecommendedRow({ item }: { item: TMDBItem }) {
  const [modalOpen, setModalOpen] = useState(false);
  const title = getTitle(item);
  const thumb = backdropUrl(item.logo_backdrop_path || item.backdrop_path, "w300");

  if (!thumb) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full items-center gap-3 py-2 text-left"
      >
        <div className="relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-md">
          <Image src={thumb} alt={title} fill sizes="112px" className="object-cover" />
        </div>
        <span className="flex-1 text-sm font-medium text-white line-clamp-2">{title}</span>
      </button>
      {modalOpen && (
        <MediaDetailsModal
          item={item}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

export default function MobileSearchPage({
  query,
  results,
  recommended,
}: {
  query: string;
  results: TMDBItem[];
  recommended: TMDBItem[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [genreFilter, setGenreFilter] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(0);

  const availableGenreIds = useMemo(() => {
    const ids = new Set<number>();
    results.forEach((item) => (item.genre_ids ?? []).forEach((id) => ids.add(id)));
    return ids;
  }, [results]);

  const visibleGenres = SEARCH_GENRES.filter((g) => availableGenreIds.has(g.id));

  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (typeFilter !== "all" && item.media_type !== typeFilter) return false;
      if (genreFilter !== null && !(item.genre_ids ?? []).includes(genreFilter)) return false;
      if (minRating > 0 && item.vote_average < minRating) return false;
      return true;
    });
  }, [results, typeFilter, genreFilter, minRating]);

  const pillClass = (active: boolean) =>
    `flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
      active ? "bg-white text-black" : "bg-white/10 text-white"
    }`;

  useEffect(() => {
    let raf: number;
    const t = setTimeout(() => {
      raf = requestAnimationFrame(() => inputRef.current?.focus());
    }, 50);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (v.trim()) {
        router.replace(`/search?q=${encodeURIComponent(v.trim())}`);
      } else {
        router.replace("/search");
      }
    }, 400);
  }

  return (
    <div className="min-h-screen md:hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <button onClick={() => router.back()} className="flex-shrink-0 text-white">
          <ArrowLeft size={22} weight="bold" />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-2.5">
          <MagnifyingGlass size={16} className="flex-shrink-0 text-white/50" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            placeholder="Search shows, movies, animes..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
          />
        </div>
      </div>

      {/* Filters (only when there are results) */}
      {query && results.length > 0 && (
        <div className="space-y-2 px-4 pb-2 pt-1">
          {/* Type */}
          <div className="flex gap-2">
            {(["all", "movie", "tv"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTypeFilter(t)} className={pillClass(typeFilter === t)}>
                {t === "all" ? "All" : t === "movie" ? "Movies" : "TV Shows"}
              </button>
            ))}
          </div>
          {/* Genres */}
          {visibleGenres.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <button type="button" onClick={() => setGenreFilter(null)} className={pillClass(genreFilter === null)}>
                All
              </button>
              {visibleGenres.map((g) => (
                <button key={g.id} type="button" onClick={() => setGenreFilter(genreFilter === g.id ? null : g.id)} className={pillClass(genreFilter === g.id)}>
                  {g.name}
                </button>
              ))}
            </div>
          )}
          {/* Rating */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Rating:</span>
            {RATING_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setMinRating(opt.value)} className={pillClass(minRating === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results grid */}
      {query && filteredResults.length > 0 && (
        <div className="px-4 pt-2">
          <p className="mb-3 text-xs uppercase tracking-wider text-white/40">
            Results for &ldquo;{query}&rdquo;
          </p>
          <div className="grid grid-cols-3 gap-2">
            {filteredResults.map((item) => (
              <MediaCard key={`${item.media_type}-${item.id}`} item={item} portrait />
            ))}
          </div>
        </div>
      )}

      {query && results.length === 0 && (
        <p className="px-4 pt-4 text-sm text-white/40">No results found.</p>
      )}
      {query && results.length > 0 && filteredResults.length === 0 && (
        <p className="px-4 pt-4 text-sm text-white/40">No results match your filters.</p>
      )}

      {/* Recommended list when no query */}
      {!query && recommended.length > 0 && (
        <div className="px-4 pt-2">
          <p className="mb-2 text-xs uppercase tracking-wider text-white/40">Recommended</p>
          <div className="divide-y divide-white/5">
            {recommended.map((item) => (
              <RecommendedRow key={`${getMediaType(item)}-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
