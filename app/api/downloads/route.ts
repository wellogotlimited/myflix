import { NextResponse } from "next/server";
import { z } from "zod";
import { DownloadJobModel, connectToDatabase, serializeDocuments } from "@/lib/db";
import { recordNotificationEvent } from "@/lib/notifications";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  tmdbId: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().min(1),
  posterPath: z.string().nullable().optional(),
  seasonNumber: z.number().int().nullable().optional(),
  episodeNumber: z.number().int().nullable().optional(),
  episodeTitle: z.string().nullable().optional(),
  status: z.enum(["queued", "downloading", "paused", "completed", "failed", "unsupported"]).optional(),
  progressPct: z.number().min(0).max(100).optional(),
  reason: z.string().nullable().optional(),
});

export async function GET() {
  const session = await requireProfile();
  await connectToDatabase();
  const jobs = await DownloadJobModel.find({ profileId: session.profileId })
    .sort({ updatedAt: -1 })
    .lean();
  return NextResponse.json(serializeDocuments(jobs));
}

export async function POST(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const now = new Date();
  const query = {
    profileId: session.profileId,
    tmdbId: parsed.data.tmdbId,
    mediaType: parsed.data.mediaType,
    seasonNumber: parsed.data.seasonNumber ?? null,
    episodeNumber: parsed.data.episodeNumber ?? null,
  };
  const existing = await DownloadJobModel.findOne(query).lean();

  await DownloadJobModel.updateOne(
    query,
    {
      $set: {
        title: parsed.data.title,
        posterPath: parsed.data.posterPath ?? null,
        seasonNumber: parsed.data.seasonNumber ?? null,
        episodeNumber: parsed.data.episodeNumber ?? null,
        episodeTitle: parsed.data.episodeTitle ?? null,
        status: parsed.data.status ?? "unsupported",
        progressPct: parsed.data.progressPct ?? 0,
        reason: parsed.data.reason ?? "Offline playback is not supported in this browser yet.",
        updatedAt: now,
      },
      $setOnInsert: {
        profileId: session.profileId,
        tmdbId: parsed.data.tmdbId,
        mediaType: parsed.data.mediaType,
        requestedAt: now,
      },
    },
    { upsert: true }
  );

  const isNewDownload = !existing;
  const justCompleted = existing?.status !== "completed" && parsed.data.status === "completed";
  if (isNewDownload || justCompleted) {
    await recordNotificationEvent({
      accountId: session.accountId,
      profileId: session.profileId,
      kind: "download",
      title: justCompleted ? "Download complete" : "Download saved",
      body: justCompleted
        ? parsed.data.mediaType === "tv" && parsed.data.episodeNumber
          ? `${parsed.data.title} S${parsed.data.seasonNumber ?? 1}:E${parsed.data.episodeNumber} is ready offline.`
          : `${parsed.data.title} is ready offline.`
        : parsed.data.mediaType === "tv" && parsed.data.episodeNumber
          ? `${parsed.data.title} S${parsed.data.seasonNumber ?? 1}:E${parsed.data.episodeNumber} was added to your offline queue.`
          : `${parsed.data.title} was added to your offline queue.`,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const tmdbId = Number(body.tmdbId);
  const mediaType = body.mediaType as "movie" | "tv" | undefined;
  const seasonNumber = body.seasonNumber === null || body.seasonNumber === undefined ? null : Number(body.seasonNumber);
  const episodeNumber = body.episodeNumber === null || body.episodeNumber === undefined ? null : Number(body.episodeNumber);
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "tmdbId and mediaType required" }, { status: 400 });
  }
  await connectToDatabase();
  await DownloadJobModel.deleteOne({
    profileId: session.profileId,
    tmdbId,
    mediaType,
    seasonNumber,
    episodeNumber,
  });
  return NextResponse.json({ ok: true });
}
