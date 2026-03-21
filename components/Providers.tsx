"use client";

import { SessionProvider } from "next-auth/react";
import AppBootstrap from "@/components/AppBootstrap";
import { ProfileSessionProvider } from "@/lib/profile-session";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ProfileSessionProvider>
        <AppBootstrap />
        {children}
      </ProfileSessionProvider>
    </SessionProvider>
  );
}
