"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <html lang="en">
      <body className="bg-[#111111]">
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(229,9,20,0.24),transparent_30%)]" />
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e50914]/10 blur-3xl" />

          <section className="relative z-10 flex max-w-xl flex-col items-center text-center">
            <p className="text-[72px] font-black leading-none tracking-[-0.08em] text-white md:text-[120px]">
              Uh-oh
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-5xl">
              The app crashed.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/65 md:text-base">
              A bigger error stopped MyFlix from rendering. Retry once, or go home and reload the app.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Retry App
              </button>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 bg-white/6 px-6 text-sm font-semibold text-white transition hover:border-white/24 hover:bg-white/10"
              >
                Back Home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
