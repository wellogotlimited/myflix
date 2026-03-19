import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountSettings from "@/components/AccountSettings";

export const metadata = { title: "Account - Popflix" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.accountId) redirect("/login");
  return <AccountSettings email={session.user.email ?? ""} />;
}
