"use client";

export const TV_MODE_STORAGE_KEY = "myflix-tv-mode";
const LARGE_TV_VIEWPORT_QUERY = "(min-width: 1200px) and (min-height: 700px)";

export function readTvModeOverride() {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(TV_MODE_STORAGE_KEY);
  if (value === null) return null;
  if (value === "true") return true;
  if (value === "false") return false;

  return null;
}

export async function detectTvMode() {
  const override = readTvModeOverride();
  if (override !== null) {
    return override;
  }

  if (typeof window !== "undefined" && window.matchMedia(LARGE_TV_VIEWPORT_QUERY).matches) {
    return true;
  }

  const { PlatformInstance } = await import("@react4tv/smart-tv-platform");
  return PlatformInstance.isSmartTV();
}
