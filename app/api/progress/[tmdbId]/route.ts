import { NextResponse } from "next/server";
import { z } from "zod";
import {
  connectToDatabase,
  GenreAffinityModel,
  serializeDocument,
  WatchHistoryModel,
  WatchProgressModel,
} from "@/lib/db";
import { requireProfile } from "@/lib/session";

const upsertSchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  title: z.string(),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
  seasonNumber: z.number().nullable().optional(),
  episodeNumber: z.number().nullable().optional(),
  episodeTitle: z.string().nullable().optional(),
  positionSec: z.number(),
  durationSec: z.number(),
  genreIds: z.array(z.number()).default([]),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 401 });

  const { tmdbId } = await params;
  const url = new URL(req.url);
  const mediaType = url.searchParams.get("mediaType");
  const seasonNumber = url.searchParams.get("season")
    ? Number(url.searchParams.get("season"))
    : null;
  const episodeNumber = url.searchParams.get("episode")
    ? Number(url.searchParams.get("episode"))
    : null;

  await connectToDatabase();
  const query = {
    profileId: profile.profileId,
    tmdbId: Number(tmdbId),
    ...(mediaType === "movie" || mediaType === "tv" ? { mediaType } : {}),
    ...(seasonNumber !== null ? { seasonNumber } : {}),
    ...(episodeNumber !== null ? { episodeNumber } : {}),
  };

  const item =
    seasonNumber !== null || episodeNumber !== null
      ? await WatchProgressModel.findOne(query).lean()
      : await WatchProgressModel.findOne(query)
          .sort({ updatedAt: -1, seasonNumber: -1, episodeNumber: -1 })
          .lean();

  if (!item) return NextResponse.json(null);
  return NextResponse.json(serializeDocument(item));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 401 });

  const { tmdbId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const {
    mediaType, title, posterPath, backdropPath,
    seasonNumber, episodeNumber, episodeTitle,
    positionSec, durationSec, genreIds,
  } = parsed.data;

  const completed = durationSec > 0 && positionSec / durationSec >= 0.9;
  const now = new Date();

  await connectToDatabase();

  await WatchProgressModel.updateOne(
    {
      profileId: profile.profileId,
      tmdbId: Number(tmdbId),
      mediaType,
      seasonNumber: seasonNumber ?? null,
      episodeNumber: episodeNumber ?? null,
    },
    {
      $set: {
        title,
        posterPath: posterPath ?? null,
        backdropPath: backdropPath ?? null,
        episodeTitle: episodeTitle ?? null,
        positionSec,
        durationSec,
        completed,
        genreIds,
        updatedAt: now,
      },
      $setOnInsert: {
        profileId: profile.profileId,
        tmdbId: Number(tmdbId),
        mediaType,
        seasonNumber: seasonNumber ?? null,
        episodeNumber: episodeNumber ?? null,
      },
    },
    { upsert: true }
  );

  if (durationSec > 0 && positionSec / durationSec >= 0.5 && genreIds.length > 0) {
    await updateGenreAffinity(profile.profileId, genreIds);

    await WatchHistoryModel.updateOne(
      { profileId: profile.profileId, tmdbId: Number(tmdbId), mediaType },
      {
        $set: { genreIds, watchedAt: now },
        $setOnInsert: { profileId: profile.profileId, tmdbId: Number(tmdbId), mediaType },
      },
      { upsert: true }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 401 });

  const { tmdbId } = await params;
  await connectToDatabase();

  await WatchProgressModel.deleteMany({
    profileId: profile.profileId,
    tmdbId: Number(tmdbId),
  });

  return NextResponse.json({ ok: true });
}

async function updateGenreAffinity(profileId: string, genreIds: number[]) {
  await Promise.all(
    genreIds.map((genreId) =>
      GenreAffinityModel.updateOne(
        { profileId, genreId },
        { $inc: { score: 1 }, $setOnInsert: { profileId, genreId } },
        { upsert: true }
      )
    )
  );
}
