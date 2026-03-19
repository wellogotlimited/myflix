import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase, GenreAffinityModel, ProfileModel } from "@/lib/db";
import GenrePicker from "@/components/onboarding/GenrePicker";

export const metadata = { title: "Choose your interests - Popflix" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");
  if (!session.user.profileId) redirect("/profiles");

  await connectToDatabase();
  const profile = await ProfileModel.findById(session.user.profileId).lean();

  if (!profile) redirect("/profiles");

  if (profile.onboardingComplete) redirect("/");

  const existingAffinities = await GenreAffinityModel.countDocuments({
    profileId: session.user.profileId,
  });
  if (existingAffinities > 0) redirect("/");

  return <GenrePicker />;
}
