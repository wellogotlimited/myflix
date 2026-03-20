"use client";

export const TV_MODE_STORAGE_KEY = "myflix-tv-mode";

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

  const { PlatformInstance } = await import("@react4tv/smart-tv-platform");
  return PlatformInstance.isSmartTV();
}
