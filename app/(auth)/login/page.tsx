import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign In — MyFlix" };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 bg-[url('/auth-bg.jpg')] bg-cover bg-center">
      <div className="w-full max-w-md rounded-md bg-black/80 px-12 py-12">
        <h1 className="mb-8 text-3xl font-bold text-white">Sign In</h1>
        <LoginForm />
        <p className="mt-6 text-sm text-gray-400">
          New to MyFlix?{" "}
          <a href="/register" className="text-white hover:underline">
            Sign up now.
          </a>
        </p>
      </div>
    </div>
  );
}
