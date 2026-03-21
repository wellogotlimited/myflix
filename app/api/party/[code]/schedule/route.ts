import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase, WatchPartyModel } from "@/lib/db";
import { publishPartyEvent } from "@/lib/party-events";
import { serializePartyState } from "@/lib/party";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  scheduledFor: z.string().nullable(),
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
  const party = await WatchPartyModel.findOne({ code }).lean();
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  if (party.hostProfileId !== session.profileId) {
    return NextResponse.json({ error: "Only the host can schedule the party" }, { status: 403 });
  }

  await WatchPartyModel.updateOne(
    { code },
    { $set: { scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null } }
  );

  const updated = await WatchPartyModel.findOne({ code }).lean();
  if (updated) {
    publishPartyEvent(code, { type: "state", party: serializePartyState(updated) });
  }

  return NextResponse.json({ ok: true });
}
