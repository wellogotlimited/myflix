"use client";

import { useState } from "react";
import { TelevisionSimple } from "@phosphor-icons/react";
import {
  TV_REMOTE_TARGET_STORAGE_KEY,
  readRemoteSettings,
  writeStorageValue,
  readStorageValue,
} from "@/lib/tv-remote";

export default function TvConnectButton() {
  const [connected, setConnected] = useState(() =>
    Boolean(readStorageValue(TV_REMOTE_TARGET_STORAGE_KEY))
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    if (connected) {
      const currentReceiverId = readStorageValue(TV_REMOTE_TARGET_STORAGE_KEY);
      if (currentReceiverId) {
        void fetch(`/api/tv/receiver/${currentReceiverId}/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connected: false }),
        }).catch(() => {});
      }
      writeStorageValue(TV_REMOTE_TARGET_STORAGE_KEY, null);
      setConnected(false);
      setMessage("Disconnected");
      return;
    }

    setBusy(true);
    setMessage("");

    const response = await fetch("/api/tv/receiver", { cache: "no-store" }).catch(() => null);
    setBusy(false);

    if (!response?.ok) {
      setMessage("No TV found");
      return;
    }

    const data = (await response.json()) as {
      receiver: { id: string; profileName: string } | null;
    };

    if (!data.receiver?.id) {
      setMessage("No TV found");
      return;
    }

    writeStorageValue(TV_REMOTE_TARGET_STORAGE_KEY, data.receiver.id);
    void fetch(`/api/tv/receiver/${data.receiver.id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "navigate",
        path: "/tv",
        title: "TV Remote",
        settings: readRemoteSettings(),
      }),
    }).catch(() => {});
    void fetch(`/api/tv/receiver/${data.receiver.id}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connected: true }),
    }).catch(() => {});
    setConnected(true);
    setMessage(`Connected to ${data.receiver.profileName}`);
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={connected ? "Disconnect TV remote" : "Connect TV remote"}
        className={`text-white transition ${connected ? "opacity-100" : "opacity-80"} disabled:opacity-50`}
      >
        <TelevisionSimple size={28} weight={connected ? "fill" : "regular"} />
      </button>
      {message ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] whitespace-nowrap rounded-full bg-black/85 px-3 py-1 text-xs text-white/75 shadow-lg">
          {message}
        </div>
      ) : null}
    </div>
  );
}
