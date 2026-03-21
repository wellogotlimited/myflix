import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase, WatchPartyModel } from "@/lib/db";
import { publishPartyEvent } from "@/lib/party-events";
import { serializePartyState } from "@/lib/party";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  emoji: z.string().min(1).max(4),
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
        reactions: {
          $each: [{ profileId: session.profileId, emoji: parsed.data.emoji, sentAt: new Date() }],
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
