import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");
  return session;
}

export async function requireProfile() {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");
  if (!session.user.profileId) redirect("/profiles");
  return {
    accountId: session.user.accountId,
    profileId: session.user.profileId,
    maturityLevel: (session.user.maturityLevel ?? "ADULT") as "KIDS" | "TEEN" | "ADULT",
  };
}
