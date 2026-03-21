const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)

export function generatePartyCode(): string {
  return Array.from(
    { length: 6 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
}

export interface WatchPartyMember {
  profileId: string;
  name: string;
  avatarId: string;
  joinedAt: string;
}

export interface WatchPartyMessage {
  profileId: string;
  name: string;
  text: string;
  sentAt: string;
}

export interface WatchPartyReaction {
  profileId: string;
  emoji: string;
  sentAt: string;
}

export interface WatchPartyQueueItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  title: string;
  addedByProfileId: string;
  addedAt: string;
}

export interface WatchPartyState {
  _id: string;
  code: string;
  hostProfileId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  positionSec: number;
  isPlaying: boolean;
  lastUpdatedAt: string;
  members: WatchPartyMember[];
  messages: WatchPartyMessage[];
  reactions: WatchPartyReaction[];
  queue: WatchPartyQueueItem[];
  scheduledFor?: string | null;
}

type SerializableParty = {
  _id: { toString(): string } | string;
  code: string;
  hostProfileId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  positionSec: number;
  isPlaying: boolean;
  lastUpdatedAt: Date | string;
  members: Array<{
    profileId: string;
    name: string;
    avatarId: string;
    joinedAt: Date | string;
  }>;
  messages: Array<{
    profileId: string;
    name: string;
    text: string;
    sentAt: Date | string;
  }>;
  reactions?: Array<{
    profileId: string;
    emoji: string;
    sentAt: Date | string;
  }>;
  queue?: Array<{
    tmdbId: number;
    mediaType: "movie" | "tv";
    season?: number | null;
    episode?: number | null;
    title: string;
    addedByProfileId: string;
    addedAt: Date | string;
  }>;
  scheduledFor?: Date | string | null;
};

type PartyMediaTarget = Pick<WatchPartyState, "mediaType" | "tmdbId" | "season" | "episode">;

export function buildPartyWatchHref(target: PartyMediaTarget) {
  const pathname = `/watch/${target.mediaType}/${target.tmdbId}`;
  if (target.mediaType !== "tv") {
    return pathname;
  }

  const params = new URLSearchParams();
  if (target.season != null) {
    params.set("season", String(target.season));
  }
  if (target.episode != null) {
    params.set("episode", String(target.episode));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function matchesPartyMedia(
  target: PartyMediaTarget,
  media: {
    type: "movie" | "show";
    tmdbId: string;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
  }
) {
  if (String(target.tmdbId) !== media.tmdbId) {
    return false;
  }

  const mediaType = media.type === "show" ? "tv" : "movie";
  if (target.mediaType !== mediaType) {
    return false;
  }

  if (target.mediaType === "tv") {
    return (
      (target.season ?? null) === (media.seasonNumber ?? null) &&
      (target.episode ?? null) === (media.episodeNumber ?? null)
    );
  }

  return true;
}

export function serializePartyState(party: SerializableParty): WatchPartyState {
  return {
    _id: party._id.toString(),
    code: party.code,
    hostProfileId: party.hostProfileId,
    tmdbId: party.tmdbId,
    mediaType: party.mediaType,
    season: party.season ?? null,
    episode: party.episode ?? null,
    positionSec: party.positionSec,
    isPlaying: party.isPlaying,
    lastUpdatedAt:
      typeof party.lastUpdatedAt === "string"
        ? party.lastUpdatedAt
        : party.lastUpdatedAt.toISOString(),
    members: party.members.map((member) => ({
      profileId: member.profileId,
      name: member.name,
      avatarId: member.avatarId,
      joinedAt:
        typeof member.joinedAt === "string"
          ? member.joinedAt
          : member.joinedAt.toISOString(),
    })),
    messages: party.messages.map((message) => ({
      profileId: message.profileId,
      name: message.name,
      text: message.text,
      sentAt:
        typeof message.sentAt === "string"
          ? message.sentAt
          : message.sentAt.toISOString(),
    })),
    reactions: (party.reactions ?? []).map((reaction) => ({
      profileId: reaction.profileId,
      emoji: reaction.emoji,
      sentAt:
        typeof reaction.sentAt === "string"
          ? reaction.sentAt
          : reaction.sentAt.toISOString(),
    })),
    queue: (party.queue ?? []).map((item) => ({
      ...item,
      addedAt:
        typeof item.addedAt === "string"
          ? item.addedAt
          : item.addedAt.toISOString(),
    })),
    scheduledFor:
      typeof party.scheduledFor === "string"
        ? party.scheduledFor
        : party.scheduledFor?.toISOString() ?? null,
  };
}
