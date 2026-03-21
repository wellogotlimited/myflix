import { NextResponse } from "next/server";
import { z } from "zod";
import { getParentalRule, upsertParentalRule } from "@/lib/profile-controls";
import { requireProfile } from "@/lib/session";

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

export async function GET() {
  const session = await requireProfile();
  const rules = await getParentalRule(session.profileId);
  return NextResponse.json(rules);
}

export async function PUT(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const rules = await upsertParentalRule(session.profileId, parsed.data);
  return NextResponse.json(rules);
}
