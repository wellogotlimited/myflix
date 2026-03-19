import { NextResponse } from "next/server";
import { z } from "zod";
import {
  connectToDatabase,
  GenreAffinityModel,
  ProfileModel,
} from "@/lib/db";
import { requireProfile } from "@/lib/session";

const VALID_GENRE_IDS = new Set([
  28, 35, 18, 27, 878, 10749, 53, 16, 99, 80, 12, 10751, 14, 9648, 36,
]);

const postSchema = z.object({
  genreIds: z.array(z.number().int()).max(15),
});

export async function GET() {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // requireProfile() returns { profileId, accountId, maturityLevel } — no .user wrapper
  const { profileId } = session;

  await connectToDatabase();
  const profile = await ProfileModel.findById(profileId).lean();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (profile.onboardingComplete) {
    return NextResponse.json({ needsOnboarding: false });
  }

  const count = await GenreAffinityModel.countDocuments({ profileId });

  return NextResponse.json({ needsOnboarding: count === 0 });
}

export async function POST(req: Request) {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId } = session;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const validIds = parsed.data.genreIds.filter((id) => VALID_GENRE_IDS.has(id));

  await connectToDatabase();

  if (validIds.length > 0) {
    await Promise.all(
      validIds.map((genreId) =>
        GenreAffinityModel.findOneAndUpdate(
          { profileId, genreId },
          { $inc: { score: 3 } },
          { upsert: true }
        )
      )
    );
  }

  await ProfileModel.findByIdAndUpdate(profileId, {
    $set: { onboardingComplete: true },
  });

  return NextResponse.json({ ok: true });
}
