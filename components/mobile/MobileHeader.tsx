"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useProfileSession } from "@/lib/profile-session";

export default function MobileHeader() {
  const { profileName } = useProfileSession();
  const pathname = usePathname();

  const isHidden =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/profiles" ||
    pathname.startsWith("/watch/");

  if (isHidden) return null;

  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-5 md:hidden">
      <span className="text-2xl font-bold text-white">
        {profileName ? `For ${profileName}` : "MyFlix"}
      </span>
      <Link href="/search" className="text-white">
        <MagnifyingGlass size={28} weight="bold" />
      </Link>
    </div>
  );
}
