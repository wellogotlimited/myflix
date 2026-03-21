import { NextRequest, NextResponse } from "next/server";
import {
  connectToDatabase,
  RatingModel,
  GenreAffinityModel,
} from "@/lib/db";
import { requireProfile } from "@/lib/session";

export async function GET(request: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ rating: null });

  const { searchParams } = new URL(request.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  const mediaType = searchParams.get("mediaType") as "movie" | "tv" | null;

  if (!tmdbId || !mediaType) return NextResponse.json({ rating: null });

  await connectToDatabase();

  const existing = await RatingModel.findOne({
    profileId: profile.profileId,
    tmdbId,
    mediaType,
  }).lean();

  return NextResponse.json({ rating: existing?.rating ?? null });
}

export async function POST(request: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 401 });

  const body = await request.json();
  const { tmdbId, mediaType, rating, genreIds = [] } = body as {
    tmdbId: number;
    mediaType: "movie" | "tv";
    rating: "up" | "down" | null;
    genreIds?: number[];
  };

  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  await connectToDatabase();

  if (rating === null) {
    await RatingModel.deleteOne({
      profileId: profile.profileId,
      tmdbId,
      mediaType,
    });
    return NextResponse.json({ ok: true });
  }

  await RatingModel.findOneAndUpdate(
    { profileId: profile.profileId, tmdbId, mediaType },
    { $set: { rating, ratedAt: new Date() } },
    { upsert: true }
  );

  // Adjust genre affinity: thumbs up boosts, thumbs down reduces
  if (genreIds.length > 0) {
    const delta = rating === "up" ? 5 : -3;
    await Promise.all(
      genreIds.map((genreId: number) =>
        GenreAffinityModel.findOneAndUpdate(
          { profileId: profile.profileId, genreId },
          { $inc: { score: delta } },
          { upsert: true, setDefaultsOnInsert: true }
        )
      )
    );
  }

  return NextResponse.json({ ok: true });
}
