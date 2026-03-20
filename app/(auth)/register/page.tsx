import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import BrandWordmark from "@/components/BrandWordmark";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = { title: "Create Account - Popflix" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.accountId) redirect("/profiles");

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 bg-cover bg-center">
      <div className="w-full max-w-md rounded-md bg-black/80 px-12 py-12">
        <BrandWordmark
          size={34}
          className="mb-8"
          textClassName="text-2xl font-bold tracking-wide text-white"
        />
        <h1 className="mb-8 text-3xl font-bold text-white">Create Account</h1>
        <RegisterForm />
        <p className="mt-6 text-sm text-gray-400">
          Already have an account?{" "}
          <a href="/login" className="text-white hover:underline">
            Sign in.
          </a>
        </p>
      </div>
    </div>
  );
}
