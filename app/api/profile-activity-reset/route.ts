import { NextResponse } from "next/server";
import {
  GenreAffinityModel,
  HiddenTitleModel,
  RatingModel,
  WatchHistoryModel,
  connectToDatabase,
} from "@/lib/db";
import { requireProfile } from "@/lib/session";

export async function POST() {
  const session = await requireProfile();
  await connectToDatabase();
  await Promise.all([
    GenreAffinityModel.deleteMany({ profileId: session.profileId }),
    HiddenTitleModel.deleteMany({ profileId: session.profileId }),
    RatingModel.deleteMany({ profileId: session.profileId }),
    WatchHistoryModel.deleteMany({ profileId: session.profileId }),
  ]);

  return NextResponse.json({ ok: true });
}
