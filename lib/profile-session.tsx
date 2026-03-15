"use client";

import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { useSession } from "next-auth/react";

type ProfileSessionValue = {
  profileId: string | null;
  profileName: string | null;
  status: "authenticated" | "loading" | "unauthenticated";
};

const ProfileSessionContext = createContext<ProfileSessionValue>({
  profileId: null,
  profileName: null,
  status: "loading",
});

export function ProfileSessionProvider({ children }: PropsWithChildren) {
  const { data: session, status } = useSession();

  const value = useMemo(
    () => ({
      profileId: session?.user?.profileId ?? null,
      profileName: session?.user?.profileName ?? null,
      status,
    }),
    [session?.user?.profileId, session?.user?.profileName, status]
  );

  return (
    <ProfileSessionContext.Provider value={value}>
      {children}
    </ProfileSessionContext.Provider>
  );
}

export function useProfileSession() {
  return useContext(ProfileSessionContext);
}
