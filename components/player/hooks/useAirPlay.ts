"use client";

import { useCallback, useEffect, useState } from "react";

// WebKit / Remote Playback API type extensions
interface WebKitVideo extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
  webkitPresentationMode?: "inline" | "fullscreen" | "picture-in-picture";
  remote?: RemotePlayback;
}

interface WebKitPlaybackTargetAvailabilityEvent extends Event {
  availability: "available" | "not-available";
}

export function useAirPlay(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const video = videoRef.current as WebKitVideo | null;
    if (!video) return;

    // ── Safari / iOS: WebKit AirPlay events ────────────────────────────────
    const handleAvailabilityChange = (e: Event) => {
      const event = e as WebKitPlaybackTargetAvailabilityEvent;
      setAvailable(event.availability === "available");
    };

    const handlePresentationModeChange = () => {
      if (!video) return;
      // "inline" means we're back on-device; anything else is wireless
      setActive(video.webkitCurrentPlaybackTargetIsWireless === true);
    };

    video.addEventListener(
      "webkitplaybacktargetavailabilitychanged",
      handleAvailabilityChange
    );
    video.addEventListener(
      "webkitpresentationmodechanged",
      handlePresentationModeChange
    );

    // ── Remote Playback API (Chrome / Edge) ───────────────────────────────
    const remote = video.remote;
    if (remote) {
      // Assume potentially available; the browser will show an error in the
      // prompt if no devices are found, which is the expected UX.
      setAvailable(true);

      const onConnect = () => setActive(true);
      const onDisconnect = () => setActive(false);

      remote.addEventListener("connect", onConnect);
      remote.addEventListener("disconnect", onDisconnect);

      return () => {
        video.removeEventListener(
          "webkitplaybacktargetavailabilitychanged",
          handleAvailabilityChange
        );
        video.removeEventListener(
          "webkitpresentationmodechanged",
          handlePresentationModeChange
        );
        remote.removeEventListener("connect", onConnect);
        remote.removeEventListener("disconnect", onDisconnect);
      };
    }

    return () => {
      video.removeEventListener(
        "webkitplaybacktargetavailabilitychanged",
        handleAvailabilityChange
      );
      video.removeEventListener(
        "webkitpresentationmodechanged",
        handlePresentationModeChange
      );
    };
  }, [videoRef]);

  const toggleAirPlay = useCallback(() => {
    const video = videoRef.current as WebKitVideo | null;
    if (!video) return;

    // Safari / iOS
    if (typeof video.webkitShowPlaybackTargetPicker === "function") {
      video.webkitShowPlaybackTargetPicker();
      return;
    }

    // Remote Playback API (Chrome / Edge)
    if (video.remote) {
      video.remote.prompt().catch(() => {
        // User dismissed — not an error
      });
    }
  }, [videoRef]);

  return { available, active, toggleAirPlay };
}
