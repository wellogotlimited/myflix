"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";

type ScanState = "starting" | "ready" | "unsupported" | "error";

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
};

function extractPairToken(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.searchParams.get("token");
  } catch {
    return null;
  }
}

export default function ScanQrPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [state, setState] = useState<ScanState>("starting");
  const [manualUrl, setManualUrl] = useState("");
  const [error, setError] = useState("");

  const stopScanner = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const requestCameraAndScan = useCallback(async () => {
    const BarcodeDetectorAPI =
      typeof window !== "undefined"
        ? ((window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null)
        : null;

    setError("");
    setState("starting");
    stopScanner();

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }

    if (!BarcodeDetectorAPI) {
      setState("unsupported");
      setError("QR scanning is not available in this browser. Paste the TV URL below instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new BarcodeDetectorAPI({ formats: ["qr_code"] });
      setState("ready");

      const scan = async () => {
        if (!videoRef.current) return;

        try {
          const results = await detector.detect(videoRef.current);
          const rawValue = results[0]?.rawValue;
          const token = rawValue ? extractPairToken(rawValue) : null;

          if (token) {
            router.replace(`/pair?token=${encodeURIComponent(token)}`);
            return;
          }
        } catch {
          setError("Could not read that QR code.");
        }

        frameRef.current = window.requestAnimationFrame(() => {
          void scan();
        });
      };

      void scan();
    } catch {
      setState("error");
      setError("Camera access was blocked. Allow camera access and try again.");
    }
  }, [router, stopScanner]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void requestCameraAndScan();
    });

    return () => {
      cancelAnimationFrame(frameId);
      stopScanner();
    };
  }, [requestCameraAndScan, stopScanner]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = extractPairToken(manualUrl.trim());
    if (!token) {
      setError("That QR URL is missing a token.");
      return;
    }

    router.replace(`/pair?token=${encodeURIComponent(token)}`);
  }

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-5 text-white">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/70"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <h1 className="text-2xl font-semibold">Scan QR</h1>
      <p className="mt-2 text-sm leading-6 text-white/55">
        Scan the TV QR code. We will grab the URL token and open the pairing page.
      </p>

      {state === "starting" && (
        <p className="mt-4 text-sm text-white/55">Requesting camera access...</p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl bg-black/70 ring-1 ring-white/10">
        <video
          ref={videoRef}
          muted
          playsInline
          className="aspect-[3/4] w-full object-cover"
        />
      </div>

      {state === "unsupported" && (
        <p className="mt-4 text-sm text-white/55">
          This browser does not support QR scanning here. Paste the QR URL below instead.
        </p>
      )}

      {state === "error" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => {
              void requestCameraAndScan();
            }}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
          >
            Request Camera Again
          </button>
        </div>
      )}

      {error && state !== "error" && (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      )}

      <form onSubmit={handleManualSubmit} className="mt-6 space-y-3">
        <input
          type="url"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="Paste the QR URL"
          className="w-full rounded-xl bg-white/8 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-white/25"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
