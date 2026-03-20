import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginExperience from "@/components/auth/LoginExperience";

export const metadata = { title: "Sign In - Popflix" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.accountId) redirect("/profiles");

  return <LoginExperience />;
}
