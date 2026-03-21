"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { MagnifyingGlass, List, CaretDown, X, Gear, UserList, UserCircle, SignOut } from "@phosphor-icons/react";
import AppSettingsContent from "@/components/AppSettingsContent";
import MyListContent from "@/components/MyListContent";
import NotificationBell from "@/components/NotificationBell";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import MediaCard from "@/components/MediaCard";
import { useMyList } from "@/lib/my-list";
import { useCurrentProfile } from "@/lib/use-current-profile";

export default function MyNetflixPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myListOpen, setMyListOpen] = useState(false);
  const [follows, setFollows] = useState<Array<{ _id: string; name: string; overlap: number }>>([]);
  const { profile, profiles } = useCurrentProfile();
  const { items } = useMyList();

  const previewItems = useMemo(
    () => [...items].sort((a, b) => b.savedAt - a.savedAt).slice(0, 8),
    [items]
  );

  async function switchProfile(profileId: string) {
    setSheetOpen(false);
    await update({ profileId });
    router.push("/");
    router.refresh();
  }

  const otherProfiles = profiles.filter((p) => p._id !== session?.user?.profileId);

  useEffect(() => {
    void fetch("/api/social/follows")
      .then((res) => res.json())
      .then((followData) => {
        if (Array.isArray(followData)) setFollows(followData);
      })
      .catch(() => {});
  }, []);

  async function toggleFollow(profileId: string) {
    const alreadyFollowing = follows.some((item) => item._id === profileId);
    await fetch("/api/social/follows", {
      method: alreadyFollowing ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followeeProfileId: profileId }),
    }).catch(() => {});
    setFollows((current) =>
      alreadyFollowing
        ? current.filter((item) => item._id !== profileId)
        : [
            ...current,
            {
              _id: profileId,
              name: otherProfiles.find((item) => item._id === profileId)?.name ?? "Profile",
              overlap: 0,
            },
          ]
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <div
        className={`transition duration-300 ${
          myListOpen ? "scale-[0.5] opacity-50 blur-[2px]" : "scale-100 opacity-100"
        }`}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5">
        <h1 className="text-xl font-bold text-white">Profile</h1>
        <div className="flex items-center gap-5">
          <Link href="/search" className="text-white">
            <MagnifyingGlass size={22} />
          </Link>
          <NotificationBell size={20} />
          <button onClick={() => setMenuOpen(true)} className="text-white">
            <List size={22} />
          </button>
        </div>
      </div>

      {/* Profile section */}
      <div className="flex flex-col items-center gap-3 py-6">
        {profile ? (
          <ProfileAvatar
            avatarId={profile.avatarId}
            name={profile.name}
            size={84}
            className="rounded-xl"
          />
        ) : (
          <div className="h-[84px] w-[84px] rounded-xl bg-white/10" />
        )}
        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-1.5"
        >
          <span className="text-xl font-bold text-white">
            {profile?.name ?? session?.user?.profileName ?? ""}
          </span>
          <CaretDown size={18} className="text-white/70" />
        </button>
      </div>

      {/* My List preview */}
      {previewItems.length > 0 && (
        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between px-4">
            <h2 className="text-lg font-semibold text-white">My List</h2>
            <button
              type="button"
              onClick={() => setMyListOpen(true)}
              className="text-sm text-white/55 transition hover:text-white"
            >
              See All
            </button>
          </div>
          <div className="-my-6 flex gap-2.5 overflow-x-auto px-4 py-6 scrollbar-hide">
            {previewItems.map((item) => (
              <MediaCard
                key={`${item.media_type}-${item.id}`}
                item={item}
                portrait
              />
            ))}
          </div>
        </section>
      )}

      {otherProfiles.length > 0 && (
        <section className="mt-8 px-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-lg font-semibold text-white">Taste Overlap</h2>
            <div className="mt-4 space-y-3">
              {otherProfiles.map((otherProfile) => {
                const existing = follows.find((item) => item._id === otherProfile._id);
                return (
                  <div key={otherProfile._id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{otherProfile.name}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {existing ? `${Math.round(existing.overlap * 100)}% taste overlap` : "Not followed yet"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFollow(otherProfile._id)}
                      className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                        existing ? "bg-white text-black" : "bg-white/10 text-white"
                      }`}
                    >
                      {existing ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
      </div>

      {myListOpen && (
        <div className="fixed inset-0 z-[75]" onClick={() => setMyListOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="absolute inset-x-0 bottom-0 top-[10vh] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#141414] shadow-[0_-30px_80px_rgba(0,0,0,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="mt-1 text-xl font-bold text-white">My List</h3>
              </div>
              <button
                type="button"
                onClick={() => setMyListOpen(false)}
                className="rounded-full bg-white/8 p-2 text-white/75 transition hover:bg-white/12 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="h-[calc(90vh-88px)] overflow-y-auto px-4 py-4">
              <MyListContent variant="sheet" />
            </div>
          </div>
        </div>
      )}

      {/* Hamburger menu bottom sheet */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#1a1a1a] pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="font-semibold text-white">Menu</h3>
              <button onClick={() => setMenuOpen(false)} className="text-white/60">
                <X size={20} />
              </button>
            </div>
            <div className="py-2">
              <button
                onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}
                className="flex w-full items-center gap-4 px-5 py-4 text-white active:bg-white/5"
              >
                <Gear size={22} className="text-white/60" />
                <span className="text-sm font-medium">Settings</span>
              </button>
              <button
                onClick={() => { setMenuOpen(false); router.push("/profiles/manage"); }}
                className="flex w-full items-center gap-4 px-5 py-4 text-white active:bg-white/5"
              >
                <UserList size={22} className="text-white/60" />
                <span className="text-sm font-medium">Manage Profiles</span>
              </button>
              <button
                onClick={() => { setMenuOpen(false); router.push("/account"); }}
                className="flex w-full items-center gap-4 px-5 py-4 text-white active:bg-white/5"
              >
                <UserCircle size={22} className="text-white/60" />
                <span className="text-sm font-medium">Account</span>
              </button>
              <div className="mx-5 my-1 border-t border-white/10" />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-4 px-5 py-4 text-red-400 active:bg-white/5"
              >
                <SignOut size={22} />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings bottom sheet */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[70]" onClick={() => setSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#1a1a1a] pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="font-semibold text-white">Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className="text-white/60">
                <X size={20} />
              </button>
            </div>
            <div className="py-2">
              <AppSettingsContent />
            </div>
          </div>
        </div>
      )}

      {/* Switch profiles bottom sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setSheetOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#1a1a1a] pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="font-semibold text-white">Switch Profiles</h3>
              <button onClick={() => setSheetOpen(false)} className="text-white/60">
                <X size={20} />
              </button>
            </div>

            {otherProfiles.length > 0 && (
              <div className="flex gap-5 overflow-x-auto px-5 py-4 scrollbar-hide">
                {otherProfiles.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => switchProfile(p._id)}
                    className="flex flex-shrink-0 flex-col items-center gap-2"
                  >
                    <ProfileAvatar
                      avatarId={p.avatarId}
                      name={p.name}
                      size={60}
                      className="rounded-lg"
                    />
                    <span className="text-xs text-white/80">{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-white/10">
              <button
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/profiles/manage");
                }}
                className="w-full px-5 py-4 text-left text-sm text-white/70 hover:text-white"
              >
                Manage Profiles
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full px-5 py-4 text-left text-sm text-white/70 hover:text-white"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
