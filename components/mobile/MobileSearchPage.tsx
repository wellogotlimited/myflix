"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react";
import MediaDetailsModal from "@/components/MediaDetailsModal";
import MediaCard from "@/components/MediaCard";
import { TMDBItem, backdropUrl, getTitle, getMediaType } from "@/lib/tmdb";

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
            placeholder="Search movies..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
          />
        </div>
      </div>

      {/* Results grid */}
      {query && results.length > 0 && (
        <div className="px-4 pt-2">
          <p className="mb-3 text-xs uppercase tracking-wider text-white/40">
            Results for &ldquo;{query}&rdquo;
          </p>
          <div className="grid grid-cols-3 gap-2">
            {results.map((item) => (
              <MediaCard key={`${item.media_type}-${item.id}`} item={item} portrait />
            ))}
          </div>
        </div>
      )}

      {query && results.length === 0 && (
        <p className="px-4 pt-4 text-sm text-white/40">No results found.</p>
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
