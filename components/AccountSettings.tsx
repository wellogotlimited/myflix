"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

export default function AccountSettings({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<Array<{ _id: string; sessionKey: string; label: string; lastSeenAt: string; trusted: boolean; lastPath?: string | null }>>([]);
  const [notifications, setNotifications] = useState<Array<{ _id: string; title: string; body: string; createdAt: string; readAt?: string | null }>>([]);
  const [downloads, setDownloads] = useState<Array<{
    _id: string;
    title: string;
    status: string;
    progressPct?: number;
    reason?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    episodeTitle?: string | null;
  }>>([]);
  const [activity, setActivity] = useState<{
    history: Array<{ _id: string; tmdbId: number; mediaType: string; watchedAt?: string }>;
    ratings: Array<{ _id: string; tmdbId: number; mediaType: string; rating: string }>;
    hiddenTitles: Array<{ _id: string; tmdbId: number; mediaType: string }>;
  }>({ history: [], ratings: [], hiddenTitles: [] });

  useEffect(() => {
    Promise.all([
      fetch("/api/device-sessions").then((res) => res.json()).catch(() => []),
      fetch("/api/notifications").then((res) => res.json()).catch(() => ({ events: [] })),
      fetch("/api/downloads").then((res) => res.json()).catch(() => []),
      fetch("/api/profile-activity").then((res) => res.json()).catch(() => ({ history: [], ratings: [], hiddenTitles: [] })),
    ]).then(([deviceData, notificationData, downloadData, activityData]) => {
      if (Array.isArray(deviceData)) setDevices(deviceData);
      if (Array.isArray(notificationData?.events)) setNotifications(notificationData.events);
      if (Array.isArray(downloadData)) setDownloads(downloadData);
      setActivity({
        history: Array.isArray(activityData?.history) ? activityData.history : [],
        ratings: Array.isArray(activityData?.ratings) ? activityData.ratings : [],
        hiddenTitles: Array.isArray(activityData?.hiddenTitles) ? activityData.hiddenTitles : [],
      });
    });
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update password.");
    } else {
      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications]
  );

  async function requestBrowserNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permission,
        browserSupported: true,
        pushEnabled: permission === "granted",
      }),
    }).catch(() => {});
  }

  async function markAllNotificationsRead() {
    const ids = notifications.filter((item) => !item.readAt).map((item) => item._id);
    if (!ids.length) return;
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markReadIds: ids }),
    }).catch(() => {});
    setNotifications((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))
    );
  }

  async function toggleTrusted(sessionKey: string, trusted: boolean) {
    await fetch("/api/device-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, trusted }),
    }).catch(() => {});
    setDevices((current) =>
      current.map((item) => (item.sessionKey === sessionKey ? { ...item, trusted } : item))
    );
  }

  async function removeDevice(sessionKey: string) {
    await fetch("/api/device-sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    }).catch(() => {});
    setDevices((current) => current.filter((item) => item.sessionKey !== sessionKey));
  }

  async function resetRecommendations() {
    await fetch("/api/profile-activity-reset", { method: "POST" }).catch(() => {});
    setActivity((current) => ({ ...current, ratings: [], hiddenTitles: [], history: [] }));
  }

  return (
    <div className="min-h-screen bg-[#141414] px-6 py-20">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-10 text-3xl font-bold text-white">Account</h1>

        <div className="mb-8 rounded bg-[#1a1a1a] px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Email</p>
          <p className="mt-1 text-white">{email}</p>
        </div>

        <div className="mb-8 rounded bg-[#1a1a1a] px-6 py-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Devices & Sessions</h2>
              <p className="mt-1 text-sm text-white/45">Track active browsers and trusted devices for this account.</p>
            </div>
          </div>
          <div className="space-y-3">
            {devices.length > 0 ? devices.map((device) => (
              <div key={device._id} className="rounded border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{device.label}</p>
                    <p className="text-xs text-white/45">
                      Last seen {new Date(device.lastSeenAt).toLocaleString()}
                      {device.lastPath ? ` • ${device.lastPath}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTrusted(device.sessionKey, !device.trusted)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        device.trusted ? "bg-white text-black" : "bg-white/10 text-white"
                      }`}
                    >
                      {device.trusted ? "Trusted" : "Trust"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDevice(device.sessionKey)}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/65 transition hover:border-white/25 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-white/45">No device sessions recorded yet.</p>
            )}
          </div>
        </div>

        <div className="mb-8 rounded bg-[#1a1a1a] px-6 py-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
              <p className="mt-1 text-sm text-white/45">
                Release reminders, download updates, and in-app alerts. {unreadNotifications > 0 ? `${unreadNotifications} unread.` : "All caught up."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={requestBrowserNotifications}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200"
              >
                Enable browser alerts
              </button>
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="rounded-full border border-white/12 px-4 py-2 text-sm text-white/75 transition hover:border-white/24 hover:text-white"
              >
                Mark all read
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {notifications.slice(0, 8).map((item) => (
              <div key={item._id} className="rounded border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="mt-1 text-sm text-white/55">{item.body}</p>
                <p className="mt-2 text-xs text-white/35">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {notifications.length === 0 && <p className="text-sm text-white/45">No notifications yet.</p>}
          </div>
        </div>

        <div className="mb-8 rounded bg-[#1a1a1a] px-6 py-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Profile Activity</h2>
              <p className="mt-1 text-sm text-white/45">
                Review recent history, ratings, hidden titles, and reset recommendations if this profile needs a clean slate.
              </p>
            </div>
            <button
              type="button"
              onClick={resetRecommendations}
              className="rounded-full border border-white/12 px-4 py-2 text-sm text-white/75 transition hover:border-white/24 hover:text-white"
            >
              Reset recommendations
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">History</p>
              <p className="mt-2 text-3xl font-black text-white">{activity.history.length}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">Ratings</p>
              <p className="mt-2 text-3xl font-black text-white">{activity.ratings.length}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">Hidden Titles</p>
              <p className="mt-2 text-3xl font-black text-white">{activity.hiddenTitles.length}</p>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded bg-[#1a1a1a] px-6 py-5">
          <h2 className="mb-5 text-lg font-semibold text-white">Offline Queue</h2>
          <div className="space-y-3">
            {downloads.length > 0 ? downloads.map((download) => (
              <div key={download._id} className="rounded border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-sm font-medium text-white">
                  {download.title}
                  {download.seasonNumber && download.episodeNumber
                    ? ` S${download.seasonNumber}:E${download.episodeNumber}`
                    : ""}
                </p>
                {download.episodeTitle ? (
                  <p className="mt-1 text-xs text-white/40">{download.episodeTitle}</p>
                ) : null}
                <p className="mt-1 text-xs text-white/45">
                  {download.status === "unsupported"
                    ? download.reason || "Not supported in this browser yet."
                    : download.status === "downloading"
                      ? `Downloading ${download.progressPct ?? 0}%`
                      : download.status === "completed"
                        ? "Available offline on the device that downloaded it."
                        : `Status: ${download.status}`}
                </p>
              </div>
            )) : (
              <p className="text-sm text-white/45">Your offline queue is empty.</p>
            )}
          </div>
        </div>

        <div className="rounded bg-[#1a1a1a] px-6 py-5">
          <h2 className="mb-5 text-lg font-semibold text-white">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {error && (
              <p className="rounded bg-orange-600/20 px-4 py-3 text-sm text-orange-300">{error}</p>
            )}
            {message && (
              <p className="rounded bg-green-600/20 px-4 py-3 text-sm text-green-300">{message}</p>
            )}
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded bg-[#333] px-4 py-3 text-white placeholder-gray-400 outline-none focus:bg-[#454545]"
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded bg-[#333] px-4 py-3 text-white placeholder-gray-400 outline-none focus:bg-[#454545]"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded bg-[#333] px-4 py-3 text-white placeholder-gray-400 outline-none focus:bg-[#454545]"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Update Password"}
            </button>
          </form>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-6 w-full rounded border border-gray-600 py-3 text-sm text-gray-300 transition hover:border-white hover:text-white"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
