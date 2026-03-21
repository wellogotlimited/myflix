"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [preferences, setPreferences] = useState({
    proxyEnabled: false,
    devMode: false,
    autoplayNextEpisode: true,
    captionsEnabled: false,
    reducedMotion: false,
    largerControls: false,
    highContrast: false,
    keyboardShortcuts: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/preferences")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setPreferences((current) => ({
          ...current,
          ...data,
        }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function savePreference(key: keyof typeof preferences, next: boolean) {
    setSavingKey(key);
    setPreferences((current) => ({ ...current, [key]: next }));
    const storageKeyMap: Partial<Record<keyof typeof preferences, string>> = {
      proxyEnabled: "myflix-proxy-enabled",
      devMode: "myflix-dev-mode",
      autoplayNextEpisode: "myflix-autoplay-next",
      captionsEnabled: "myflix-captions-enabled",
      reducedMotion: "myflix-reduced-motion",
      largerControls: "myflix-larger-controls",
      highContrast: "myflix-high-contrast",
      keyboardShortcuts: "myflix-keyboard-shortcuts",
    };
    const storageKey = storageKeyMap[key];
    if (storageKey) {
      localStorage.setItem(storageKey, String(next));
    }

    const response = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    }).catch(() => null);

    if (!response?.ok) {
      setPreferences((current) => ({ ...current, [key]: !next }));
      if (storageKey) {
        localStorage.setItem(storageKey, String(!next));
      }
    }

    setSavingKey(null);
  }

  const rows = useMemo(
    () => [
      {
        key: "proxyEnabled" as const,
        title: "Proxy Playback",
        description: "Route video through the proxy server on this device and synced profile.",
      },
      {
        key: "devMode" as const,
        title: "Developer Mode",
        description: "Show debug info and advanced playback tools.",
      },
      {
        key: "autoplayNextEpisode" as const,
        title: "Autoplay Next Episode",
        description: "Automatically continue to the next episode when available.",
      },
      {
        key: "captionsEnabled" as const,
        title: "Captions By Default",
        description: "Start playback with captions enabled when tracks are available.",
      },
      {
        key: "reducedMotion" as const,
        title: "Reduced Motion",
        description: "Tone down movement-heavy UI effects where supported.",
      },
      {
        key: "largerControls" as const,
        title: "Larger Controls",
        description: "Use roomier player controls for touch-first playback.",
      },
      {
        key: "highContrast" as const,
        title: "Higher Contrast",
        description: "Increase visual contrast on supported app surfaces.",
      },
      {
        key: "keyboardShortcuts" as const,
        title: "Keyboard Shortcuts",
        description: "Keep desktop playback shortcuts enabled.",
      },
    ],
    []
  );

  return (
    <div className="py-2">
      {rows.map((row, index) => (
        <div key={row.key}>
          <SettingsToggleRow
            title={row.title}
            description={
              savingKey === row.key ? "Saving..." : loading ? "Loading..." : row.description
            }
            enabled={preferences[row.key]}
            onToggle={() => savePreference(row.key, !preferences[row.key])}
          />
          {index < rows.length - 1 ? <div className="mx-5 border-t border-white/10" /> : null}
        </div>
      ))}
    </div>
  );
}
