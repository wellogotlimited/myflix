import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase, isValidObjectId, ProfileModel, toObjectId } from "@/lib/db";
import { getParentalRule, upsertParentalRule } from "@/lib/profile-controls";
import { requireAuth } from "@/lib/session";

const schema = z.object({
  blockedTmdbIds: z.array(z.number().int()).optional(),
  allowedTmdbIds: z.array(z.number().int()).optional(),
  allowOnlyMode: z.boolean().optional(),
  safeSearch: z.boolean().optional(),
  hideMatureArtwork: z.boolean().optional(),
  sessionLimitMinutes: z.number().nullable().optional(),
  bedtimeStart: z.string().nullable().optional(),
  bedtimeEnd: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await requireAuth();
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  await connectToDatabase();
  const profile = await ProfileModel.findOne({
    _id: toObjectId(id),
    accountId: session.user.accountId,
  }).lean();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const rules = await getParentalRule(id);
  return NextResponse.json(rules);
}

export async function PUT(req: Request, { params }: Params) {
  const session = await requireAuth();
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const profile = await ProfileModel.findOne({
    _id: toObjectId(id),
    accountId: session.user.accountId,
  }).lean();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const rules = await upsertParentalRule(id, parsed.data);
  return NextResponse.json(rules);
}
