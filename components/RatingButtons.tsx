"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "@phosphor-icons/react";
import { TMDBItem, getMediaType } from "@/lib/tmdb";

export default function RatingButtons({ item }: { item: TMDBItem }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [loading, setLoading] = useState(false);
  const type = getMediaType(item);

  useEffect(() => {
    fetch(`/api/ratings?tmdbId=${item.id}&mediaType=${type}`)
      .then((r) => r.json())
      .then((data) => setRating(data.rating ?? null))
      .catch(() => {});
  }, [item.id, type]);

  const handleRate = async (newRating: "up" | "down") => {
    if (loading) return;
    const prev = rating;
    const next = rating === newRating ? null : newRating;
    setRating(next);
    setLoading(true);
    try {
      await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.id,
          mediaType: type,
          rating: next,
          genreIds: item.genre_ids ?? [],
        }),
      });
    } catch {
      setRating(prev);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => handleRate("up")}
        title="I like this"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
          rating === "up"
            ? "bg-white text-black"
            : "bg-white/10 text-white hover:bg-white/16"
        }`}
      >
        <ThumbsUp size={16} weight={rating === "up" ? "fill" : "regular"} />
      </button>
      <button
        type="button"
        onClick={() => handleRate("down")}
        title="Not for me"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
          rating === "down"
            ? "bg-white text-black"
            : "bg-white/10 text-white hover:bg-white/16"
        }`}
      >
        <ThumbsDown size={16} weight={rating === "down" ? "fill" : "regular"} />
      </button>
    </div>
  );
}
