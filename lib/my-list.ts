"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useProfileSession } from "@/lib/profile-session";
import { getMediaType, type TMDBItem } from "@/lib/tmdb";

const STORAGE_KEY = "myflix-my-list";
const LIST_UPDATED_EVENT = "myflix-my-list-updated";
const EMPTY_ITEMS: SavedMediaItem[] = [];

type GuestScope = "guest";
type ProfileScope = `profile:${string}`;
type StoreScope = GuestScope | ProfileScope | null;

export type SavedMediaItem = TMDBItem & {
  media_type: "movie" | "tv";
  savedAt: number;
};

type MyListStore = {
  items: SavedMediaItem[];
  scope: StoreScope;
};

const listeners = new Set<() => void>();

let store: MyListStore = {
  items: [],
  scope: null,
};

let activeLoad: { promise: Promise<void>; scope: ProfileScope } | null = null;
let loadVersion = 0;
let localListenersAttached = false;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setStore(scope: Exclude<StoreScope, null>, items: SavedMediaItem[]) {
  store = { scope, items };
  emitChange();
}

function getItemsSnapshot() {
  return store.items;
}

function subscribeToStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function invalidatePendingLoad() {
  loadVersion += 1;
  activeLoad = null;
}

function readList(): SavedMediaItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as SavedMediaItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(items: SavedMediaItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(LIST_UPDATED_EVENT));
}

export function toSavedMediaItem(item: TMDBItem): SavedMediaItem {
  return {
    ...item,
    media_type: getMediaType(item),
    savedAt: Date.now(),
  };
}

async function fetchBookmarksFromDb(): Promise<SavedMediaItem[]> {
  const res = await fetch("/api/bookmarks");
  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    tmdbId: number;
    mediaType: "movie" | "tv";
    title: string;
    posterPath?: string | null;
    savedAt: string;
  }>;

  return data.map((bookmark) => ({
    id: bookmark.tmdbId,
    title: bookmark.title,
    name: bookmark.title,
    poster_path: bookmark.posterPath ?? null,
    backdrop_path: null,
    overview: "",
    vote_average: 0,
    media_type: bookmark.mediaType,
    savedAt: new Date(bookmark.savedAt).getTime(),
  }));
}

function syncGuestStore() {
  if (store.scope !== "guest") return;
  setStore("guest", readList());
}

function ensureGuestListeners() {
  if (typeof window === "undefined" || localListenersAttached) return;

  const sync = () => {
    syncGuestStore();
  };

  window.addEventListener("storage", sync);
  window.addEventListener(LIST_UPDATED_EVENT, sync);
  localListenersAttached = true;
}

function ensureGuestItems() {
  ensureGuestListeners();

  if (store.scope === "guest") return;

  invalidatePendingLoad();
  setStore("guest", readList());
}

function ensureProfileItems(profileId: string) {
  const scope = `profile:${profileId}` as const;

  if (store.scope === scope && !activeLoad) {
    return Promise.resolve();
  }

  if (activeLoad?.scope === scope) {
    return activeLoad.promise;
  }

  loadVersion += 1;
  const currentVersion = loadVersion;

  if (store.scope !== scope) {
    setStore(scope, []);
  }

  const promise = fetchBookmarksFromDb()
    .then((items) => {
      if (loadVersion !== currentVersion || store.scope !== scope) return;
      setStore(scope, items);
    })
    .catch(() => {
      if (loadVersion !== currentVersion || store.scope !== scope) return;
      setStore(scope, []);
    })
    .finally(() => {
      if (activeLoad?.scope === scope && loadVersion === currentVersion) {
        activeLoad = null;
      }
    });

  activeLoad = { promise, scope };
  return promise;
}

export function useMyList(item?: TMDBItem) {
  const { profileId, status } = useProfileSession();
  const items = useSyncExternalStore(
    subscribeToStore,
    getItemsSnapshot,
    () => EMPTY_ITEMS
  );

  useEffect(() => {
    if (status === "loading") return;

    if (profileId) {
      void ensureProfileItems(profileId);
    } else {
      ensureGuestItems();
    }
  }, [profileId, status]);

  const mediaType = item ? getMediaType(item) : undefined;
  const isSaved = item
    ? items.some((entry) => entry.id === item.id && entry.media_type === mediaType)
    : false;

  const toggle = useCallback(async () => {
    if (!item) return;

    const type = getMediaType(item);
    const currentItems = getItemsSnapshot();

    if (profileId) {
      const scope = `profile:${profileId}` as const;
      const exists = currentItems.some((entry) => entry.id === item.id && entry.media_type === type);
      const next = exists
        ? currentItems.filter((entry) => !(entry.id === item.id && entry.media_type === type))
        : [toSavedMediaItem(item), ...currentItems];

      invalidatePendingLoad();
      setStore(scope, next);

      const response = exists
        ? await fetch("/api/bookmarks", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tmdbId: item.id, mediaType: type }),
          }).catch(() => null)
        : await fetch("/api/bookmarks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tmdbId: item.id,
              mediaType: type,
              title: item.title ?? item.name ?? "",
              posterPath: item.poster_path,
            }),
          }).catch(() => null);

      if (!response?.ok && store.scope === scope) {
        setStore(scope, currentItems);
      }

      return;
    }

    ensureGuestItems();
    const guestItems = store.scope === "guest" ? getItemsSnapshot() : readList();
    const exists = guestItems.some((entry) => entry.id === item.id && entry.media_type === type);
    const next = exists
      ? guestItems.filter((entry) => !(entry.id === item.id && entry.media_type === type))
      : [toSavedMediaItem(item), ...guestItems];

    writeList(next);
    setStore("guest", next);
  }, [item, profileId]);

  return { items, isSaved, toggle };
}
