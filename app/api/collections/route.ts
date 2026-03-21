import { NextResponse } from "next/server";
import { z } from "zod";
import { createCollection, ensureDefaultCollection, listCollectionsForProfile } from "@/lib/collections";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1).max(40),
  isPinned: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

export async function GET() {
  const session = await requireProfile();
  await ensureDefaultCollection(session.accountId, session.profileId);
  const collections = await listCollectionsForProfile(session.profileId);
  return NextResponse.json(collections);
}

export async function POST(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const collection = await createCollection({
    accountId: session.accountId,
    profileId: session.profileId,
    name: parsed.data.name,
    isPinned: parsed.data.isPinned ?? false,
    isShared: parsed.data.isShared ?? false,
  });

  return NextResponse.json({ ...collection, _id: collection._id.toString() }, { status: 201 });
}
