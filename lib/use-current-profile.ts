"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export interface Profile {
  _id: string;
  name: string;
  avatarId: string;
  maturityLevel: string;
}

export function useCurrentProfile() {
  const { data: session } = useSession();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (!session?.user?.accountId) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfiles)
      .catch(() => {});
  }, [session?.user?.accountId, session?.user?.profileId]);

  const current = profiles.find((p) => p._id === session?.user?.profileId) ?? null;

  return { profile: current, profiles };
}
