import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { connectToDatabase, ProfileModel, serializeDocuments } from "@/lib/db";
import ProfileAvatar from "@/components/profile/ProfileAvatar";

export const metadata = { title: "Manage Profiles - Popflix" };

export default async function ManageProfilesPage() {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");

  await connectToDatabase();
  const profiles = serializeDocuments(
    await ProfileModel.find({ accountId: session.user.accountId })
      .sort({ createdAt: 1 })
      .lean()
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#141414] px-6 py-16">
      <h1 className="mb-10 text-4xl font-medium tracking-wide text-white">Manage Profiles</h1>

      <div className="w-full max-w-xl space-y-3">
        {profiles.map((profile) => (
          <div
            key={profile._id}
            className="flex items-center justify-between rounded bg-[#1a1a1a] px-5 py-4"
          >
            <div className="flex items-center gap-4">
              <ProfileAvatar avatarId={profile.avatarId} name={profile.name} size={48} />
              <div>
                <p className="font-medium text-white">{profile.name}</p>
                <p className="text-xs text-gray-400">
                  {profile.isKidsProfile
                    ? "Kids"
                    : profile.maturityLevel.charAt(0) + profile.maturityLevel.slice(1).toLowerCase()}
                  {" · "}Maturity
                </p>
              </div>
            </div>
            <Link
              href={`/profiles/${profile._id}/edit`}
              className="rounded border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition hover:border-white hover:text-white"
            >
              Edit
            </Link>
          </div>
        ))}

        {profiles.length < 5 && (
          <Link
            href="/profiles/new"
            className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-gray-600 py-4 text-sm text-gray-400 transition hover:border-white hover:text-white"
          >
            + Add Profile
          </Link>
        )}
      </div>

      <Link
        href="/profiles"
        className="mt-10 border border-gray-500 px-8 py-2 text-sm tracking-widest text-gray-400 transition hover:border-white hover:text-white"
      >
        DONE
      </Link>
    </div>
  );
}
