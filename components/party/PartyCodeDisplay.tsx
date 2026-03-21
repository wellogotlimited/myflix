"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

export default function PartyCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const invite =
      typeof window === "undefined"
        ? code
        : `${window.location.origin}${window.location.pathname}?party=${code}`;
    await navigator.clipboard.writeText(invite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between rounded bg-[#262626] px-3 py-2">
      <div>
        <p className="text-xs text-gray-500">Party code</p>
        <p className="font-mono text-lg font-bold tracking-widest text-white">{code}</p>
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-gray-400 transition hover:bg-white/10 hover:text-white"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied!" : "Copy Invite"}
      </button>
    </div>
  );
}
