import { NextResponse } from "next/server";
import { connectToDatabase, WatchPartyModel } from "@/lib/db";
import { publishPartyEvent } from "@/lib/party-events";
import { serializePartyState } from "@/lib/party";
import { requireProfile } from "@/lib/session";

type Params = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  await connectToDatabase();

  const party = await WatchPartyModel.findOne({ code }).lean();
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });

  return NextResponse.json(serializePartyState(party));
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  await connectToDatabase();

  const party = await WatchPartyModel.findOne({ code }).lean();
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  if (party.hostProfileId !== session.profileId) {
    return NextResponse.json({ error: "Only the host can end the party" }, { status: 403 });
  }

  publishPartyEvent(code, { type: "ended", code });
  await WatchPartyModel.deleteOne({ code });
  return NextResponse.json({ ok: true });
}
