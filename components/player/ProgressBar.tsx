"use client";

import { useRef, useState, useCallback } from "react";
import { formatTime } from "./utils";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  buffered: number;
  onSeek: (time: number) => void;
}

export default function ProgressBar({
  currentTime,
  duration,
  buffered,
  onSeek,
}: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [hoverPct, setHoverPct] = useState(0);
  const [dragging, setDragging] = useState(false);

  const getTimeFromX = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || !duration) return 0;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return fraction * duration;
    },
    [duration]
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const hoverTime = duration > 0 ? (Math.max(0, Math.min(100, hoverPct)) / 100) * duration : 0;

  const updateHover = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setHoverPct(Math.max(0, Math.min(100, pct)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      onSeek(getTimeFromX(e.clientX));
      updateHover(e.clientX);

      const handleMouseMove = (ev: MouseEvent) => {
        onSeek(getTimeFromX(ev.clientX));
        updateHover(ev.clientX);
      };
      const handleMouseUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [getTimeFromX, onSeek, updateHover]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      setDragging(true);
      onSeek(getTimeFromX(touch.clientX));
      updateHover(touch.clientX);

      const handleTouchMove = (ev: TouchEvent) => {
        const nextTouch = ev.touches[0];
        if (!nextTouch) return;
        onSeek(getTimeFromX(nextTouch.clientX));
        updateHover(nextTouch.clientX);
      };
      const handleTouchEnd = () => {
        setDragging(false);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
        window.removeEventListener("touchcancel", handleTouchEnd);
      };

      window.addEventListener("touchmove", handleTouchMove, { passive: true });
      window.addEventListener("touchend", handleTouchEnd);
      window.addEventListener("touchcancel", handleTouchEnd);
    },
    [getTimeFromX, onSeek, updateHover]
  );

  return (
    <div
      className="group/progress w-full cursor-pointer touch-none py-2"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
      }}
      onMouseMove={(e) => updateHover(e.clientX)}
    >
      {/* Hover time tooltip */}
      {(hovering || dragging) && duration > 0 && (
        <div
          className="pointer-events-none absolute bottom-11 z-30 -translate-x-1/2 rounded-full bg-black/90 px-3 py-1 text-xs text-white shadow-lg"
          style={{ left: `${Math.max(3, Math.min(97, hoverPct))}%` }}
        >
          {formatTime(hoverTime)}
        </div>
      )}

      {/* Bar */}
      <div
        ref={barRef}
        className="relative h-1.5 w-full overflow-hidden bg-white/20 transition-all group-hover/progress:h-2"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Buffered */}
        <div
          className="absolute inset-y-0 left-0 bg-white/30"
          style={{ width: `${bufferedPct}%` }}
        />
        {/* Hover preview */}
        {hovering && (
          <div
            className="absolute inset-y-0 left-0 bg-white/20"
            style={{ width: `${Math.max(0, Math.min(100, hoverPct))}%` }}
          />
        )}
        {/* Progress */}
        <div
          className="absolute inset-y-0 left-0 bg-red-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Scrub dot */}
      <div
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-red-500 opacity-0 shadow-md transition-opacity group-hover/progress:opacity-100"
        style={{ left: `calc(${progress}% - 9px)` }}
      />
    </div>
  );
}
