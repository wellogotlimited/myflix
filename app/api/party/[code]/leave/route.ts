import { NextResponse } from "next/server";
import { connectToDatabase, WatchPartyModel } from "@/lib/db";
import { serializePartyState } from "@/lib/party";
import { publishPartyEvent } from "@/lib/party-events";
import { requireProfile } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  await connectToDatabase();

  const party = await WatchPartyModel.findOne({ code }).lean();
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });

  if (party.hostProfileId === session.profileId) {
    publishPartyEvent(code, { type: "ended", code });
    await WatchPartyModel.deleteOne({ code });
    return NextResponse.json({ ok: true, ended: true });
  }

  await WatchPartyModel.updateOne(
    { code },
    { $pull: { members: { profileId: session.profileId } } }
  );

  const updatedParty = await WatchPartyModel.findOne({ code }).lean();
  if (!updatedParty) {
    return NextResponse.json({ ok: true });
  }

  const serialized = serializePartyState(updatedParty);
  publishPartyEvent(code, {
    type: "state",
    party: serialized,
  });

  return NextResponse.json(serialized);
}
