"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkSimple } from "@phosphor-icons/react";
import { useMyList } from "@/lib/my-list";
import { useProfileSession } from "@/lib/profile-session";
import { getMediaType, getTitle, type TMDBItem } from "@/lib/tmdb";

interface SaveCollection {
  _id: string;
  name: string;
  isDefault: boolean;
  items?: Array<{
    tmdbId: number;
    mediaType: "movie" | "tv";
  }>;
}

export default function SaveButton({
  item,
  size = "md",
  className = "",
}: {
  item: TMDBItem;
  size?: "sm" | "md";
  className?: string;
}) {
  const { profileId } = useProfileSession();
  const { isSaved, toggle } = useMyList(item);
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<SaveCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [activeCollectionIds, setActiveCollectionIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const type = getMediaType(item);

  useEffect(() => {
    setCollections([]);
    setActiveCollectionIds(new Set());
    setOpen(false);
  }, [item.id, profileId, type]);

  useEffect(() => {
    if (!open || !profileId || collections.length > 0 || loadingCollections) return;

    let cancelled = false;
    setLoadingCollections(true);
    fetch("/api/collections")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setCollections(data);
        const active = new Set<string>();
        data.forEach((collection: SaveCollection) => {
          if (
            collection.items?.some(
              (collectionItem) =>
                collectionItem.tmdbId === item.id && collectionItem.mediaType === type
            )
          ) {
            active.add(collection._id);
          }
        });
        setActiveCollectionIds(active);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCollections(false);
      });

    return () => {
      cancelled = true;
    };
  }, [collections.length, item.id, loadingCollections, open, profileId, type]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleDefaultToggle() {
    await toggle();
    setActiveCollectionIds((current) => {
      const next = new Set(current);
      const defaultCollection = collections.find((collection) => collection.isDefault);
      if (defaultCollection) {
        if (next.has(defaultCollection._id)) next.delete(defaultCollection._id);
        else next.add(defaultCollection._id);
      }
      return next;
    });
    setOpen(false);
  }

  async function handleCollectionToggle(collection: SaveCollection) {
    const isActive = activeCollectionIds.has(collection._id);
    setActiveCollectionIds((current) => {
      const next = new Set(current);
      if (isActive) next.delete(collection._id);
      else next.add(collection._id);
      return next;
    });

    const response = await fetch(`/api/collections/${collection._id}/items`, {
      method: isActive ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbId: item.id,
        mediaType: type,
        title: getTitle(item),
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setActiveCollectionIds((current) => {
        const next = new Set(current);
        if (isActive) next.add(collection._id);
        else next.delete(collection._id);
        return next;
      });
      return;
    }

    setOpen(false);
  }

  const sizeClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconSize = size === "sm" ? 18 : 20;

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={() => {
          if (!profileId) {
            void toggle();
            return;
          }
          setOpen((current) => !current);
        }}
        className={`inline-flex ${sizeClass} items-center justify-center rounded-full transition ${
          isSaved
            ? "bg-white text-black"
            : "bg-white/10 text-white hover:bg-white/16"
        }`}
        title={isSaved ? "Saved titles" : "Save titles"}
      >
        <BookmarkSimple size={iconSize} weight={isSaved ? "fill" : "bold"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-40 min-w-[13rem] rounded border border-white/10 bg-[#1f1f1f] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.42)]">
          <button
            type="button"
            onClick={() => void handleDefaultToggle()}
            className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
              isSaved ? "bg-white text-black" : "text-white/78 hover:bg-white/8 hover:text-white"
            }`}
          >
            <span>My List</span>
            <span className="text-[11px] uppercase tracking-[0.16em]">
              {isSaved ? "Saved" : "Add"}
            </span>
          </button>

          {loadingCollections ? (
            <div className="px-3 py-2 text-xs text-white/45">Loading collections...</div>
          ) : (
            collections
              .filter((collection) => !collection.isDefault)
              .slice(0, 5)
              .map((collection) => {
                const active = activeCollectionIds.has(collection._id);
                return (
                  <button
                    key={collection._id}
                    type="button"
                    onClick={() => void handleCollectionToggle(collection)}
                    className={`mt-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-white text-black"
                        : "text-white/74 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{collection.name}</span>
                    <span className="text-[11px] uppercase tracking-[0.16em]">
                      {active ? "Saved" : "Add"}
                    </span>
                  </button>
                );
              })
          )}
        </div>
      ) : null}
    </div>
  );
}
