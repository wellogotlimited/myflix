"use client";

import { useState } from "react";

function SettingsToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${
          enabled ? "bg-red-600" : "bg-white/20"
        }`}
      >
        <span
          className="absolute left-[2px] top-[2px] block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: `translateX(${enabled ? 20 : 0}px)` }}
        />
      </button>
    </div>
  );
}

export default function AppSettingsContent() {
  const [devMode, setDevMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("myflix-dev-mode") === "true";
  });
  const [proxyEnabled, setProxyEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const value = localStorage.getItem("myflix-proxy-enabled");
    return value === null ? false : value === "true";
  });

  function toggleDevMode() {
    setDevMode((prev) => {
      const next = !prev;
      localStorage.setItem("myflix-dev-mode", String(next));
      return next;
    });
  }

  function toggleProxy() {
    setProxyEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("myflix-proxy-enabled", String(next));
      return next;
    });
  }

  return (
    <div className="py-2">
      <SettingsToggleRow
        title="Proxy Playback"
        description="Route video through the proxy server on this device."
        enabled={proxyEnabled}
        onToggle={toggleProxy}
      />
      <div className="mx-5 border-t border-white/10" />
      <SettingsToggleRow
        title="Developer Mode"
        description="Show debug info and advanced playback tools."
        enabled={devMode}
        onToggle={toggleDevMode}
      />
    </div>
  );
}
