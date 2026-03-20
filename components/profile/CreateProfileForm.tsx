"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_PRESETS, type AvatarId } from "@/lib/avatars";

export default function CreateProfileForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>(AVATAR_PRESETS[0].id);
  const [maturityLevel, setMaturityLevel] = useState<"KIDS" | "TEEN" | "ADULT">("ADULT");
  const [isKidsProfile, setIsKidsProfile] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatarId, maturityLevel, isKidsProfile }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create profile.");
      return;
    }

    router.push("/profiles/manage");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#141414] px-6 py-16">
      <h1 className="mb-10 text-4xl font-medium tracking-wide text-white">Add Profile</h1>

      <form onSubmit={handleCreate} className="w-full max-w-md space-y-6">
        {error ? (
          <p className="rounded bg-orange-600/20 px-4 py-3 text-sm text-orange-300">{error}</p>
        ) : null}

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
                  className={`flex h-12 w-12 items-center justify-center rounded-md text-lg font-bold text-white transition ${
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

        <div>
          <p className="mb-3 text-sm font-medium text-gray-300">Maturity Rating</p>
          <div className="flex gap-3">
            {(["KIDS", "TEEN", "ADULT"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  setMaturityLevel(level);
                  setIsKidsProfile(level === "KIDS");
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
            {maturityLevel === "KIDS" && "Shows content rated G only"}
            {maturityLevel === "TEEN" && "Shows content rated up to PG-13"}
            {maturityLevel === "ADULT" && "No content restrictions"}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Profile"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/profiles/manage")}
            className="flex-1 rounded border border-gray-600 py-3 text-sm text-gray-300 transition hover:border-white hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
