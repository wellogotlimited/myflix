"use client";

import { useMemo, useEffect, useState } from "react";
import MediaCard from "./MediaCard";
import { useMyList } from "@/lib/my-list";
import { SavedMediaItem } from "@/lib/my-list";

interface CollectionItem {
  _id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
}

interface CollectionData {
  _id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  isPinned: boolean;
  isShared: boolean;
  items: CollectionItem[];
}

export default function MyListContent({
  variant = "page",
}: {
  variant?: "page" | "sheet";
}) {
  const { items } = useMyList();
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.savedAt - a.savedAt),
    [items]
  );
  const [newEpisodeIds, setNewEpisodeIds] = useState<Set<number>>(new Set());
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  useEffect(() => {
    fetch("/api/new-episodes")
      .then((res) => res.json())
      .then((data) => setNewEpisodeIds(new Set(data.tmdbIds ?? [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/collections")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCollections(data);
      })
      .catch(() => {});
  }, [items.length]);

  const hasNewEpisode = (item: SavedMediaItem) =>
    item.media_type === "tv" && newEpisodeIds.has(item.id);

  const isSheet = variant === "sheet";
  const emptyState = isSheet
    ? "Save titles from any poster or details popup and they will show up here."
    : "Add titles from any poster or popup and they will show up here.";

  async function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name || creatingCollection) return;
    setCreatingCollection(true);
    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    setCreatingCollection(false);
    if (!response?.ok) return;
    setNewCollectionName("");
    const refreshed = await fetch("/api/collections").then((res) => res.json()).catch(() => null);
    if (Array.isArray(refreshed)) setCollections(refreshed);
  }

  const collectionsWithFallback = useMemo(() => {
    if (collections.length > 0) return collections;
    return [
      {
        _id: "fallback-my-list",
        name: "My List",
        slug: "my-list",
        isDefault: true,
        isPinned: true,
        isShared: false,
        items: sortedItems.map((item) => ({
          _id: `${item.media_type}-${item.id}`,
          tmdbId: item.id,
          mediaType: item.media_type,
          title: item.title ?? item.name ?? "",
          posterPath: item.poster_path,
          backdropPath: item.backdrop_path,
        })),
      },
    ] satisfies CollectionData[];
  }, [collections, sortedItems]);

  function toCardItem(item: CollectionItem): SavedMediaItem {
    return {
      id: item.tmdbId,
      title: item.title,
      name: item.title,
      overview: "",
      poster_path: item.posterPath ?? null,
      backdrop_path: item.backdropPath ?? null,
      vote_average: 0,
      media_type: item.mediaType,
      savedAt: Date.now(),
    };
  }

  return (
    <div className={isSheet ? "" : "min-h-screen px-4 pb-24 pt-24 md:px-12 md:pb-16 md:pt-28"}>
      {!isSheet ? (
        <div className="mb-8">
          <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">
            My List
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
            Organize saved titles into collections, keep an eye on new episodes, and pin the lists you come back to most.
          </p>
        </div>
      ) : null}

      <div className="mb-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Create a collection</p>
            <p className="text-xs text-white/45">
              Build quick lists like Weekend Watch, Family Night, or Rewatch Queue.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              placeholder="New collection name"
              className="min-w-0 rounded-full bg-white/10 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35"
            />
            <button
              type="button"
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim() || creatingCollection}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-40"
            >
              {creatingCollection ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>

      {collectionsWithFallback.some((collection) => collection.items.length > 0) ? (
        <div className="space-y-10">
          {collectionsWithFallback.map((collection) => {
            if (collection.items.length === 0 && collection.isDefault) return null;
            return (
              <section key={collection._id} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-white">{collection.name}</h2>
                  {collection.isPinned ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-white/50">
                      Pinned
                    </span>
                  ) : null}
                  {collection.isShared ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-white/50">
                      Shared
                    </span>
                  ) : null}
                </div>

                <div className="hidden grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:grid">
                  {collection.items.map((item) => {
                    const cardItem = toCardItem(item);
                    return (
                      <MediaCard
                        key={`${item.mediaType}-${item.tmdbId}`}
                        item={cardItem}
                        layout="grid"
                        newEpisodeBadge={hasNewEpisode(cardItem)}
                      />
                    );
                  })}
                </div>

                <div className={`grid grid-cols-2 gap-x-3 gap-y-5 min-[380px]:grid-cols-3 md:hidden ${isSheet ? "pb-4" : ""}`}>
                  {collection.items.map((item) => {
                    const cardItem = toCardItem(item);
                    return (
                      <MediaCard
                        key={`${item.mediaType}-${item.tmdbId}`}
                        item={cardItem}
                        layout="grid"
                        portrait
                        newEpisodeBadge={hasNewEpisode(cardItem)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div
          className={`rounded-[24px] border border-white/10 bg-white/[0.03] text-white/66 ${
            isSheet ? "p-6 text-sm leading-6" : "p-8"
          }`}
        >
          {emptyState}
        </div>
      )}
    </div>
  );
}
