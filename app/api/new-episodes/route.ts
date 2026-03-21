import { NextResponse } from "next/server";
import { connectToDatabase, BookmarkModel, WatchProgressModel } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import { getShowDetails } from "@/lib/tmdb";

export async function GET() {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ tmdbIds: [] });

  await connectToDatabase();

  // Get all TV bookmarks for this profile
  const tvBookmarks = await BookmarkModel.find({
    profileId: profile.profileId,
    mediaType: "tv",
  }).lean();

  if (!tvBookmarks.length) return NextResponse.json({ tmdbIds: [] });

  const tvIds = tvBookmarks.map((b) => b.tmdbId);

  // Get watch progress for all TV shows in My List
  const progressDocs = await WatchProgressModel.find({
    profileId: profile.profileId,
    mediaType: "tv",
    tmdbId: { $in: tvIds },
  })
    .sort({ updatedAt: -1 })
    .lean();

  // Keep only the most recent progress per show
  const latestProgress = new Map<number, { seasonNumber: number; episodeNumber: number }>();
  for (const doc of progressDocs) {
    if (!latestProgress.has(doc.tmdbId) && doc.seasonNumber && doc.episodeNumber) {
      latestProgress.set(doc.tmdbId, {
        seasonNumber: doc.seasonNumber,
        episodeNumber: doc.episodeNumber,
      });
    }
  }

  // Only check shows the user has actually started
  const showsToCheck = [...latestProgress.entries()];
  if (!showsToCheck.length) return NextResponse.json({ tmdbIds: [] });

  const newEpisodeIds: number[] = [];
  const now = new Date();

  await Promise.all(
    showsToCheck.map(async ([tmdbId, { seasonNumber, episodeNumber }]) => {
      try {
        const details = await getShowDetails(String(tmdbId));

        const airedSeasons = details.seasons.filter(
          (s) => s.season_number > 0 && s.air_date && new Date(s.air_date) <= now
        );
        if (!airedSeasons.length) return;

        const maxSeason = Math.max(...airedSeasons.map((s) => s.season_number));

        // User is behind on seasons
        if (seasonNumber < maxSeason) {
          newEpisodeIds.push(tmdbId);
          return;
        }

        // Same season — check if there are more episodes
        const currentSeason = airedSeasons.find((s) => s.season_number === seasonNumber);
        if (currentSeason && episodeNumber < currentSeason.episode_count) {
          newEpisodeIds.push(tmdbId);
        }
      } catch {
        // Skip on error
      }
    })
  );

  return NextResponse.json({ tmdbIds: newEpisodeIds });
}
