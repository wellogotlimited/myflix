"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isIOS, isSafari } from "react-device-detect";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type BannerMode = "ios" | "prompt" | null;

const IOS_DISMISS_KEY = "pwa-install-dismissed-ios";
const PROMPT_DISMISS_KEY = "pwa-install-dismissed-prompt";

function isStandalone() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export default function PWAInstallBanner() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [bannerMode, setBannerMode] = useState<BannerMode>(null);

  const hasMobileBottomNav =
    pathname !== "/login" &&
    pathname !== "/register" &&
    pathname !== "/profiles" &&
    !pathname.startsWith("/watch/");

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    function handleBeforeInstallPrompt(event: Event) {
      if (localStorage.getItem(PROMPT_DISMISS_KEY) || isStandalone()) return;

      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
      setBannerMode("prompt");
    }

    function syncBannerState() {
      if (isStandalone()) {
        setBannerMode(null);
        return;
      }

      if (isIOS) {
        if (!localStorage.getItem(IOS_DISMISS_KEY)) {
          setBannerMode("ios");
        }
        return;
      }

      if (localStorage.getItem(PROMPT_DISMISS_KEY)) {
        setBannerMode(null);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    const frame = window.requestAnimationFrame(syncBannerState);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstall() {
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      setPrompt(null);
      setBannerMode(null);
    }
  }

  function handleDismiss() {
    if (bannerMode === "ios") {
      localStorage.setItem(IOS_DISMISS_KEY, "1");
    }

    if (bannerMode === "prompt") {
      localStorage.setItem(PROMPT_DISMISS_KEY, "1");
      setPrompt(null);
    }

    setBannerMode(null);
  }

  if (!bannerMode) return null;

  const title = bannerMode === "ios" ? "Install on iOS" : "Add to Home Screen";
  const description =
    bannerMode === "ios"
      ? isSafari
        ? "Tap Share, then Add to Home Screen. It only takes a second."
        : "Tap Share, then Add to Home Screen. It only takes a second. If you do not see it here, open Popflix in Safari."
      : "Install Popflix for quick access. It only takes a second.";

  return (
    <div
      className={`fixed inset-x-0 z-40 px-3 pb-3 md:inset-auto md:bottom-6 md:left-auto md:right-6 md:w-96 md:px-0 md:pb-0 ${
        hasMobileBottomNav
          ? "bottom-[calc(env(safe-area-inset-bottom)+5rem)]"
          : "bottom-0"
      }`}
    >
      <div className="rounded-[1.75rem] rounded-b-xl border border-white/10 bg-[#1a1a1a]/96 px-5 pb-4 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.42)] backdrop-blur md:rounded-lg md:px-5 md:py-4 md:shadow-xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/18 md:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 md:space-y-0.5">
            <p className="text-base font-semibold text-white md:text-base">{title}</p>
            <p className="text-sm leading-6 text-gray-300 md:text-sm md:leading-6">{description}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="mt-0.5 shrink-0 text-sm text-gray-500 transition hover:text-gray-300"
            aria-label="Dismiss install banner"
          >
            X
          </button>
        </div>

        {bannerMode === "prompt" ? (
          <div className="mt-4 flex justify-end md:mt-3">
            <button
              onClick={handleInstall}
              className="rounded-full bg-[#e50914] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#f40612] md:rounded md:px-4 md:py-2 md:text-sm"
            >
              Install
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
