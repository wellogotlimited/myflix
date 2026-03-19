"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Users } from "@phosphor-icons/react";
import type { WatchPartyState } from "@/lib/party";
import PartyCodeDisplay from "./PartyCodeDisplay";
import MemberList from "./MemberList";
import ChatMessage from "./ChatMessage";

interface Props {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  currentProfileId: string;
  partyCode: string | null;
  isHost: boolean;
  playerPositionRef: React.RefObject<number>;
  isPlaying: boolean;
  onSeekTo: (pos: number) => void;
  onSetPlaying: (playing: boolean) => void;
  onPartyCreated: (payload: {
    code: string;
    role: "host" | "guest";
    state?: WatchPartyState;
  }) => void;
  onPartyStateChange: (state: WatchPartyState | null) => void;
  onPartyEnded: () => void;
  onClose: () => void;
}

const POLL_INTERVAL = 2500;
const DRIFT_THRESHOLD = 1.5;

export default function WatchPartyPanel({
  tmdbId,
  mediaType,
  season,
  episode,
  currentProfileId,
  partyCode,
  isHost,
  playerPositionRef,
  isPlaying,
  onSeekTo,
  onSetPlaying,
  onPartyCreated,
  onPartyStateChange,
  onPartyEnded,
  onClose,
}: Props) {
  const [partyState, setPartyState] = useState<WatchPartyState | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [connectionError, setConnectionError] = useState(0);
  const [showJoin, setShowJoin] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const applyPartyState = useCallback((data: WatchPartyState) => {
    setConnectionError(0);
    setPartyState(data);
    onPartyStateChange(data);

    if (!isHost) {
      const drift = data.positionSec - (playerPositionRef.current ?? 0);
      if (Math.abs(drift) > DRIFT_THRESHOLD) {
        onSeekTo(data.positionSec);
      }
      if (data.isPlaying !== isPlaying) {
        onSetPlaying(data.isPlaying);
      }
    }
  }, [isHost, isPlaying, onPartyStateChange, onSeekTo, onSetPlaying, playerPositionRef]);

  const fetchParty = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/party/${code}`);
      if (res.status === 404) {
        onPartyStateChange(null);
        onPartyEnded();
        return;
      }
      if (!res.ok) {
        setConnectionError((n) => n + 1);
        return;
      }

      const data: WatchPartyState = await res.json();
      applyPartyState(data);
    } catch {
      setConnectionError((n) => n + 1);
    }
  }, [applyPartyState, onPartyEnded, onPartyStateChange]);

  useEffect(() => {
    if (!partyCode) {
      onPartyStateChange(null);
      return;
    }

    const initialFetch = setTimeout(() => {
      void fetchParty(partyCode);
    }, 0);

    if (typeof window !== "undefined" && "EventSource" in window) {
      const source = new EventSource(`/api/party/${partyCode}/events`);
      eventSourceRef.current = source;

      source.onopen = () => {
        setConnectionError(0);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };

      source.addEventListener("state", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          type: "state";
          party: WatchPartyState;
        };
        applyPartyState(payload.party);
      });

      source.addEventListener("ended", () => {
        source.close();
        onPartyStateChange(null);
        onPartyEnded();
      });

      source.onerror = () => {
        setConnectionError((n) => n + 1);
        if (!pollRef.current) {
          pollRef.current = setInterval(() => {
            void fetchParty(partyCode);
          }, POLL_INTERVAL);
        }
      };
    } else {
      pollRef.current = setInterval(() => {
        void fetchParty(partyCode);
      }, POLL_INTERVAL);
    }

    return () => {
      clearTimeout(initialFetch);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [applyPartyState, fetchParty, onPartyEnded, onPartyStateChange, partyCode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [partyState?.messages.length]);

  async function handleCreateParty() {
    setCreating(true);
    const res = await fetch("/api/party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId, mediaType, season: season ?? null, episode: episode ?? null }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      onPartyCreated({ code: data.code, role: "host" });
    }
  }

  async function handleJoinParty() {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    const res = await fetch(`/api/party/${code}/join`, { method: "POST" });
    setJoining(false);
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      setJoinError(error?.error || "Party not found. Check your code and try again.");
      return;
    }
    const data: WatchPartyState = await res.json();
    setPartyState(data);
    onPartyStateChange(data);
    onPartyCreated({ code, role: "guest", state: data });
    setShowJoin(false);
  }

  async function handleEndParty() {
    if (!partyCode) return;
    await fetch(`/api/party/${partyCode}`, { method: "DELETE" });
    onPartyEnded();
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !partyCode) return;
    const text = chatInput.trim();
    setChatInput("");
    await fetch(`/api/party/${partyCode}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <Users size={18} />
          <span className="text-sm font-semibold">Watch Party</span>
        </div>
        <button onClick={onClose} className="text-gray-500 transition hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* No party yet */}
      {!partyCode ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          {!showJoin ? (
            <>
              <p className="text-center text-sm text-gray-400">
                Watch together in sync with friends.
              </p>
              <button
                onClick={handleCreateParty}
                disabled={creating}
                className="w-full rounded bg-[#e50914] py-2.5 text-sm font-semibold text-white transition hover:bg-[#f40612] disabled:opacity-60"
              >
                {creating ? "Creating..." : "Start Watch Party"}
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="text-sm text-gray-400 transition hover:text-white"
              >
                Join with a code
              </button>
            </>
          ) : (
            <div className="w-full space-y-3">
              <input
                type="text"
                maxLength={6}
                placeholder="Enter party code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full rounded bg-[#333] px-4 py-2.5 text-center text-sm font-mono tracking-widest text-white outline-none focus:bg-[#454545]"
              />
              {joinError && <p className="text-xs text-red-400">{joinError}</p>}
              <button
                onClick={handleJoinParty}
                disabled={joining || joinCode.length < 4}
                className="w-full rounded bg-[#e50914] py-2.5 text-sm font-semibold text-white transition hover:bg-[#f40612] disabled:opacity-60"
              >
                {joining ? "Joining..." : "Join"}
              </button>
              <button
                onClick={() => { setShowJoin(false); setJoinError(""); }}
                className="w-full text-sm text-gray-500 transition hover:text-gray-300"
              >
                Back
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Party active */}
          <div className="border-b border-white/10 p-4 space-y-3">
            <PartyCodeDisplay code={partyCode} />
            {partyState && <MemberList members={partyState.members} currentProfileId={currentProfileId} />}
            {connectionError >= 3 && (
              <p className="text-xs text-yellow-400">Connection issues...</p>
            )}
            {isHost && (
              <button
                onClick={handleEndParty}
                className="w-full rounded border border-red-800 py-1.5 text-xs text-red-500 transition hover:border-red-500"
              >
                End Party
              </button>
            )}
          </div>

          {/* Chat */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {partyState?.messages.length === 0 && (
              <p className="text-center text-xs text-gray-600 mt-4">No messages yet</p>
            )}
            {partyState?.messages.map((msg, i) => (
              <ChatMessage
                key={i}
                message={msg}
                isOwn={msg.profileId === currentProfileId}
              />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <form onSubmit={handleSendMessage} className="border-t border-white/10 flex gap-2 p-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Say something..."
              maxLength={200}
              className="flex-1 rounded bg-[#333] px-3 py-2 text-sm text-white outline-none focus:bg-[#454545]"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="rounded bg-[#e50914] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#f40612] disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
