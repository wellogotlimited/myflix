import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase, ProfileModel, WatchPartyModel } from "@/lib/db";
import { publishPartyEvent } from "@/lib/party-events";
import { serializePartyState } from "@/lib/party";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  text: z.string().min(1).max(200),
});

export async function POST(
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

  const [party, profile] = await Promise.all([
    WatchPartyModel.findOne({ code }).lean(),
    ProfileModel.findById(session.profileId).lean(),
  ]);

  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const newMessage = {
    profileId: session.profileId,
    name: profile.name,
    text: parsed.data.text,
    sentAt: new Date(),
  };

  // Push message and trim to last 50
  await WatchPartyModel.updateOne(
    { code },
    { $push: { messages: { $each: [newMessage], $slice: -50 } } }
  );

  const updated = await WatchPartyModel.findOne({ code }).lean();
  if (updated) {
    publishPartyEvent(code, {
      type: "state",
      party: serializePartyState(updated),
    });
  }

  return NextResponse.json({ ok: true });
}
