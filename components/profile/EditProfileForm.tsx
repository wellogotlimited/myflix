"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AVATAR_PRESETS } from "@/lib/avatars";

interface ProfileData {
  _id: string;
  name: string;
  avatarId: string;
  maturityLevel: string;
  isKidsProfile: boolean;
  hasPin: boolean;
}

export default function EditProfileForm({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [name, setName] = useState(profile.name);
  const [avatarId, setAvatarId] = useState(profile.avatarId);
  const [maturityLevel, setMaturityLevel] = useState(profile.maturityLevel);
  const [isKidsProfile, setIsKidsProfile] = useState(profile.isKidsProfile);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // PIN state
  const [currentHasPin, setCurrentHasPin] = useState(profile.hasPin);
  const [pinSection, setPinSection] = useState<"idle" | "set">("idle");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch(`/api/profile/${profile._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatarId, maturityLevel, isKidsProfile }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save.");
      return;
    }

    if (session?.user?.profileId === profile._id) {
      await update({ profileId: profile._id });
    }

    router.push("/profiles/manage");
  }

  async function handleDelete() {
    if (!confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) return;
    setDeleting(true);

    const res = await fetch(`/api/profile/${profile._id}`, { method: "DELETE" });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to delete.");
      return;
    }

    router.push("/profiles/manage");
  }

  async function handleSavePin() {
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("PIN must be exactly 4 digits");
      return;
    }
    setPinSaving(true);
    setPinError("");
    const res = await fetch(`/api/profile/${profile._id}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinInput }),
    });
    setPinSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPinError(data.error ?? "Failed to save PIN.");
      return;
    }
    setCurrentHasPin(true);
    setPinSection("idle");
    setPinInput("");
  }

  async function handleRemovePin() {
    if (!confirm("Remove PIN from this profile?")) return;
    setPinSaving(true);
    const res = await fetch(`/api/profile/${profile._id}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: null }),
    });
    setPinSaving(false);
    if (res.ok) setCurrentHasPin(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#141414] px-6 py-16">
      <h1 className="mb-10 text-4xl font-medium tracking-wide text-white">Edit Profile</h1>

      <form onSubmit={handleSave} className="w-full max-w-md space-y-6">
        {error && (
          <p className="rounded bg-orange-600/20 px-4 py-3 text-sm text-orange-300">{error}</p>
        )}

        {/* Avatar picker */}
        <div>
          <p className="mb-3 text-sm font-medium text-gray-300">Avatar</p>
          <div className="flex flex-wrap gap-3">
            {AVATAR_PRESETS.map((preset) => {
              const initial = name.charAt(0).toUpperCase() || "?";
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAvatarId(preset.id)}
                  className={`flex h-12 w-12 items-center justify-center rounded-md font-bold text-white text-lg transition ${
                    avatarId === preset.id
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#141414]"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: preset.color }}
                >
                  {initial}
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            required
            className="w-full rounded bg-[#333] px-4 py-3 text-white outline-none focus:bg-[#454545]"
          />
        </div>

        {/* Maturity level */}
        <div>
          <p className="mb-3 text-sm font-medium text-gray-300">Maturity Rating</p>
          <div className="flex gap-3">
            {(["KIDS", "TEEN", "ADULT"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  setMaturityLevel(level);
                  if (level === "KIDS") setIsKidsProfile(true);
                  else setIsKidsProfile(false);
                }}
                className={`flex-1 rounded border py-2 text-sm font-medium transition ${
                  maturityLevel === level
                    ? "border-white bg-white text-black"
                    : "border-gray-600 text-gray-400 hover:border-white hover:text-white"
                }`}
              >
                {level.charAt(0) + level.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {maturityLevel === "KIDS" && "Shows content rated G, TV-Y, TV-G only"}
            {maturityLevel === "TEEN" && "Shows content rated up to PG-13 / TV-14"}
            {maturityLevel === "ADULT" && "No content restrictions"}
          </p>
        </div>

        {/* PIN lock */}
        <div className="border-t border-white/10 pt-6">
          <p className="mb-3 text-sm font-medium text-gray-300">Profile PIN</p>
          <p className="mb-4 text-xs text-gray-500">
            Require a 4-digit PIN when switching to this profile.
          </p>

          {pinSection === "idle" ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setPinSection("set"); setPinInput(""); setPinError(""); }}
                className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 transition hover:border-white hover:text-white"
              >
                {currentHasPin ? "Change PIN" : "Set PIN"}
              </button>
              {currentHasPin && (
                <button
                  type="button"
                  onClick={handleRemovePin}
                  disabled={pinSaving}
                  className="rounded border border-red-800 px-4 py-2 text-sm text-red-500 transition hover:border-red-500 hover:text-red-400 disabled:opacity-60"
                >
                  Remove PIN
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setPinError("");
                }}
                className="w-full rounded bg-[#333] px-4 py-3 text-white tracking-widest outline-none focus:bg-[#454545]"
              />
              {pinError && <p className="text-sm text-red-400">{pinError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSavePin}
                  disabled={pinInput.length !== 4 || pinSaving}
                  className="rounded bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-40"
                >
                  {pinSaving ? "Saving…" : "Save PIN"}
                </button>
                <button
                  type="button"
                  onClick={() => { setPinSection("idle"); setPinInput(""); setPinError(""); }}
                  className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-400 transition hover:border-white hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/profiles/manage")}
            className="flex-1 rounded border border-gray-600 py-3 text-sm text-gray-300 transition hover:border-white hover:text-white"
          >
            Cancel
          </button>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full rounded border border-red-800 py-3 text-sm text-red-500 transition hover:border-red-500 hover:text-red-400 disabled:opacity-60"
        >
          {deleting ? "Deleting…" : "Delete Profile"}
        </button>
      </form>
    </div>
  );
}
