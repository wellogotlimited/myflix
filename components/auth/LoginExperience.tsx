"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import BrandWordmark from "@/components/BrandWordmark";
import LoginForm from "@/components/auth/LoginForm";
import { detectTvMode } from "@/lib/tv-mode";

type LoginMode = "checking" | "tv" | "default";

export default function LoginExperience() {
  const [mode, setMode] = useState<LoginMode>("checking");
  const [continueUrl, setContinueUrl] = useState(() =>
    typeof window === "undefined" ? "https://popflix.app/login" : `${window.location.origin}/login`
  );
  const [pairError, setPairError] = useState("");
  const [pairingReady, setPairingReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void detectTvMode()
      .then((isTvMode) => {
        if (cancelled) return;
        setMode(isTvMode ? "tv" : "default");
      })
      .catch(() => {
        if (!cancelled) {
          setMode("default");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "tv" || typeof window === "undefined") return;

    let cancelled = false;
    let eventSource: EventSource | null = null;

    const startPairing = async () => {
      setPairError("");
      setPairingReady(false);

      const response = await fetch("/api/auth/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to start pairing");
      }

      const data = (await response.json()) as { token: string };
      if (cancelled) return;

      const pairUrl = `${window.location.origin}/pair?token=${encodeURIComponent(data.token)}`;
      setContinueUrl(pairUrl);
      setPairingReady(true);

      eventSource = new EventSource(`/api/auth/pair/${data.token}/events`);

      eventSource.addEventListener("state", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          status: "pending" | "approved" | "consumed";
          exchangeToken?: string;
        };

        if (payload.status === "approved" && payload.exchangeToken) {
          window.location.replace(
            `/api/auth/pair/exchange?token=${encodeURIComponent(payload.exchangeToken)}`
          );
        }
      });

      eventSource.addEventListener("approved", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          exchangeToken: string;
        };

        window.location.replace(
          `/api/auth/pair/exchange?token=${encodeURIComponent(payload.exchangeToken)}`
        );
      });

      eventSource.addEventListener("consumed", () => {
        eventSource?.close();
      });

      eventSource.onerror = () => {
        if (!cancelled && eventSource?.readyState === EventSource.CLOSED) {
          setPairError("Couldn't continue pairing. Refresh to try again.");
        }
      };
    };

    void startPairing().catch(() => {
      if (!cancelled) {
        setPairError("Couldn't start pairing. Refresh to try again.");
      }
    });

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, [mode]);

  if (mode === "checking") {
    return (
      <div className="min-h-screen bg-[#080808]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_24%)]" />
      </div>
    );
  }

  if (mode === "tv") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#080808]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.12),transparent_24%),radial-gradient(circle_at_50%_85%,rgba(255,255,255,0.05),transparent_18%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_30%,rgba(229,9,20,0.035)_100%)]" />

        <div className="relative flex min-h-screen flex-col items-center justify-center px-10 py-16 text-center">
          <BrandWordmark
            size={40}
            className="mb-12"
            textClassName="text-2xl font-medium tracking-[0.14em] text-white/88 uppercase"
            priority
          />

          <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.02em] text-white/92">
            Scan the QR code on your phone to continue
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/58">
            Open Popflix on your phone, sign in there, and continue from the mobile browser.
          </p>

          <div className="mt-14 flex h-[368px] w-[368px] items-center justify-center bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
            {pairingReady ? (
              <QRCode value={continueUrl} size={320} />
            ) : (
              <div className="h-[320px] w-[320px] bg-[#f2f2f2]" />
            )}
          </div>

          <div className="mt-8 text-base text-white/42">{pairError || continueUrl}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 bg-[url('/auth-bg.jpg')] bg-cover bg-center">
      <div className="w-full max-w-md rounded-md bg-black/80 px-12 py-12">
        <BrandWordmark
          size={34}
          className="mb-8"
          textClassName="text-2xl font-bold tracking-wide text-white"
        />
        <h1 className="mb-8 text-3xl font-bold text-white">Sign In</h1>
        <LoginForm />
        <p className="mt-6 text-sm text-gray-400">
          New to Popflix?{" "}
          <a href="/register" className="text-white hover:underline">
            Sign up now.
          </a>
        </p>
      </div>
    </div>
  );
}
