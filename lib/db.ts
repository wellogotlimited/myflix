import mongoose, { model, models, Schema, type Model, type Types } from "mongoose";

function getMongoUri() {
  const value = process.env.MONGODB_URI;
  if (!value) {
    throw new Error("MONGODB_URI is not set");
  }
  return value;
}

const uri = getMongoUri();

const dbName = process.env.MONGODB_DB ?? "myflix";

declare global {
  var _mongooseConnection: Promise<typeof mongoose> | undefined;
}

export type MaturityLevel = "KIDS" | "TEEN" | "ADULT";

export interface AccountDoc {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface ProfileDoc {
  _id: string;
  accountId: string;
  name: string;
  avatarId: string;
  maturityLevel: MaturityLevel;
  isKidsProfile: boolean;
  onboardingComplete: boolean;
  pin?: string | null;
  createdAt: Date;
}

export interface BookmarkDoc {
  _id: string;
  profileId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  savedAt: Date;
}

export interface WatchProgressDoc {
  _id: string;
  profileId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeTitle?: string | null;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  genreIds: number[];
  updatedAt: Date;
}

export interface WatchHistoryDoc {
  _id: string;
  profileId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  genreIds: number[];
  watchedAt: Date;
}

export interface GenreAffinityDoc {
  _id: string;
  profileId: string;
  genreId: number;
  score: number;
}

export interface WatchPartyMemberDoc {
  profileId: string;
  name: string;
  avatarId: string;
  joinedAt: Date;
}

export interface WatchPartyMessageDoc {
  profileId: string;
  name: string;
  text: string;
  sentAt: Date;
}

export interface WatchPartyDoc {
  _id: string;
  code: string;
  hostProfileId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  positionSec: number;
  isPlaying: boolean;
  lastUpdatedAt: Date;
  members: WatchPartyMemberDoc[];
  messages: WatchPartyMessageDoc[];
  createdAt: Date;
}

export interface DevicePairingDoc {
  _id: string;
  token: string;
  status: "pending" | "approved" | "consumed";
  accountId?: string | null;
  profileId?: string | null;
  profileName?: string | null;
  maturityLevel?: string | null;
  exchangeToken?: string | null;
  approvedAt?: Date | null;
  consumedAt?: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface TvReceiverDoc {
  _id: string;
  accountId: string;
  profileId: string;
  profileName: string;
  maturityLevel: "KIDS" | "TEEN" | "ADULT";
  pairedAt: Date;
  lastSeenAt: Date;
  commandNonce?: string | null;
  commandKind?: "navigate" | "playback" | "caption" | null;
  commandPath?: string | null;
  commandTitle?: string | null;
  commandDevMode?: boolean | null;
  commandProxyEnabled?: boolean | null;
  commandAction?: "play" | "pause" | "toggle" | "seek" | null;
  commandCaptionAction?: "set" | null;
  commandCaptionIndex?: number | null;
  commandPositionSec?: number | null;
  commandSentAt?: Date | null;
  statusNonce?: string | null;
  statusPath?: string | null;
  statusTitle?: string | null;
  statusRemoteConnected?: boolean | null;
  statusCaptionsAvailable?: boolean | null;
  statusCaptionsEnabled?: boolean | null;
  statusCaptions?: Array<{ index: number; label: string }> | null;
  statusActiveCaptionIndex?: number | null;
  statusIsPlaying?: boolean | null;
  statusCurrentTimeSec?: number | null;
  statusDurationSec?: number | null;
  statusMediaType?: "movie" | "tv" | null;
  statusTmdbId?: string | null;
  statusSeasonNumber?: number | null;
  statusEpisodeNumber?: number | null;
  statusUpdatedAt?: Date | null;
}

export interface RatingDoc {
  _id: string;
  profileId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  rating: "up" | "down";
  ratedAt: Date;
}

type AccountFields = Omit<AccountDoc, "_id">;
type ProfileFields = Omit<ProfileDoc, "_id">;
type BookmarkFields = Omit<BookmarkDoc, "_id">;
type WatchProgressFields = Omit<WatchProgressDoc, "_id">;
type WatchHistoryFields = Omit<WatchHistoryDoc, "_id">;
type GenreAffinityFields = Omit<GenreAffinityDoc, "_id">;
type WatchPartyFields = Omit<WatchPartyDoc, "_id">;
type DevicePairingFields = Omit<DevicePairingDoc, "_id">;
type TvReceiverFields = Omit<TvReceiverDoc, "_id">;
type RatingFields = Omit<RatingDoc, "_id">;

const accountSchema = new Schema<AccountFields>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false }
);

