import { NextResponse } from "next/server";
import { z } from "zod";
import { BookmarkModel, connectToDatabase, serializeDocuments } from "@/lib/db";
import { requireProfile } from "@/lib/session";

const addSchema = z.object({
  tmdbId: z.number(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string(),
  posterPath: z.string().nullable().optional(),
});

export async function GET() {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 401 });

  await connectToDatabase();
  const bookmarks = await BookmarkModel.find({ profileId: profile.profileId })
    .sort({ savedAt: -1 })
    .lean();

  return NextResponse.json(serializeDocuments(bookmarks));
}

export async function POST(req: Request) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  await BookmarkModel.updateOne(
    { profileId: profile.profileId, tmdbId: parsed.data.tmdbId, mediaType: parsed.data.mediaType },
    {
      $setOnInsert: {
        profileId: profile.profileId,
        tmdbId: parsed.data.tmdbId,
        mediaType: parsed.data.mediaType,
        title: parsed.data.title,
        posterPath: parsed.data.posterPath ?? null,
        savedAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 401 });

  const { tmdbId, mediaType } = await req.json().catch(() => ({}));
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "tmdbId and mediaType required" }, { status: 400 });
  }

  await connectToDatabase();
  await BookmarkModel.deleteOne({
    profileId: profile.profileId,
    tmdbId: Number(tmdbId),
    mediaType,
  });

  return NextResponse.json({ ok: true });
}
