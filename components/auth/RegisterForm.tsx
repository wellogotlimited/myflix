"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    // Auto sign in after registration
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Account created but sign-in failed. Please sign in manually.");
    } else {
      // Auto-select the first (and only) profile so onboarding has a profileId
      const profilesRes = await fetch("/api/profile");
      const profiles = await profilesRes.json().catch(() => []);
      if (profiles[0]?._id) {
        await update({ profileId: profiles[0]._id });
      }
      router.push("/onboarding");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded bg-orange-600/20 px-4 py-3 text-sm text-orange-300">{error}</p>
      )}
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={24}
        className="w-full rounded bg-[#333] px-4 py-4 text-white placeholder-gray-400 outline-none focus:bg-[#454545]"
      />
      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full rounded bg-[#333] px-4 py-4 text-white placeholder-gray-400 outline-none focus:bg-[#454545]"
      />
      <input
        type="password"
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="w-full rounded bg-[#333] px-4 py-4 text-white placeholder-gray-400 outline-none focus:bg-[#454545]"
      />
      <input
        type="password"
        placeholder="Confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        className="w-full rounded bg-[#333] px-4 py-4 text-white placeholder-gray-400 outline-none focus:bg-[#454545]"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[#e50914] py-4 font-semibold text-white transition hover:bg-[#f40612] disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Get Started"}
      </button>
    </form>
  );
}
