import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase, WatchPartyModel } from "@/lib/db";
import { publishPartyEvent } from "@/lib/party-events";
import { serializePartyState } from "@/lib/party";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  tmdbId: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  season: z.number().int().nullable().optional(),
  episode: z.number().int().nullable().optional(),
  title: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await requireProfile();
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  await WatchPartyModel.updateOne(
    { code },
    {
      $push: {
        queue: {
          $each: [
            {
              tmdbId: parsed.data.tmdbId,
              mediaType: parsed.data.mediaType,
              season: parsed.data.season ?? null,
              episode: parsed.data.episode ?? null,
              title: parsed.data.title,
              addedByProfileId: session.profileId,
              addedAt: new Date(),
            },
          ],
          $slice: -20,
        },
      },
    }
  );

  const updated = await WatchPartyModel.findOne({ code }).lean();
  if (updated) {
    publishPartyEvent(code, { type: "state", party: serializePartyState(updated) });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await requireProfile();
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const tmdbId = Number(body.tmdbId);
  const mediaType = body.mediaType as "movie" | "tv" | undefined;
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "tmdbId and mediaType required" }, { status: 400 });
  }

  await connectToDatabase();
  const party = await WatchPartyModel.findOne({ code }).lean();
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  if (party.hostProfileId !== session.profileId) {
    return NextResponse.json({ error: "Only the host can manage the queue" }, { status: 403 });
  }

  await WatchPartyModel.updateOne(
    { code },
    { $pull: { queue: { tmdbId, mediaType } } }
  );

  const updated = await WatchPartyModel.findOne({ code }).lean();
  if (updated) {
    publishPartyEvent(code, { type: "state", party: serializePartyState(updated) });
  }

  return NextResponse.json({ ok: true });
}
