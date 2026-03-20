"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ProfileAvatar from "./ProfileAvatar";
import PinEntryModal from "./PinEntryModal";

interface Profile {
  _id: string;
  name: string;
  avatarId: string;
  maturityLevel: string;
  hasPin?: boolean;
}

export default function ProfileSelector({
  profiles,
  callbackUrl,
}: {
  profiles: Profile[];
  callbackUrl?: string | null;
}) {
  const { update } = useSession();
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  async function selectProfile(profile: Profile) {
    setSwitching(profile._id);
    setError("");

    try {
      const nextSession = await update({ profileId: profile._id });
      if (nextSession?.user?.profileId !== profile._id) {
        throw new Error("Profile switch did not persist");
      }

      window.location.replace(callbackUrl || "/");
    } catch {
      setError("Failed to open this profile. Try again.");
      setSwitching(null);
    }
  }

  function handleSelect(profile: Profile) {
    if (profile.hasPin) {
      setPinProfile(profile);
      return;
    }
    selectProfile(profile);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#141414]">
      <h1 className="mb-12 text-4xl font-medium tracking-wide text-white">
        Who&apos;s watching?
      </h1>

      {error && (
        <p className="mb-6 rounded bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-6">
        {profiles.map((profile) => (
          <button
            key={profile._id}
            onClick={() => handleSelect(profile)}
            disabled={switching !== null}
            className="group flex flex-col items-center gap-3 transition-opacity disabled:opacity-50"
          >
            <div className="overflow-hidden rounded-md ring-2 ring-transparent transition group-hover:ring-white group-focus:ring-white">
              <ProfileAvatar
                avatarId={profile.avatarId}
                name={profile.name}
                size={128}
                className={switching === profile._id ? "opacity-60" : ""}
              />
            </div>
            <span className="text-sm text-gray-400 transition group-hover:text-white">
              {profile.name}
            </span>
          </button>
        ))}

        {profiles.length < 5 && (
          <button
            onClick={() => router.push("/profiles/manage")}
            className="group flex flex-col items-center gap-3"
          >
            <div className="flex h-32 w-32 items-center justify-center rounded-md border-2 border-gray-600 text-5xl text-gray-600 transition group-hover:border-white group-hover:text-white">
              +
            </div>
            <span className="text-sm text-gray-400 transition group-hover:text-white">
              Add Profile
            </span>
          </button>
        )}
      </div>

      <button
        onClick={() => router.push("/profiles/manage")}
        className="mt-12 border border-gray-500 px-8 py-2 text-sm tracking-widest text-gray-400 transition hover:border-white hover:text-white"
      >
        MANAGE PROFILES
      </button>

      {pinProfile && (
        <PinEntryModal
          profile={pinProfile}
          onSuccess={() => {
            // Capture the non-null profile before clearing state
            const p: Profile = pinProfile;
            setPinProfile(null);
            selectProfile(p);
          }}
          onCancel={() => {
            setPinProfile(null);
            setSwitching(null);
          }}
        />
      )}
    </div>
  );
}
