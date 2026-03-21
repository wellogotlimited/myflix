"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import BrandWordmark from "@/components/BrandWordmark";
import { useProfileSession } from "@/lib/profile-session";
import TvConnectButton from "@/components/tv/TvConnectButton";

export default function MobileHeader() {
  const { profileName } = useProfileSession();
  const pathname = usePathname();

  const isHidden =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/profiles" ||
    pathname === "/tv" ||
    pathname.startsWith("/watch/");

  if (isHidden) return null;

  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-5 md:hidden">
      {profileName ? (
        <span className="text-2xl font-bold text-white">{`For ${profileName}`}</span>
      ) : (
        <BrandWordmark size={28} textClassName="text-2xl font-bold text-white" />
      )}
      <div className="flex items-center gap-4">
        <TvConnectButton />
        <Link href="/search" className="text-white">
          <MagnifyingGlass size={28} weight="bold" />
        </Link>
      </div>
    </div>
  );
}
