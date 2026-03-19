import { NextResponse } from "next/server";
import { connectToDatabase, ProfileModel, WatchPartyModel } from "@/lib/db";
import { publishPartyEvent } from "@/lib/party-events";
import { serializePartyState } from "@/lib/party";
import { requireProfile } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  await connectToDatabase();

  const [party, profile] = await Promise.all([
    WatchPartyModel.findOne({ code }).lean(),
    ProfileModel.findById(session.profileId).lean(),
  ]);

  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Remove existing member entry with this profileId then add fresh one
  await WatchPartyModel.updateOne(
    { code },
    { $pull: { members: { profileId: session.profileId } } }
  );
  await WatchPartyModel.updateOne(
    { code },
    {
      $push: {
        members: {
          profileId: session.profileId,
          name: profile.name,
          avatarId: profile.avatarId,
          joinedAt: new Date(),
        },
      },
    }
  );

  const updated = await WatchPartyModel.findOne({ code }).lean();
  const serialized = serializePartyState(updated!);
  publishPartyEvent(code, {
    type: "state",
    party: serialized,
  });
  return NextResponse.json(serialized);
}
