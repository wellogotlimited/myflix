import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase, ProfileModel } from "@/lib/db";
import CreateProfileForm from "@/components/profile/CreateProfileForm";

export const metadata = { title: "Add Profile - Popflix" };

export default async function NewProfilePage() {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");

  await connectToDatabase();
  const count = await ProfileModel.countDocuments({ accountId: session.user.accountId });
  if (count >= 5) redirect("/profiles/manage");

  return <CreateProfileForm />;
}
