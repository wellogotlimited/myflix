"use client";

import { usePathname } from "next/navigation";

export default function PortraitLock() {
  const pathname = usePathname();
  if (pathname.startsWith("/watch")) return null;

  return (
    <div className="portrait-lock fixed inset-0 z-[9999] flex-col items-center justify-center gap-4 bg-black">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 256 256" fill="white" opacity="0.7">
        <path d="M200,136v56a16,16,0,0,1-16,16H72a16,16,0,0,1-16-16V64A16,16,0,0,1,72,48h56a8,8,0,0,1,0,16H72V192H184V136a8,8,0,0,1,16,0Zm21.66-53.66-32-32a8,8,0,0,0-11.32,11.32L196.69,80H152a8,8,0,0,0,0,16h44.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,221.66,82.34Z"/>
      </svg>
      <p className="text-sm text-white/60">Please rotate your device</p>
    </div>
  );
}
