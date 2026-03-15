"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import ProfileAvatar from "./ProfileAvatar";

interface Profile {
  _id: string;
  name: string;
  avatarId: string;
  maturityLevel: string;
}

export default function ProfileSwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user?.accountId) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfiles)
      .catch(() => {});
  }, [session?.user?.accountId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!session?.user?.profileId) return null;

  const currentProfile = profiles.find((p) => p._id === session.user.profileId);

  async function switchProfile(profile: Profile) {
    setOpen(false);
    await update({ profileId: profile._id });
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-white transition hover:text-gray-300"
      >
        {currentProfile && (
          <ProfileAvatar
            avatarId={currentProfile.avatarId}
            name={currentProfile.name}
            size={28}
            className="rounded"
          />
        )}
        <span className="hidden text-sm lg:block">
          {session.user.profileName ?? "Profile"}
        </span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded bg-[#1a1a1a] shadow-xl ring-1 ring-white/10">
          {profiles
            .filter((p) => p._id !== session.user.profileId)
            .map((profile) => (
              <button
                key={profile._id}
                onClick={() => switchProfile(profile)}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
              >
                <ProfileAvatar avatarId={profile.avatarId} name={profile.name} size={24} />
                {profile.name}
              </button>
            ))}

          <div className="my-1 border-t border-white/10" />

          <button
            onClick={() => { setOpen(false); router.push("/profiles/manage"); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Manage Profiles
          </button>
          <button
            onClick={() => { setOpen(false); router.push("/account"); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Account
          </button>

          <div className="my-1 border-t border-white/10" />

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
