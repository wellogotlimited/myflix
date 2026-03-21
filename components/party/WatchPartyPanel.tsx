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
  title: string;
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

const DRIFT_THRESHOLD = 1.5;

export default function WatchPartyPanel({
  tmdbId,
  mediaType,
  title,
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
  const [leaving, setLeaving] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const latestIsPlayingRef = useRef(isPlaying);
  const latestOnPartyStateChangeRef = useRef(onPartyStateChange);
  const latestOnSeekToRef = useRef(onSeekTo);
  const latestOnSetPlayingRef = useRef(onSetPlaying);
  const latestOnPartyEndedRef = useRef(onPartyEnded);
  const latestIsHostRef = useRef(isHost);

  useEffect(() => {
    latestIsPlayingRef.current = isPlaying;
    latestOnPartyStateChangeRef.current = onPartyStateChange;
    latestOnSeekToRef.current = onSeekTo;
    latestOnSetPlayingRef.current = onSetPlaying;
    latestOnPartyEndedRef.current = onPartyEnded;
    latestIsHostRef.current = isHost;
  }, [isHost, isPlaying, onPartyEnded, onPartyStateChange, onSeekTo, onSetPlaying]);

  const applyPartyState = useCallback((data: WatchPartyState) => {
    setConnectionError(0);
    setPartyState(data);
    latestOnPartyStateChangeRef.current(data);

    if (!latestIsHostRef.current) {
      const drift = data.positionSec - (playerPositionRef.current ?? 0);
      if (Math.abs(drift) > DRIFT_THRESHOLD) {
        latestOnSeekToRef.current(data.positionSec);
      }
      if (data.isPlaying !== latestIsPlayingRef.current) {
        latestOnSetPlayingRef.current(data.isPlaying);
      }
    }
  }, [playerPositionRef]);

  useEffect(() => {
    if (!partyCode) {
      latestOnPartyStateChangeRef.current(null);
      return;
    }

    if (typeof window === "undefined" || !("EventSource" in window)) {
      return;
    }

    const source = new EventSource(`/api/party/${partyCode}/events`);
    eventSourceRef.current = source;

    source.onopen = () => {
      setConnectionError(0);
    };

    source.addEventListener("state", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        type?: "state";
        party?: WatchPartyState;
      } | WatchPartyState;

      if ("party" in payload && payload.party) {
        applyPartyState(payload.party);
        return;
      }

      applyPartyState(payload as WatchPartyState);
    });

    source.addEventListener("ended", () => {
      source.close();
      setPartyState(null);
      latestOnPartyStateChangeRef.current(null);
      latestOnPartyEndedRef.current();
    });

    source.onerror = () => {
      setConnectionError((n) => n + 1);
    };

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [applyPartyState, partyCode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [partyState?.messages.length]);

  useEffect(() => {
    setScheduledFor(
      partyState?.scheduledFor ? partyState.scheduledFor.slice(0, 16) : ""
    );
  }, [partyState?.scheduledFor]);

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

  async function handleLeaveParty() {
    if (!partyCode) return;
    setLeaving(true);
    await fetch(`/api/party/${partyCode}/leave`, { method: "POST" }).catch(() => null);
    setLeaving(false);
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

  async function handleReaction(emoji: string) {
    if (!partyCode) return;
    await fetch(`/api/party/${partyCode}/reaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).catch(() => null);
  }

  async function handleScheduleParty() {
    if (!partyCode || !isHost) return;
    await fetch(`/api/party/${partyCode}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledFor: scheduledFor || null }),
    }).catch(() => null);
  }

  async function handleQueueCurrent() {
    if (!partyCode) return;
    await fetch(`/api/party/${partyCode}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbId,
        mediaType,
        season: season ?? null,
        episode: episode ?? null,
        title,
      }),
    }).catch(() => null);
  }

  async function handleRemoveQueuedItem(item: WatchPartyState["queue"][number]) {
    if (!partyCode || !isHost) return;
    await fetch(`/api/party/${partyCode}/queue`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
      }),
    }).catch(() => null);
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
            {partyState?.scheduledFor ? (
              <p className="text-xs text-white/55">
                Scheduled for {new Date(partyState.scheduledFor).toLocaleString()}
              </p>
            ) : null}
            {connectionError >= 3 && (
              <p className="text-xs text-yellow-400">Connection issues...</p>
            )}
            <div className="flex flex-wrap gap-2">
              {["🔥", "😂", "😱", "👏"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReaction(emoji)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/16"
                >
                  {emoji}
                </button>
              ))}
            </div>
            {partyState?.reactions?.length ? (
              <p className="text-xs text-white/45">
                Recent reactions: {partyState.reactions.slice(-4).map((reaction) => reaction.emoji).join(" ")}
              </p>
            ) : null}
            {isHost ? (
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  className="w-full rounded bg-[#333] px-3 py-2 text-sm text-white outline-none focus:bg-[#454545]"
                />
                <button
                  type="button"
                  onClick={handleScheduleParty}
                  className="w-full rounded border border-white/15 py-2 text-xs text-white/75 transition hover:border-white/30 hover:text-white"
                >
                  Save start time
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleQueueCurrent}
              className="w-full rounded border border-white/15 py-1.5 text-xs text-white/75 transition hover:border-white/30 hover:text-white"
            >
              Add current title to queue
            </button>
            {partyState?.queue?.length ? (
              <div className="space-y-2 rounded bg-[#202020] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">Queue</p>
                {partyState.queue.map((item) => (
                  <div key={`${item.mediaType}-${item.tmdbId}-${item.season ?? 0}-${item.episode ?? 0}`} className="flex items-center justify-between gap-3">
                    <p className="text-xs text-white/75">{item.title}</p>
                    {isHost ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveQueuedItem(item)}
                        className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/70"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {isHost ? (
              <button
                onClick={handleEndParty}
                className="w-full rounded border border-red-800 py-1.5 text-xs text-red-500 transition hover:border-red-500"
              >
                End Party
              </button>
            ) : (
              <button
                onClick={handleLeaveParty}
                disabled={leaving}
                className="w-full rounded border border-white/15 py-1.5 text-xs text-white/75 transition hover:border-white/30 hover:text-white disabled:opacity-60"
              >
                {leaving ? "Leaving..." : "Leave Party"}
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
