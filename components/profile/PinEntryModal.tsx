"use client";

import { useEffect, useState, useCallback } from "react";
import ProfileAvatar from "./ProfileAvatar";

interface Props {
  profile: { _id: string; name: string; avatarId: string };
  onSuccess: () => void;
  onCancel: () => void;
}

const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function PinEntryModal({ profile, onSuccess, onCancel }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (pin: string) => {
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch(`/api/profile/${profile._id}/pin/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (res.ok) {
          onSuccess();
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Incorrect PIN");
          setShake(true);
          setDigits([]);
          setTimeout(() => setShake(false), 600);
        }
      } catch {
        setError("Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [profile._id, onSuccess]
  );

  const pressDigit = useCallback(
    (key: string) => {
      if (submitting) return;
      if (key === "⌫") {
        setDigits((prev) => prev.slice(0, -1));
        setError("");
        return;
      }
      if (!/^\d$/.test(key)) return;
      setDigits((prev) => {
        if (prev.length >= 4) return prev;
        const next = [...prev, key];
        if (next.length === 4) {
          // auto-submit on 4th digit
          setTimeout(() => submit(next.join("")), 0);
        }
        return next;
      });
    },
    [submitting, submit]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) pressDigit(e.key);
      else if (e.key === "Backspace") pressDigit("⌫");
      else if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressDigit, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex flex-col items-center gap-6 rounded-xl bg-[#1a1a1a] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ProfileAvatar avatarId={profile.avatarId} name={profile.name} size={80} className="rounded-lg" />
        <p className="text-lg font-medium text-white">{profile.name}</p>

        {/* Dot indicators */}
        <div
          className={`flex gap-4 transition-transform ${shake ? "animate-shake" : ""}`}
          style={shake ? { animation: "shake 0.5s ease-in-out" } : {}}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-colors ${
                i < digits.length
                  ? "border-white bg-white"
                  : "border-gray-500 bg-transparent"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-400" role="status">
            {error}
          </p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3">
          {PAD.map((key, i) => {
            if (key === "") return <div key={i} />;
            return (
              <button
                key={i}
                type="button"
                aria-label={key === "⌫" ? "Backspace" : key}
                onClick={() => pressDigit(key)}
                disabled={submitting}
                className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-medium transition
                  ${key === "⌫"
                    ? "text-gray-400 hover:bg-white/10 hover:text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                  } disabled:opacity-40`}
              >
                {key}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 transition hover:text-gray-300"
        >
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
