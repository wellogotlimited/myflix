import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase, WatchPartyModel } from "@/lib/db";
import { publishPartyEvent } from "@/lib/party-events";
import { serializePartyState } from "@/lib/party";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  positionSec: z.number().min(0),
  isPlaying: z.boolean(),
  season: z.number().int().nullable().optional(),
  episode: z.number().int().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const party = await WatchPartyModel.findOne({ code }).lean();
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  if (party.hostProfileId !== session.profileId) {
    return NextResponse.json({ error: "Only the host can update playback state" }, { status: 403 });
  }

  const update: Record<string, unknown> = {
    positionSec: parsed.data.positionSec,
    isPlaying: parsed.data.isPlaying,
    lastUpdatedAt: new Date(),
  };
  if (parsed.data.season !== undefined) update.season = parsed.data.season;
  if (parsed.data.episode !== undefined) update.episode = parsed.data.episode;

  await WatchPartyModel.updateOne({ code }, { $set: update });
  const updatedParty = await WatchPartyModel.findOne({ code }).lean();
  if (updatedParty) {
    publishPartyEvent(code, {
      type: "state",
      party: serializePartyState(updatedParty),
    });
  }
  return NextResponse.json({ ok: true });
}
