"use client";

import { SessionProvider } from "next-auth/react";
import { ProfileSessionProvider } from "@/lib/profile-session";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ProfileSessionProvider>{children}</ProfileSessionProvider>
    </SessionProvider>
  );
}
