"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "@phosphor-icons/react";

interface NotificationEvent {
  _id: string;
  title: string;
  body: string;
  href?: string | null;
  createdAt: string;
  readAt?: string | null;
}

export default function NotificationBell({
  size = 20,
  iconClassName = "",
  panelAlign = "right",
}: {
  size?: number;
  iconClassName?: string;
  panelAlign?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "default">("default");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!open) return;

    fetch("/api/notifications")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data?.events)) setEvents(data.events);
      })
      .catch(() => {});

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const unreadCount = useMemo(
    () => events.filter((event) => !event.readAt).length,
    [events]
  );

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permission: nextPermission,
        browserSupported: true,
        pushEnabled: nextPermission === "granted",
      }),
    }).catch(() => {});
  }

  async function markAllRead() {
    const ids = events.filter((event) => !event.readAt).map((event) => event._id);
    if (!ids.length) return;

    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markReadIds: ids }),
    }).catch(() => {});

    setEvents((current) =>
      current.map((event) => ({
        ...event,
        readAt: event.readAt ?? new Date().toISOString(),
      }))
    );
  }

  const panelPositionClass = panelAlign === "left" ? "left-0" : "right-0";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`relative inline-flex items-center justify-center align-middle leading-none text-white transition hover:text-gray-300 ${iconClassName}`.trim()}
        style={{ width: size, height: size }}
        title="Notifications"
      >
        <Bell size={size} weight="bold" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5 rounded-full bg-[#e50914]" />
        ) : null}
      </button>

      {open ? (
        <div className={`absolute top-[calc(100%+0.6rem)] z-[70] w-[20rem] rounded border border-white/10 bg-[#191919] p-2 shadow-[0_22px_48px_rgba(0,0,0,0.42)] ${panelPositionClass}`}>
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-white/55 transition hover:text-white"
              >
                Mark read
              </button>
            ) : null}
          </div>

          {permission !== "granted" ? (
            <button
              type="button"
              onClick={() => void enableNotifications()}
              className="mb-2 w-full rounded bg-white/8 px-3 py-2 text-left text-sm text-white/78 transition hover:bg-white/12 hover:text-white"
            >
              Enable browser alerts
            </button>
          ) : null}

          <div className="max-h-[20rem] space-y-1 overflow-y-auto">
            {events.slice(0, 8).map((event) => {
              const content = (
                <div className={`rounded px-3 py-2 transition ${event.readAt ? "bg-white/[0.03]" : "bg-white/[0.07]"}`}>
                  <p className="text-sm font-medium text-white">{event.title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/52">{event.body}</p>
                </div>
              );

              return event.href ? (
                <Link key={event._id} href={event.href} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              ) : (
                <div key={event._id}>{content}</div>
              );
            })}

            {events.length === 0 ? (
              <div className="px-3 py-4 text-sm text-white/45">No notifications yet.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
