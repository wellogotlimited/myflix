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
  // eslint-disable-next-line no-var
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

interface AccountFields extends Omit<AccountDoc, "_id"> {}
interface ProfileFields extends Omit<ProfileDoc, "_id"> {}
interface BookmarkFields extends Omit<BookmarkDoc, "_id"> {}
interface WatchProgressFields extends Omit<WatchProgressDoc, "_id"> {}
interface WatchHistoryFields extends Omit<WatchHistoryDoc, "_id"> {}
interface GenreAffinityFields extends Omit<GenreAffinityDoc, "_id"> {}

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

function getModel<T>(name: string, schema: Schema<T>, collection: string): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema, collection);
}

export const AccountModel = getModel("Account", accountSchema, "accounts");
export const ProfileModel = getModel("Profile", profileSchema, "profiles");
export const BookmarkModel = getModel("Bookmark", bookmarkSchema, "bookmarks");
export const WatchProgressModel = getModel("WatchProgress", watchProgressSchema, "watchProgress");
export const WatchHistoryModel = getModel("WatchHistory", watchHistorySchema, "watchHistory");
export const GenreAffinityModel = getModel("GenreAffinity", genreAffinitySchema, "genreAffinities");

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
