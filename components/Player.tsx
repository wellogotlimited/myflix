"use client";

import { useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
interface StreamData {
  type: "hls" | "file";
  playlist?: string;
  qualities?: Record<string, { type: string; url: string }>;
  headers?: Record<string, string>;
  preferredHeaders?: Record<string, string>;
}

const QUALITY_ORDER = ["4k", "1080", "720", "480", "360", "unknown"] as const;

export default function Player({
  stream,
  onError,
}: {
  stream: StreamData;
  onError?: (msg: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    cleanup();

    if (stream.type === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls({
          xhrSetup: (xhr, url) => {
            const headers = {
              ...stream.preferredHeaders,
              ...stream.headers,
            };
            for (const [key, value] of Object.entries(headers)) {
              try {
                xhr.setRequestHeader(key, value);
              } catch {
                // Some headers can't be set in browser
              }
            }
          },
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            onError?.(`HLS error: ${data.type}`);
          }
        });

        hls.loadSource(stream.playlist!);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = stream.playlist!;
        video.addEventListener("loadedmetadata", () => {
          video.play().catch(() => {});
        });
      } else {
        onError?.("HLS is not supported in this browser.");
      }
    } else if (stream.type === "file") {
      // Pick best quality
      let url = "";
      for (const q of QUALITY_ORDER) {
        const entry = stream.qualities?.[q];
        if (entry) {
          url = entry.url;
          break;
        }
      }
      if (url) {
        video.src = url;
        video.play().catch(() => {});
      } else {
        onError?.("No playable quality found.");
      }
    }

    return cleanup;
  }, [stream, cleanup, onError]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        autoPlay
        playsInline
      />
    </div>
  );
}
