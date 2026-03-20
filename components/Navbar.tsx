"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import BrandWordmark from "@/components/BrandWordmark";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Movies", href: "/movies" },
  { label: "My List", href: "/my-list" },
  { label: "New & Upcoming", href: "/new-and-upcoming" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isWatchPage = pathname.startsWith("/watch/");
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/profiles";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
    }
  }

  if (isAuthPage) return null;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-6 px-6 py-4 transition-all duration-300 ${
        isWatchPage
          ? "pointer-events-none -translate-y-full opacity-0"
          : scrolled
            ? "bg-[#141414]/96 backdrop-blur-md"
            : "bg-gradient-to-b from-black/90 via-black/45 to-transparent"
      }`}
    >
      <div className="flex min-w-0 items-center gap-8">
        <Link href="/" className="shrink-0">
          <BrandWordmark
            size={34}
            priority
            textClassName="text-xl font-bold tracking-wide text-white"
          />
        </Link>

        <div className="hidden items-center gap-5 text-sm text-white/78 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`transition hover:text-white ${
                pathname === item.href ? "text-white" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ProfileSwitcher />
        {searchOpen ? (
          <form onSubmit={handleSearch} className="flex items-center">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => !query && setSearchOpen(false)}
              placeholder="Titles, genres..."
              className="w-56 bg-black/80 border border-white/30 px-3 py-1.5 text-sm text-white placeholder-gray-400 outline-none focus:border-white/60"
            />
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        )}
      </div>
    </nav>
  );
}
