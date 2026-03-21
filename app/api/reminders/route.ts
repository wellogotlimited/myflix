import { NextResponse } from "next/server";
import { z } from "zod";
import { UpcomingReminderModel, connectToDatabase, serializeDocuments } from "@/lib/db";
import { recordNotificationEvent } from "@/lib/notifications";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  tmdbId: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().min(1),
  posterPath: z.string().nullable().optional(),
  reminderType: z.enum(["new-release", "new-episode", "watch-party"]).optional(),
});

export async function GET() {
  const session = await requireProfile();
  await connectToDatabase();
  const reminders = await UpcomingReminderModel.find({ profileId: session.profileId })
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(serializeDocuments(reminders));
}

export async function POST(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  await UpcomingReminderModel.updateOne(
    {
      profileId: session.profileId,
      tmdbId: parsed.data.tmdbId,
      mediaType: parsed.data.mediaType,
    },
    {
      $setOnInsert: {
        profileId: session.profileId,
        ...parsed.data,
        reminderType: parsed.data.reminderType ?? "new-release",
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  await recordNotificationEvent({
    accountId: session.accountId,
    profileId: session.profileId,
    kind: "reminder",
    title: "Reminder added",
    body: `We'll keep an eye on ${parsed.data.title}.`,
    href:
      parsed.data.mediaType === "movie"
        ? `/watch/movie/${parsed.data.tmdbId}`
        : `/watch/tv/${parsed.data.tmdbId}`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const tmdbId = Number(body.tmdbId);
  const mediaType = body.mediaType as "movie" | "tv" | undefined;
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "tmdbId and mediaType required" }, { status: 400 });
  }

  await connectToDatabase();
  await UpcomingReminderModel.deleteOne({ profileId: session.profileId, tmdbId, mediaType });
  return NextResponse.json({ ok: true });
}
