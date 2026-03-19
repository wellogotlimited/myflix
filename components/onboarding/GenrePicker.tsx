"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GENRES = [
  { id: 28, name: "Action", emoji: "💥" },
  { id: 35, name: "Comedy", emoji: "😂" },
  { id: 18, name: "Drama", emoji: "🎭" },
  { id: 27, name: "Horror", emoji: "👻" },
  { id: 878, name: "Sci-Fi", emoji: "🚀" },
  { id: 10749, name: "Romance", emoji: "❤️" },
  { id: 53, name: "Thriller", emoji: "🔪" },
  { id: 16, name: "Animation", emoji: "🎨" },
  { id: 99, name: "Documentary", emoji: "🎬" },
  { id: 80, name: "Crime", emoji: "🔍" },
  { id: 12, name: "Adventure", emoji: "🗺️" },
  { id: 10751, name: "Family", emoji: "👨‍👩‍👧‍👦" },
  { id: 14, name: "Fantasy", emoji: "🧙" },
  { id: 9648, name: "Mystery", emoji: "🕵️" },
  { id: 36, name: "History", emoji: "📜" },
];

const MIN_SELECTIONS = 3;

export default function GenrePicker() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggleGenre(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit(genreIds: number[]) {
    setLoading(true);
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genreIds }),
    });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-2 text-center text-[#e50914] text-sm font-semibold tracking-widest uppercase">
          Step 1 of 1
        </div>
        <h1 className="mb-3 text-center text-3xl font-bold text-white">
          What do you like to watch?
        </h1>
        <p className="mb-8 text-center text-gray-400">
          Pick at least {MIN_SELECTIONS} genres to personalize your recommendations.
        </p>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {GENRES.map((genre) => {
            const isSelected = selected.has(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                onClick={() => toggleGenre(genre.id)}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 px-2 py-4 text-center transition-all
                  ${
                    isSelected
                      ? "border-white bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-gray-400 hover:border-white/40 hover:text-white"
                  }`}
              >
                <span className="text-2xl">{genre.emoji}</span>
                <span className="text-xs font-medium leading-tight">{genre.name}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          {selected.size === 0
            ? `Select at least ${MIN_SELECTIONS} genres`
            : selected.size < MIN_SELECTIONS
            ? `${MIN_SELECTIONS - selected.size} more to go`
            : `${selected.size} selected`}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            disabled={selected.size < MIN_SELECTIONS || loading}
            onClick={() => handleSubmit(Array.from(selected))}
            className="w-full rounded bg-[#e50914] py-3 font-semibold text-white transition hover:bg-[#f40612] disabled:opacity-40"
          >
            {loading ? "Saving…" : "Let's go"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit([])}
            className="w-full py-2 text-sm text-gray-500 transition hover:text-gray-300"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
