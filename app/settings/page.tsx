import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AppSettingsContent from "@/components/AppSettingsContent";

export const metadata = { title: "Settings - Popflix" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");

  return (
    <main className="min-h-screen bg-[#141414] px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
            Preferences
          </p>
          <h1 className="mt-3 text-4xl font-black text-white">Settings</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
            These playback and developer options are stored on this device, just like the mobile settings sheet.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#1a1a1a] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <AppSettingsContent />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/profiles/manage"
            className="rounded-full border border-white/14 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/26 hover:bg-white/6"
          >
            Manage Profiles
          </Link>
          <Link
            href="/account"
            className="rounded-full border border-white/14 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/26 hover:bg-white/6"
          >
            Account
          </Link>
        </div>
      </div>
    </main>
  );
}
