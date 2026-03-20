import { NextResponse } from "next/server";
import { connectToDatabase, serializeDocuments, WatchProgressModel } from "@/lib/db";
import { requireProfile } from "@/lib/session";

export async function GET() {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 401 });

  await connectToDatabase();
  const items = await WatchProgressModel.find({
    profileId: profile.profileId,
    completed: false,
    mediaType: "movie",
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  return NextResponse.json(serializeDocuments(items));
}
