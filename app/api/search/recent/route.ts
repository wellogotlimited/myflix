import { NextResponse } from "next/server";
import { RecentSearchModel, connectToDatabase, serializeDocuments } from "@/lib/db";
import { requireProfile } from "@/lib/session";

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function GET() {
  const session = await requireProfile();
  await connectToDatabase();
  const items = await RecentSearchModel.find({ profileId: session.profileId })
    .sort({ lastUsedAt: -1 })
    .limit(8)
    .lean();
  return NextResponse.json(serializeDocuments(items));
}

export async function POST(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const query = String(body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  await connectToDatabase();
  const now = new Date();
  await RecentSearchModel.updateOne(
    { profileId: session.profileId, normalizedQuery: normalizeQuery(query) },
    {
      $set: { query, lastUsedAt: now },
      $inc: { count: 1 },
      $setOnInsert: {
        profileId: session.profileId,
        normalizedQuery: normalizeQuery(query),
      },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const normalizedQuery = normalizeQuery(String(body.query ?? ""));

  await connectToDatabase();
  if (normalizedQuery) {
    await RecentSearchModel.deleteOne({ profileId: session.profileId, normalizedQuery });
  } else {
    await RecentSearchModel.deleteMany({ profileId: session.profileId });
  }

  return NextResponse.json({ ok: true });
}
