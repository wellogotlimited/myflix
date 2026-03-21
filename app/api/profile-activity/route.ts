import { NextResponse } from "next/server";
import {
  HiddenTitleModel,
  RatingModel,
  WatchHistoryModel,
  WatchProgressModel,
  connectToDatabase,
  serializeDocuments,
} from "@/lib/db";
import { requireProfile } from "@/lib/session";

export async function GET() {
  const session = await requireProfile();
  await connectToDatabase();

  const [history, ratings, progress, hiddenTitles] = await Promise.all([
    WatchHistoryModel.find({ profileId: session.profileId }).sort({ watchedAt: -1 }).limit(40).lean(),
    RatingModel.find({ profileId: session.profileId }).sort({ ratedAt: -1 }).limit(40).lean(),
    WatchProgressModel.find({ profileId: session.profileId }).sort({ updatedAt: -1 }).limit(40).lean(),
    HiddenTitleModel.find({ profileId: session.profileId }).sort({ hiddenAt: -1 }).limit(40).lean(),
  ]);

  return NextResponse.json({
    history: serializeDocuments(history),
    ratings: serializeDocuments(ratings),
    progress: serializeDocuments(progress),
    hiddenTitles: serializeDocuments(hiddenTitles),
  });
}

export async function DELETE() {
  const session = await requireProfile();
  await connectToDatabase();
  await Promise.all([
    HiddenTitleModel.deleteMany({ profileId: session.profileId }),
    RatingModel.deleteMany({ profileId: session.profileId }),
    WatchHistoryModel.deleteMany({ profileId: session.profileId }),
  ]);

  return NextResponse.json({ ok: true });
}
