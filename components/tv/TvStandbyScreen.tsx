"use client";

import { useEffect, useState } from "react";
import BrandWordmark from "@/components/BrandWordmark";
import {
  TV_RECEIVER_STATUS_EVENT,
  type TvReceiverStatusPayload,
} from "@/lib/tv-remote";

export default function TvStandbyScreen() {
  const [remoteConnected, setRemoteConnected] = useState(false);

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const payload = (event as CustomEvent<TvReceiverStatusPayload>).detail;
      setRemoteConnected(Boolean(payload?.remoteConnected));
    };

    window.addEventListener(TV_RECEIVER_STATUS_EVENT, handleStatus as EventListener);
    return () => {
      window.removeEventListener(TV_RECEIVER_STATUS_EVENT, handleStatus as EventListener);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080808]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.14),transparent_28%),radial-gradient(circle_at_75%_20%,rgba(255,255,255,0.06),transparent_24%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_32%,rgba(229,9,20,0.03)_100%)]" />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <BrandWordmark
          size={44}
          className="mb-12"
          textClassName="text-2xl font-medium tracking-[0.14em] text-white/88 uppercase"
          priority
        />
        <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.02em] text-white/92">
          {remoteConnected ? "Phone connected" : "Press the TV icon on your phone"}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/56">
          {remoteConnected
            ? "Stay on this screen. Pick something on your phone and it will start here."
            : "Wait here after you connect. Playback will start on this TV from your phone."}
        </p>
      </div>
    </div>
  );
}
