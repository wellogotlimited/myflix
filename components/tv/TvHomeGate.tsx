"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { detectTvMode } from "@/lib/tv-mode";
import TvStandbyScreen from "./TvStandbyScreen";

export default function TvHomeGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<"checking" | "tv" | "default">("checking");

  useEffect(() => {
    let cancelled = false;

    void detectTvMode()
      .then((isTv) => {
        if (cancelled) return;

        if (isTv) {
          setMode("tv");
          if (pathname !== "/tv") {
            router.replace("/tv");
          }
          return;
        }

        setMode("default");
      })
      .catch(() => {
        if (!cancelled) {
          setMode("default");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (mode === "checking" || mode === "tv") {
    return <TvStandbyScreen />;
  }

  return <>{children}</>;
}
