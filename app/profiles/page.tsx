import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase, ProfileModel, serializeDocuments } from "@/lib/db";
import ProfileSelector from "@/components/profile/ProfileSelector";

export const metadata = { title: "Who's watching? - Popflix" };

export default async function ProfilesPage() {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");

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

  return <ProfileSelector profiles={serialized} />;
}
