import { NextResponse } from "next/server";
import { connectToDatabase, WatchProgressModel } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import { attachCardContext, getTitleSimilar } from "@/lib/tmdb";
import { passesMaturityFilter } from "@/lib/maturity";

export async function GET() {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json([]);

  await connectToDatabase();

  const recentProgress = await WatchProgressModel.find({
    profileId: profile.profileId,
    positionSec: { $gt: 60 },
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  // Deduplicate by tmdbId+mediaType, pick up to 3 distinct titles
  const seen = new Set<string>();
  const recent: { tmdbId: number; mediaType: "movie" | "tv"; title: string }[] = [];
  for (const item of recentProgress) {
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (!seen.has(key)) {
      seen.add(key);
      recent.push({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType as "movie" | "tv",
        title: item.title,
      });
      if (recent.length >= 3) break;
    }
  }

  if (recent.length === 0) return NextResponse.json([]);

  const rows = await Promise.all(
    recent.map(async ({ tmdbId, mediaType, title }) => {
      const similar = await getTitleSimilar(tmdbId, mediaType);
      const withContext = await attachCardContext(
        similar.filter((item) => item.backdrop_path)
      );
      const items = withContext.filter((item) =>
        passesMaturityFilter(item.maturityRating, profile.maturityLevel)
      );
      return {
        title: `Because you watched ${title}`,
        items: items.slice(0, 20),
      };
    })
  );

  return NextResponse.json(rows.filter((r) => r.items.length > 0));
}
