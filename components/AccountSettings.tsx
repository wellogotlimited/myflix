"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function AccountSettings({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#141414] px-6 py-20">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-10 text-3xl font-bold text-white">Account</h1>

        <div className="mb-8 rounded bg-[#1a1a1a] px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Email</p>
          <p className="mt-1 text-white">{email}</p>
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
