import { NextResponse } from "next/server";
import { HiddenTitleModel, connectToDatabase, serializeDocuments } from "@/lib/db";
import { hideTitle, unhideTitle } from "@/lib/profile-controls";
import { requireProfile } from "@/lib/session";

export async function GET() {
  const session = await requireProfile();
  await connectToDatabase();
  const items = await HiddenTitleModel.find({ profileId: session.profileId })
    .sort({ hiddenAt: -1 })
    .lean();
  return NextResponse.json(serializeDocuments(items));
}

export async function POST(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const tmdbId = Number(body.tmdbId);
  const mediaType = body.mediaType as "movie" | "tv" | undefined;
  const reason = typeof body.reason === "string" ? body.reason : null;
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "tmdbId and mediaType required" }, { status: 400 });
  }

  await hideTitle(session.profileId, tmdbId, mediaType, reason);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const tmdbId = Number(body.tmdbId);
  const mediaType = body.mediaType as "movie" | "tv" | undefined;
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "tmdbId and mediaType required" }, { status: 400 });
  }

  await unhideTitle(session.profileId, tmdbId, mediaType);
  return NextResponse.json({ ok: true });
}
