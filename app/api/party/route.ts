import { NextResponse } from "next/server";
import { z } from "zod";
import {
  connectToDatabase,
  ProfileModel,
  WatchPartyModel,
} from "@/lib/db";
import { publishPartyEvent } from "@/lib/party-events";
import { generatePartyCode, serializePartyState } from "@/lib/party";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  tmdbId: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  season: z.number().int().nullable().optional(),
  episode: z.number().int().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();

  const profile = await ProfileModel.findById(session.profileId).lean();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Generate unique code
  let code = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generatePartyCode();
    const existing = await WatchPartyModel.findOne({ code: candidate }).lean();
    if (!existing) { code = candidate; break; }
  }
  if (!code) return NextResponse.json({ error: "Failed to generate party code" }, { status: 500 });

  const now = new Date();
  const party = await WatchPartyModel.create({
    code,
    hostProfileId: session.profileId,
    tmdbId: parsed.data.tmdbId,
    mediaType: parsed.data.mediaType,
    season: parsed.data.season ?? null,
    episode: parsed.data.episode ?? null,
    positionSec: 0,
    isPlaying: false,
    lastUpdatedAt: now,
    members: [
      {
        profileId: session.profileId,
        name: profile.name,
        avatarId: profile.avatarId,
        joinedAt: now,
      },
    ],
    messages: [],
    reactions: [],
    queue: [],
    scheduledFor: null,
    createdAt: now,
  });

  publishPartyEvent(party.code, {
    type: "state",
    party: serializePartyState(party),
  });

  return NextResponse.json({ code: party.code, _id: party._id.toString() }, { status: 201 });
}
