"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { backdropUrl } from "@/lib/tmdb";

interface MaturityBlockedProps {
  title: string;
  backdropPath: string | null;
}

export default function MaturityBlocked({ title, backdropPath }: MaturityBlockedProps) {
  const router = useRouter();

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black text-white">
      {backdropPath && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${backdropUrl(backdropPath, "w1280")})` }}
        />
      )}
      <div className="relative z-10 text-center px-6 max-w-lg">
        <h1 className="text-3xl font-bold mb-3">{title}</h1>
        <p className="text-gray-300 mb-8">
          This content is not available for your maturity rating.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 rounded bg-white text-black font-semibold hover:bg-gray-200 transition"
          >
            Go Back
          </button>
          <Link
            href="/profiles"
            className="px-6 py-2 rounded border border-white text-white font-semibold hover:bg-white/10 transition"
          >
            Switch Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