const profileSchema = new Schema<ProfileFields>(
  {
    accountId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    avatarId: { type: String, required: true },
    maturityLevel: { type: String, enum: ["KIDS", "TEEN", "ADULT"], required: true },
    isKidsProfile: { type: Boolean, required: true },
    onboardingComplete: { type: Boolean, required: true, default: false },
    pin: { type: String, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false }
);

const bookmarkSchema = new Schema<BookmarkFields>(
  {
    profileId: { type: String, required: true, index: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    title: { type: String, required: true },
    posterPath: { type: String, default: null },
    savedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
bookmarkSchema.index({ profileId: 1, tmdbId: 1, mediaType: 1 }, { unique: true });

const watchProgressSchema = new Schema<WatchProgressFields>(
  {
    profileId: { type: String, required: true, index: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    title: { type: String, required: true },
    posterPath: { type: String, default: null },
    backdropPath: { type: String, default: null },
    seasonNumber: { type: Number, default: null },
    episodeNumber: { type: Number, default: null },
    episodeTitle: { type: String, default: null },
    positionSec: { type: Number, required: true },
    durationSec: { type: Number, required: true },
    completed: { type: Boolean, required: true },
    genreIds: { type: [Number], required: true, default: [] },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
watchProgressSchema.index(
  { profileId: 1, tmdbId: 1, mediaType: 1, seasonNumber: 1, episodeNumber: 1 },
  { unique: true }
);

const watchHistorySchema = new Schema<WatchHistoryFields>(
  {
    profileId: { type: String, required: true, index: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    genreIds: { type: [Number], required: true, default: [] },
    watchedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
watchHistorySchema.index({ profileId: 1, tmdbId: 1, mediaType: 1 }, { unique: true });

const genreAffinitySchema = new Schema<GenreAffinityFields>(
  {
    profileId: { type: String, required: true, index: true },
    genreId: { type: Number, required: true },
    score: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);
genreAffinitySchema.index({ profileId: 1, genreId: 1 }, { unique: true });

const watchPartyMemberSchema = new Schema<WatchPartyMemberDoc>(
  {
    profileId: { type: String, required: true },
    name: { type: String, required: true },
    avatarId: { type: String, required: true },
    joinedAt: { type: Date, required: true },
  },
  { _id: false, versionKey: false }
);

const watchPartyMessageSchema = new Schema<WatchPartyMessageDoc>(
  {
    profileId: { type: String, required: true },
    name: { type: String, required: true },
    text: { type: String, required: true },
    sentAt: { type: Date, required: true },
  },
  { _id: false, versionKey: false }
);

const watchPartySchema = new Schema<WatchPartyFields>(
  {
    code: { type: String, required: true, unique: true },
    hostProfileId: { type: String, required: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    season: { type: Number, default: null },
    episode: { type: Number, default: null },
    positionSec: { type: Number, required: true, default: 0 },
    isPlaying: { type: Boolean, required: true, default: false },
    lastUpdatedAt: { type: Date, required: true },
    members: { type: [watchPartyMemberSchema], default: [] },
    messages: { type: [watchPartyMessageSchema], default: [] },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false }
);
watchPartySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const devicePairingSchema = new Schema<DevicePairingFields>(
  {
    token: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "approved", "consumed"],
      required: true,
      default: "pending",
    },
    accountId: { type: String, default: null },
    profileId: { type: String, default: null },
    profileName: { type: String, default: null },
    maturityLevel: { type: String, enum: ["KIDS", "TEEN", "ADULT"], default: null },
    exchangeToken: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);
devicePairingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const tvReceiverSchema = new Schema<TvReceiverFields>(
  {
    accountId: { type: String, required: true, index: true },
    profileId: { type: String, required: true },
    profileName: { type: String, required: true },
    maturityLevel: { type: String, enum: ["KIDS", "TEEN", "ADULT"], required: true },
    pairedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true, index: true },
    commandNonce: { type: String, default: null },
    commandKind: { type: String, enum: ["navigate", "playback", "caption"], default: null },
    commandPath: { type: String, default: null },
    commandTitle: { type: String, default: null },
    commandDevMode: { type: Boolean, default: null },
    commandProxyEnabled: { type: Boolean, default: null },
    commandAction: { type: String, enum: ["play", "pause", "toggle", "seek"], default: null },
    commandCaptionAction: { type: String, enum: ["set"], default: null },
    commandCaptionIndex: { type: Number, default: null },
    commandPositionSec: { type: Number, default: null },
    commandSentAt: { type: Date, default: null },
    statusNonce: { type: String, default: null },
    statusPath: { type: String, default: null },
    statusTitle: { type: String, default: null },
    statusRemoteConnected: { type: Boolean, default: false },
    statusCaptionsAvailable: { type: Boolean, default: false },
    statusCaptionsEnabled: { type: Boolean, default: false },
    statusCaptions: {
      type: [
        new Schema(
          {
            index: { type: Number, required: true },
            label: { type: String, required: true },
          },
          { _id: false, versionKey: false }
        ),
      ],
      default: [],
    },
    statusActiveCaptionIndex: { type: Number, default: -1 },
    statusIsPlaying: { type: Boolean, default: null },
    statusCurrentTimeSec: { type: Number, default: null },
    statusDurationSec: { type: Number, default: null },
    statusMediaType: { type: String, enum: ["movie", "tv"], default: null },
    statusTmdbId: { type: String, default: null },
    statusSeasonNumber: { type: Number, default: null },
    statusEpisodeNumber: { type: Number, default: null },
    statusUpdatedAt: { type: Date, default: null },
  },
  { versionKey: false }
);

const ratingSchema = new Schema<RatingFields>(
  {
    profileId: { type: String, required: true, index: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    rating: { type: String, enum: ["up", "down"], required: true },
    ratedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
ratingSchema.index({ profileId: 1, tmdbId: 1, mediaType: 1 }, { unique: true });

function getModel<T>(name: string, schema: Schema<T>, collection: string): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema, collection);
}

export const AccountModel = getModel("Account", accountSchema, "accounts");
export const ProfileModel = getModel("Profile", profileSchema, "profiles");
export const BookmarkModel = getModel("Bookmark", bookmarkSchema, "bookmarks");
export const WatchProgressModel = getModel("WatchProgress", watchProgressSchema, "watchProgress");
export const WatchHistoryModel = getModel("WatchHistory", watchHistorySchema, "watchHistory");
export const GenreAffinityModel = getModel("GenreAffinity", genreAffinitySchema, "genreAffinities");
export const WatchPartyModel = getModel("WatchParty", watchPartySchema, "watchParties");
export const DevicePairingModel = getModel("DevicePairing", devicePairingSchema, "devicePairings");
export const TvReceiverModel = getModel("TvReceiver", tvReceiverSchema, "tvReceivers");
export const RatingModel = getModel("Rating", ratingSchema, "ratings");

export async function connectToDatabase() {
  globalThis._mongooseConnection ??= mongoose.connect(uri, { dbName });
  return globalThis._mongooseConnection;
}

type PlainDocument = {
  _id: Types.ObjectId | string;
  toObject?: () => Record<string, unknown>;
};

export function isValidObjectId(value: string) {
  return mongoose.isValidObjectId(value);
}

export function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

export function serializeDocument<T extends PlainDocument>(doc: T | null) {
  if (!doc) return null;

  const plain = (typeof doc.toObject === "function" ? doc.toObject() : doc) as T;
  return {
    ...plain,
    _id: plain._id.toString(),
  } as Omit<T, "_id"> & { _id: string };
}

export function serializeDocuments<T extends PlainDocument>(docs: T[]) {
  return docs.map((doc) => serializeDocument(doc)!);
}
