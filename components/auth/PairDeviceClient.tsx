"use client";

import BrandWordmark from "@/components/BrandWordmark";

type PairState = "approving" | "success" | "error";

export default function PairDeviceClient({ state }: { state: PairState }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080808]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.14),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_22%)]" />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <BrandWordmark
          size={40}
          className="mb-10"
          textClassName="text-2xl font-medium tracking-[0.14em] text-white/88 uppercase"
          priority
        />

        {state === "approving" && (
          <>
            <h1 className="text-4xl font-medium tracking-[-0.02em] text-white/92">
              Connecting your TV
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-white/58">
              Hold on for a moment while we finish signing the TV in.
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <h1 className="text-4xl font-medium tracking-[-0.02em] text-white/92">
              TV connected
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-white/58">
              You can go back to your TV now. It should sign in automatically.
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="text-4xl font-medium tracking-[-0.02em] text-white/92">
              This pairing link expired
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-white/58">
              Go back to the TV and refresh the screen to generate a new QR code.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
