import {
  connectToDatabase,
  HiddenTitleModel,
  ParentalRuleModel,
  WatchProgressModel,
  type ParentalRuleDoc,
} from "@/lib/db";

export const DEFAULT_PARENTAL_RULE = {
  blockedTmdbIds: [],
  allowedTmdbIds: [],
  allowOnlyMode: false,
  safeSearch: false,
  hideMatureArtwork: false,
  sessionLimitMinutes: null,
  bedtimeStart: null,
  bedtimeEnd: null,
} as const;

export async function getParentalRule(profileId: string) {
  await connectToDatabase();
  const existing = await ParentalRuleModel.findOne({ profileId }).lean();
  return {
    ...DEFAULT_PARENTAL_RULE,
    ...(existing ?? {}),
    profileId,
  };
}

export async function upsertParentalRule(
  profileId: string,
  patch: Partial<Omit<ParentalRuleDoc, "_id" | "profileId" | "updatedAt">>
) {
  await connectToDatabase();
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<Omit<ParentalRuleDoc, "_id" | "profileId" | "updatedAt">>;
  const insertDefaults = Object.fromEntries(
    Object.entries(DEFAULT_PARENTAL_RULE).filter(([key]) => !(key in definedPatch))
  );

  await ParentalRuleModel.updateOne(
    { profileId },
    {
      $set: {
        ...definedPatch,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        profileId,
        ...insertDefaults,
      },
    },
    { upsert: true }
  );
  return getParentalRule(profileId);
}

export async function getHiddenTitles(profileId: string) {
  await connectToDatabase();
  return HiddenTitleModel.find({ profileId }).lean();
}

export async function hideTitle(
  profileId: string,
  tmdbId: number,
  mediaType: "movie" | "tv",
  reason?: string | null
) {
  await connectToDatabase();
  await HiddenTitleModel.updateOne(
    { profileId, tmdbId, mediaType },
    {
      $set: {
        reason: reason ?? null,
        hiddenAt: new Date(),
      },
      $setOnInsert: {
        profileId,
        tmdbId,
        mediaType,
      },
    },
    { upsert: true }
  );
}

export async function unhideTitle(profileId: string, tmdbId: number, mediaType: "movie" | "tv") {
  await connectToDatabase();
  await HiddenTitleModel.deleteOne({ profileId, tmdbId, mediaType });
}

export function isBlockedByParentalRule(
  rule: {
    blockedTmdbIds: readonly number[];
    allowedTmdbIds: readonly number[];
    allowOnlyMode: boolean;
  },
  tmdbId: number
) {
  if (rule.blockedTmdbIds.includes(tmdbId)) return true;
  if (rule.allowOnlyMode && !rule.allowedTmdbIds.includes(tmdbId)) return true;
  return false;
}

export function isCurrentlyInBedtime(rule: Pick<ParentalRuleDoc, "bedtimeStart" | "bedtimeEnd">) {
  if (!rule.bedtimeStart || !rule.bedtimeEnd) return false;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = rule.bedtimeStart.split(":").map(Number);
  const [endHour, endMinute] = rule.bedtimeEnd.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  if (start === end) return false;
  if (start < end) {
    return minutes >= start && minutes < end;
  }
  return minutes >= start || minutes < end;
}

export async function hasReachedSessionLimit(
  profileId: string,
  sessionLimitMinutes?: number | null
) {
  if (!sessionLimitMinutes || sessionLimitMinutes <= 0) return false;
  await connectToDatabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const entries = await WatchProgressModel.find({
    profileId,
    updatedAt: { $gte: startOfDay },
  }).lean();

  const watchedMinutes = entries.reduce((total, entry) => {
    const ratio = entry.durationSec > 0 ? Math.min(1, entry.positionSec / entry.durationSec) : 0;
    const estimate = (entry.durationSec / 60) * ratio;
    return total + estimate;
  }, 0);

  return watchedMinutes >= sessionLimitMinutes;
}

export function filterHiddenTitles<
  T extends { id: number; media_type?: string; title?: string; name?: string },
  H extends { tmdbId: number; mediaType: "movie" | "tv" }
>(
  items: T[],
  hiddenTitles: H[]
) {
  const hiddenKeys = new Set(hiddenTitles.map((item) => `${item.mediaType}:${item.tmdbId}`));
  return items.filter((item) => !hiddenKeys.has(`${item.media_type ?? (item.title ? "movie" : "tv")}:${item.id}`));
}

export function applyProfileDiscoveryRules<
  T extends {
    id: number;
    media_type?: string;
    title?: string;
    name?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    maturityRating?: string | null;
  },
  H extends { tmdbId: number; mediaType: "movie" | "tv" }
>(
  items: T[],
  hiddenTitles: H[],
  rule: {
    blockedTmdbIds: readonly number[];
    allowedTmdbIds: readonly number[];
    allowOnlyMode: boolean;
    hideMatureArtwork: boolean;
  }
) {
  return filterHiddenTitles(items, hiddenTitles)
    .filter((item) => !isBlockedByParentalRule(rule, item.id))
    .map((item) => {
      if (!rule.hideMatureArtwork) return item;
      if (!item.maturityRating || item.maturityRating === "G" || item.maturityRating === "PG" || item.maturityRating === "TV-G" || item.maturityRating === "TV-Y") {
        return item;
      }

      return {
        ...item,
        poster_path: null,
        backdrop_path: null,
      };
    });
}
