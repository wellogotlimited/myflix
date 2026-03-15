import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase, isValidObjectId, ProfileModel, serializeDocument, toObjectId } from "@/lib/db";
import EditProfileForm from "@/components/profile/EditProfileForm";

export const metadata = { title: "Edit Profile вЂ” MyFlix" };

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const profile = serializeDocument(
    await ProfileModel.findOne({
      _id: toObjectId(id),
      accountId: session.user.accountId,
    }).lean()
  );

  if (!profile) notFound();

  return (
    <EditProfileForm
      profile={{
        _id: profile._id,
        name: profile.name,
        avatarId: profile.avatarId,
        maturityLevel: profile.maturityLevel,
        isKidsProfile: profile.isKidsProfile,
      }}
    />
  );
}
