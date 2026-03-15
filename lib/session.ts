import { auth } from "@/lib/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.accountId) return null;
  return session;
}

export async function requireProfile() {
  const session = await auth();
  if (!session?.user?.profileId) return null;
  return {
    accountId: session.user.accountId,
    profileId: session.user.profileId,
    maturityLevel: (session.user.maturityLevel ?? "ADULT") as "KIDS" | "TEEN" | "ADULT",
  };
}
