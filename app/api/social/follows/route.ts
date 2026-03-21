import { NextResponse } from "next/server";
import { z } from "zod";
import { GenreAffinityModel, ProfileModel, SocialFollowModel, connectToDatabase } from "@/lib/db";
import { getTasteOverlapScore } from "@/lib/recommendations";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  followeeProfileId: z.string().min(1),
});

export async function GET() {
  const session = await requireProfile();
  await connectToDatabase();

  const follows = await SocialFollowModel.find({ followerProfileId: session.profileId }).lean();
  const followeeIds = follows.map((item) => item.followeeProfileId);
  const profiles = followeeIds.length
    ? await ProfileModel.find({ _id: { $in: followeeIds } }).lean()
    : [];

  const [myGenres, theirGenres] = await Promise.all([
    GenreAffinityModel.find({ profileId: session.profileId }).sort({ score: -1 }).limit(10).lean(),
    followeeIds.length
      ? GenreAffinityModel.find({ profileId: { $in: followeeIds } }).lean()
      : Promise.resolve([]),
  ]);

  const myGenreIds = myGenres.map((item) => item.genreId);
  const overlapByProfile = new Map<string, number[]>();
  for (const item of theirGenres) {
    const current = overlapByProfile.get(item.profileId) ?? [];
    current.push(item.genreId);
    overlapByProfile.set(item.profileId, current);
  }

  return NextResponse.json(
    profiles.map((profile) => ({
      _id: profile._id.toString(),
      name: profile.name,
      avatarId: profile.avatarId,
      overlap: getTasteOverlapScore(myGenreIds, overlapByProfile.get(profile._id.toString()) ?? []),
    }))
  );
}

export async function POST(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  if (parsed.data.followeeProfileId === session.profileId) {
    return NextResponse.json({ error: "You already follow yourself" }, { status: 400 });
  }

  await connectToDatabase();
  await SocialFollowModel.updateOne(
    {
      followerProfileId: session.profileId,
      followeeProfileId: parsed.data.followeeProfileId,
    },
    {
      $setOnInsert: {
        followerProfileId: session.profileId,
        followeeProfileId: parsed.data.followeeProfileId,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const followeeProfileId = String(body.followeeProfileId ?? "").trim();
  if (!followeeProfileId) {
    return NextResponse.json({ error: "followeeProfileId required" }, { status: 400 });
  }

  await connectToDatabase();
  await SocialFollowModel.deleteOne({
    followerProfileId: session.profileId,
    followeeProfileId,
  });
  return NextResponse.json({ ok: true });
}
