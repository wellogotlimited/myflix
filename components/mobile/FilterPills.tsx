"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, X } from "@phosphor-icons/react";

const GENRES = [
  { id: "28", name: "Action" },
  { id: "35", name: "Comedy" },
  { id: "18", name: "Drama" },
  { id: "27", name: "Horror" },
  { id: "878", name: "Sci-Fi" },
  { id: "10749", name: "Romance" },
  { id: "16", name: "Animation" },
  { id: "99", name: "Documentary" },
  { id: "53", name: "Thriller" },
];

export default function FilterPills({ currentFilter }: { currentFilter?: string }) {
  const router = useRouter();
  const [catOpen, setCatOpen] = useState(false);

  function setFilter(f: string) {
    router.push(`/?filter=${f}`);
  }

  function clearFilter() {
    router.push("/");
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide md:hidden">
        <button
          onClick={currentFilter === "movies" ? clearFilter : () => setFilter("movies")}
          className={`flex-shrink-0 rounded-full border px-4 py-1 text-sm text-white ${
            currentFilter === "movies"
              ? "border-white bg-white/10"
              : "border-white/40 bg-transparent"
          }`}
        >
          Movies
        </button>
        <button
          onClick={() => setCatOpen(true)}
          className={`flex-shrink-0 flex items-center gap-1 rounded-full border px-4 py-1 text-sm text-white ${
            currentFilter === "genre"
              ? "border-white bg-white/10"
              : "border-white/40 bg-transparent"
          }`}
        >
          Categories <CaretDown size={14} />
        </button>
      </div>

      {catOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/95 md:hidden">
          <div className="flex items-center justify-between px-4 py-5">
            <h2 className="text-lg font-semibold text-white">Categories</h2>
            <button onClick={() => setCatOpen(false)} className="text-white">
              <X size={24} />
            </button>
          </div>
          <ul className="px-4">
            {GENRES.map((genre) => (
              <li key={genre.id}>
                <button
                  onClick={() => {
                    router.push(`/?filter=genre&genreId=${genre.id}`);
                    setCatOpen(false);
                  }}
                  className="w-full border-b border-white/10 py-4 text-left text-lg text-white"
                >
                  {genre.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
