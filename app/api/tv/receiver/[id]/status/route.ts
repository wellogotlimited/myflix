import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectToDatabase, TvReceiverModel } from "@/lib/db";

const schema = z.object({
  path: z.string().min(1).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  captionsAvailable: z.boolean().optional(),
  captionsEnabled: z.boolean().optional(),
  captions: z
    .array(
      z.object({
        index: z.number().int().min(0),
        label: z.string().min(1).max(120),
      })
    )
    .optional(),
  activeCaptionIndex: z.number().int().min(-1).optional(),
  isPlaying: z.boolean(),
  currentTimeSec: z.number().min(0),
  durationSec: z.number().min(0),
  mediaType: z.enum(["movie", "tv"]).nullable().optional(),
  tmdbId: z.string().min(1).nullable().optional(),
  seasonNumber: z.number().int().min(1).nullable().optional(),
  episodeNumber: z.number().int().min(1).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { id } = await params;
  await connectToDatabase();

  const receiver = await TvReceiverModel.findById(id);
  if (!receiver || receiver.accountId !== session.user.accountId) {
    return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
  }

  receiver.statusNonce = crypto.randomUUID();
  receiver.statusPath = parsed.data.path ?? null;
  receiver.statusTitle = parsed.data.title ?? null;
  receiver.statusCaptionsAvailable = parsed.data.captionsAvailable ?? false;
  receiver.statusCaptionsEnabled = parsed.data.captionsEnabled ?? false;
  receiver.statusCaptions = parsed.data.captions ?? [];
  receiver.statusActiveCaptionIndex = parsed.data.activeCaptionIndex ?? -1;
  receiver.statusIsPlaying = parsed.data.isPlaying;
  receiver.statusCurrentTimeSec = parsed.data.currentTimeSec;
  receiver.statusDurationSec = parsed.data.durationSec;
  receiver.statusMediaType = parsed.data.mediaType ?? null;
  receiver.statusTmdbId = parsed.data.tmdbId ?? null;
  receiver.statusSeasonNumber = parsed.data.seasonNumber ?? null;
  receiver.statusEpisodeNumber = parsed.data.episodeNumber ?? null;
  receiver.statusUpdatedAt = new Date();
  receiver.lastSeenAt = new Date();
  await receiver.save();

  return NextResponse.json({ ok: true });
}
