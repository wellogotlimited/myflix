"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const EXCLUDED_PATHS = ["/onboarding", "/profiles", "/login", "/register"];

export default function OnboardingGuard() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const lastCheckedProfileId = useRef<string | null>(null);

  const profileId = session?.user?.profileId ?? null;

  useEffect(() => {
    if (!profileId) return;
    if (lastCheckedProfileId.current === profileId) return;
    if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) return;

    lastCheckedProfileId.current = profileId;

    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsOnboarding) {
          router.push("/onboarding");
        }
      })
      .catch(() => {});
  }, [profileId, pathname, router]);

  return null;
}
