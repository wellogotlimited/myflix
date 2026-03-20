export const TV_RECEIVER_STORAGE_KEY = "myflix-tv-receiver-id";
export const TV_REMOTE_TARGET_STORAGE_KEY = "myflix-remote-tv-receiver-id";
export const TV_RECEIVER_ONLINE_WINDOW_MS = 60_000;
export const TV_RECEIVER_COMMAND_EVENT = "myflix:tv-receiver-command";
export const TV_RECEIVER_STATUS_EVENT = "myflix:tv-receiver-status";
export const TV_PLAYER_CAPTION_COMMAND_EVENT = "myflix:tv-player-caption-command";
export const TV_PLAYER_CAPTION_STATE_EVENT = "myflix:tv-player-caption-state";

export type TvRemoteMediaType = "movie" | "tv";
export interface TvRemoteSettings {
  devMode: boolean;
  proxyEnabled: boolean;
}

export type TvReceiverCommand =
  | {
      kind: "navigate";
      path: string;
      title?: string | null;
      settings?: TvRemoteSettings | null;
    }
  | {
      kind: "playback";
      action: "play" | "pause" | "toggle" | "seek";
      positionSec?: number | null;
    }
  | {
      kind: "caption";
      action: "set";
      captionIndex: number;
    };

export interface TvReceiverStatusPayload {
  path: string | null;
  title: string | null;
  remoteConnected: boolean;
  captionsAvailable: boolean;
  captionsEnabled: boolean;
  captions: Array<{ index: number; label: string }>;
  activeCaptionIndex: number;
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  mediaType: TvRemoteMediaType | null;
  tmdbId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  updatedAt: string | null;
}

export interface TvPlayerCaptionStatePayload {
  captionsAvailable: boolean;
  captionsEnabled: boolean;
  captions: Array<{ index: number; label: string }>;
  activeCaptionIndex: number;
}

export function readRemoteSettings(): TvRemoteSettings {
  if (typeof window === "undefined") {
    return { devMode: false, proxyEnabled: false };
  }

  return {
    devMode: window.localStorage.getItem("myflix-dev-mode") === "true",
    proxyEnabled: window.localStorage.getItem("myflix-proxy-enabled") === "true",
  };
}

export function readStorageValue(key: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

export function writeStorageValue(key: string, value: string | null) {
  if (typeof window === "undefined") return;

  if (value === null) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
}
