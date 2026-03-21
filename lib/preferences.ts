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

  await PlaybackPreferenceModel.updateOne(
    { accountId, profileId: profileId ?? null },
    {
      $set: {
        ...patch,
        updatedAt,
      },
      $setOnInsert: {
        accountId,
        profileId: profileId ?? null,
        ...DEFAULT_PLAYBACK_PREFERENCES,
      },
    },
    { upsert: true }
  );

  return getPlaybackPreferences(accountId, profileId);
}
