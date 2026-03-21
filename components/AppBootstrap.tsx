"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const DEVICE_SESSION_KEY = "myflix-device-session-key";
const SEEN_NOTIFICATIONS_KEY = "myflix-seen-notification-ids";

function getDeviceSessionKey() {
  if (typeof window === "undefined") return "";
  let current = window.localStorage.getItem(DEVICE_SESSION_KEY);
  if (!current) {
    current = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_SESSION_KEY, current);
  }
  return current;
}

function readSeenNotificationIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(SEEN_NOTIFICATIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function writeSeenNotificationIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEEN_NOTIFICATIONS_KEY, JSON.stringify([...ids].slice(-80)));
}

export default function AppBootstrap() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.profileId) return;

    fetch("/api/preferences")
      .then((response) => response.json())
      .then((data) => {
        const mirrors: Record<string, string> = {
          "myflix-proxy-enabled": String(Boolean(data?.proxyEnabled)),
          "myflix-dev-mode": String(Boolean(data?.devMode)),
          "myflix-autoplay-next": String(Boolean(data?.autoplayNextEpisode)),
          "myflix-captions-enabled": String(Boolean(data?.captionsEnabled)),
          "myflix-reduced-motion": String(Boolean(data?.reducedMotion)),
          "myflix-larger-controls": String(Boolean(data?.largerControls)),
          "myflix-high-contrast": String(Boolean(data?.highContrast)),
          "myflix-keyboard-shortcuts": String(Boolean(data?.keyboardShortcuts)),
        };
        Object.entries(mirrors).forEach(([key, value]) => {
          window.localStorage.setItem(key, value);
        });
      })
      .catch(() => {});
  }, [session?.user?.profileId, status]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.profileId) return;

    const sessionKey = getDeviceSessionKey();
    void fetch("/api/device-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, path: pathname }),
    }).catch(() => {});
  }, [pathname, session?.user?.profileId, status]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.profileId) return;

    const hasNotifications = typeof window !== "undefined" && "Notification" in window;
    const permission = hasNotifications ? Notification.permission : "default";

    void fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permission,
        browserSupported: hasNotifications,
        pushEnabled: permission === "granted",
      }),
    }).catch(() => {});
  }, [session?.user?.profileId, status]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.profileId) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    async function syncBrowserNotifications() {
      try {
        const [registration, response] = await Promise.all([
          navigator.serviceWorker.ready,
          fetch("/api/notifications"),
        ]);
        if (cancelled || !response.ok) return;

        const payload = await response.json();
        const events = Array.isArray(payload?.events) ? payload.events : [];
        const seenIds = readSeenNotificationIds();

        for (const event of events.slice(0, 5).reverse()) {
          if (event?.readAt || seenIds.has(event._id)) continue;
          await registration.showNotification(event.title, {
            body: event.body,
            tag: event._id,
            data: { href: event.href ?? "/" },
          });
          seenIds.add(event._id);
        }

        writeSeenNotificationIds(seenIds);
      } catch {
        // Ignore notification sync errors in the client bootstrap path.
      }
    }

    void syncBrowserNotifications();
    const interval = window.setInterval(() => {
      void syncBrowserNotifications();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session?.user?.profileId, status]);

  return null;
}
