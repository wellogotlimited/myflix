"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Lightning } from "@phosphor-icons/react";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { useCurrentProfile } from "@/lib/use-current-profile";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { profile } = useCurrentProfile();

  const isHidden =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/profiles" ||
    pathname.startsWith("/watch/");

  if (isHidden) return null;

  const tabs = [
    {
      label: "Home",
      href: "/",
      icon: (active: boolean) => (
        <House size={24} weight={active ? "fill" : "regular"} />
      ),
    },
    {
      label: "New & Hot",
      href: "/new-and-upcoming",
      icon: (active: boolean) => (
        <Lightning size={24} weight={active ? "fill" : "regular"} />
      ),
    },
    {
      label: "Profile",
      href: "/my-netflix",
      icon: (_active: boolean) =>
        profile ? (
          <ProfileAvatar
            avatarId={profile.avatarId}
            name={profile.name}
            size={26}
            className="rounded-md"
          />
        ) : (
          <div className="h-[26px] w-[26px] rounded-md bg-white/20" />
        ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around bg-black/90 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:hidden">
      {tabs.map(({ label, href, icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-6 py-3 text-xs ${
              active ? "text-white" : "text-gray-400"
            }`}
          >
            {icon(active)}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
