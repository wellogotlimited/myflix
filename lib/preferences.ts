import {
  connectToDatabase,
  PlaybackPreferenceModel,
  type PlaybackPreferenceDoc,
} from "@/lib/db";

export const DEFAULT_PLAYBACK_PREFERENCES = {
  proxyEnabled: false,
  devMode: false,
  autoplayNextEpisode: true,
  preferredQuality: "auto",
  subtitleLanguage: "off",
  audioLanguage: "default",
  captionsEnabled: false,
  subtitleDelay: 0,
  subtitleFontScale: 100,
  reducedMotion: false,
  largerControls: false,
  highContrast: false,
  keyboardShortcuts: true,
} as const;

export type PlaybackPreferenceValues = Omit<
  PlaybackPreferenceDoc,
  "_id" | "accountId" | "profileId" | "updatedAt"
>;

export async function getPlaybackPreferences(accountId: string, profileId?: string | null) {
  await connectToDatabase();
  const existing = await PlaybackPreferenceModel.findOne({
    accountId,
    profileId: profileId ?? null,
  }).lean();

  return {
    ...DEFAULT_PLAYBACK_PREFERENCES,
    ...(existing ?? {}),
    accountId,
    profileId: profileId ?? null,
  };
}

export async function upsertPlaybackPreferences(
  accountId: string,
  profileId: string | null | undefined,
  patch: Partial<PlaybackPreferenceValues>
) {
  await connectToDatabase();
  const updatedAt = new Date();
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<PlaybackPreferenceValues>;
  const insertDefaults = Object.fromEntries(
    Object.entries(DEFAULT_PLAYBACK_PREFERENCES).filter(([key]) => !(key in definedPatch))
  );

  await PlaybackPreferenceModel.updateOne(
    { accountId, profileId: profileId ?? null },
    {
      $set: {
        ...definedPatch,
        updatedAt,
      },
      $setOnInsert: {
        accountId,
        profileId: profileId ?? null,
        ...insertDefaults,
      },
    },
    { upsert: true }
  );

  return getPlaybackPreferences(accountId, profileId);
}
