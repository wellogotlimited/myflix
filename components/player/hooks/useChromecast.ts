"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal type shim — the Cast SDK exposes a single callback on window
declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

interface ChromecastState {
  available: boolean;
  connected: boolean;
  connecting: boolean;
  castingTime: number; // current playback position on receiver
}

interface StreamData {
  playlist?: string;
  type: "hls" | "file";
}

export function useChromecast(
  stream: StreamData,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  title?: string
) {
  const [state, setState] = useState<ChromecastState>({
    available: false,
    connected: false,
    connecting: false,
    castingTime: 0,
  });

  const contextRef = useRef<cast.framework.CastContext | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the receiver's current time while casting
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      try {
        const session = contextRef.current?.getCurrentSession();
        const media = session?.getMediaSession();
        if (media) {
          setState((prev) => ({ ...prev, castingTime: media.getEstimatedTime() }));
        }
      } catch {
        // ignore
      }
    }, 1000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    const initCast = (isAvailable: boolean) => {
      if (!isAvailable) return;

      try {
        const context = cast.framework.CastContext.getInstance();
        context.setOptions({
          receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        contextRef.current = context;
        setState((prev) => ({ ...prev, available: true }));

        context.addEventListener(
          cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          (event: cast.framework.SessionStateEventData) => {
            const { SessionState } = cast.framework;
            const s = event.sessionState;
            const connected =
              s === SessionState.SESSION_STARTED || s === SessionState.SESSION_RESUMED;
            const connecting = s === SessionState.SESSION_STARTING;

            setState((prev) => ({ ...prev, connected, connecting }));

            if (connected) {
              startPolling();
            } else {
              stopPolling();
            }
          }
        );
      } catch (e) {
        console.warn("[Chromecast] init failed", e);
      }
    };

    // Register before the SDK loads
    window.__onGCastApiAvailable = initCast;

    // If the SDK loaded before this component mounted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).cast !== "undefined") {
      initCast(true);
    }

    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  const startCasting = useCallback(async () => {
    const context = contextRef.current;
    const video = videoRef.current;
    if (!context || !stream.playlist) return;

    try {
      setState((prev) => ({ ...prev, connecting: true }));

      // Open the cast dialog — this throws if the user dismisses it
      await context.requestSession();

      const session = context.getCurrentSession();
      if (!session) {
        setState((prev) => ({ ...prev, connecting: false }));
        return;
      }

      const mediaInfo = new chrome.cast.media.MediaInfo(
        stream.playlist,
        "application/x-mpegURL"
      );
      const meta = new chrome.cast.media.GenericMediaMetadata();
      if (title) meta.title = title;
      mediaInfo.metadata = meta;

      const request = new chrome.cast.media.LoadRequest(mediaInfo);
      if (video) {
        request.currentTime = video.currentTime;
        request.autoplay = !video.paused;
      }

      await session.loadMedia(request);

      // Pause local playback — the receiver is now playing
      video?.pause();
    } catch (e: unknown) {
      // User dismissed the dialog — not a real error.
      // The Cast SDK throws a chrome.cast.Error (with a .code property) rather
      // than a plain Error, so we must check both shapes.
      const code =
        e != null && typeof e === "object" && "code" in e
          ? String((e as { code: unknown }).code).toLowerCase()
          : "";
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      const isDismiss =
        code === "cancel" ||
        code === "session_error" ||
        msg.includes("cancel") ||
        msg.includes("dismiss");

      if (!isDismiss) {
        console.error("[Chromecast] cast error", e);
      }
      setState((prev) => ({ ...prev, connecting: false }));
    }
  }, [stream.playlist, videoRef, title]);

  const stopCasting = useCallback(async () => {
    const context = contextRef.current;
    if (!context) return;
    const session = context.getCurrentSession();
    if (!session) return;

    try {
      const media = session.getMediaSession();
      const resumeAt = media?.getEstimatedTime() ?? 0;

      await session.endSession(true);

      // Resume local playback from where the receiver left off
      const video = videoRef.current;
      if (video) {
        video.currentTime = resumeAt;
        video.play().catch(() => {});
      }
    } catch (e) {
      console.error("[Chromecast] stop cast error", e);
    }
  }, [videoRef]);

  const toggleCast = useCallback(() => {
    if (state.connected) {
      stopCasting();
    } else {
      startCasting();
    }
  }, [state.connected, startCasting, stopCasting]);

  return { ...state, toggleCast };
}
