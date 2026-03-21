"use client";

import { useEffect, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { TMDBItem, getMediaType } from "@/lib/tmdb";

type RatingValue = "down" | "up" | "love" | null;

const OPTIONS = [
  { value: "down", label: "Not for me" },
  { value: "up", label: "I like this" },
  { value: "love", label: "Love this" },
] as const;

export default function RatingButtons({
  item,
  size = "sm",
}: {
  item: TMDBItem;
  size?: "sm" | "md";
}) {
  const [rating, setRating] = useState<RatingValue>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const type = getMediaType(item);

  useEffect(() => {
    fetch(`/api/ratings?tmdbId=${item.id}&mediaType=${type}`)
      .then((r) => r.json())
      .then((data) => setRating(data.rating ?? null))
      .catch(() => {});
  }, [item.id, type]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const openMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMenuOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
    }, 120);
  };

  const handleRate = async (newRating: Exclude<RatingValue, null>) => {
    if (loading) return;
    const prev = rating;
    const next = rating === newRating ? null : newRating;
    setRating(next);
    setLoading(true);
    setMenuOpen(false);

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

      await fetch("/api/hidden-titles", {
        method: next === "down" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.id,
          mediaType: type,
          reason: next === "down" ? "not-for-me" : null,
        }),
      });
    } catch {
      setRating(prev);
    } finally {
      setLoading(false);
    }
  };

  const triggerActive = rating !== null;
  const triggerPositive = rating === "up" || rating === "love";
  const triggerSizeClass = size === "md" ? "h-11 w-11" : "h-9 w-9";
  const triggerIconSize = size === "md" ? 20 : 18;
  const optionSizeClass = size === "md" ? "h-11 w-11" : "h-10 w-10";
  const optionIconSize = size === "md" ? 19 : 18;

  return (
    <div
      ref={rootRef}
      className="relative flex items-center"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        onFocus={openMenu}
        title="Rate this title"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={`inline-flex ${triggerSizeClass} items-center justify-center rounded-full transition ${
          triggerActive
            ? "bg-white text-black"
            : "bg-white/10 text-white hover:bg-white/16"
        }`}
      >
        <ThumbsUp size={triggerIconSize} weight={triggerPositive ? "fill" : "bold"} />
      </button>

      <div
        className={`absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 transition-all duration-150 ${
          menuOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1 opacity-0"
        }`}
      >
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#232323] p-1 shadow-[0_18px_36px_rgba(0,0,0,0.42)]">
          {OPTIONS.map((option) => {
            const active = rating === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleRate(option.value)}
                title={option.label}
                aria-label={option.label}
                className={`inline-flex ${optionSizeClass} items-center justify-center rounded-full transition ${
                  active
                    ? "bg-white text-black"
                    : "bg-white/6 text-white hover:bg-white/14"
                }`}
              >
                {option.value === "down" ? (
                  <ThumbsDown size={optionIconSize} weight={active ? "fill" : "bold"} />
                ) : option.value === "love" ? (
                  <DoubleThumbs active={active} size={size} />
                ) : (
                  <ThumbsUp size={optionIconSize} weight={active ? "fill" : "bold"} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DoubleThumbs({ active, size }: { active: boolean; size: "sm" | "md" }) {
  const weight = active ? "fill" : "bold";
  const backSize = size === "md" ? 13 : 12;
  const frontSize = size === "md" ? 16 : 15;

  return (
    <span className="relative block h-[18px] w-[18px]">
      <span className="absolute left-0 top-[2px] opacity-70">
        <ThumbsUp size={backSize} weight={weight} />
      </span>
      <span className="absolute left-[5px] top-0">
        <ThumbsUp size={frontSize} weight={weight} />
      </span>
    </span>
  );
}
