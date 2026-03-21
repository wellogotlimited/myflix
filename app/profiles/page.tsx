import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase, ProfileModel, serializeDocuments } from "@/lib/db";
import ProfileSelector from "@/components/profile/ProfileSelector";
import TvHomeGate from "@/components/tv/TvHomeGate";
import { sanitizeCallbackUrl } from "@/lib/pairing";

export const metadata = { title: "Who's watching? - Popflix" };

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");
  const { callbackUrl } = await searchParams;

  await connectToDatabase();
  const profiles = serializeDocuments(
    await ProfileModel.find({ accountId: session.user.accountId })
      .sort({ createdAt: 1 })
      .lean()
  );

  const serialized = profiles.map((p) => ({
    _id: p._id,
    name: p.name,
    avatarId: p.avatarId,
    maturityLevel: p.maturityLevel,
    hasPin: !!p.pin,
  }));

  return (
    <TvHomeGate>
      <ProfileSelector
        profiles={serialized}
        callbackUrl={sanitizeCallbackUrl(callbackUrl, "/")}
      />
    </TvHomeGate>
  );
}
