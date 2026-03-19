import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  connectToDatabase,
  isValidObjectId,
  ProfileModel,
  toObjectId,
} from "@/lib/db";
import { requireAuth } from "@/lib/session";

const schema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

// In-memory rate limiter: max 5 attempts per profileId per 15 minutes
const attempts = new Map<string, { count: number; firstAt: number }>();

function checkRateLimit(profileId: string): boolean {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const entry = attempts.get(profileId);

  if (!entry || now - entry.firstAt > window) {
    attempts.set(profileId, { count: 1, firstAt: now });
    return true;
  }

  if (entry.count >= 5) return false;

  entry.count++;
  return true;
}

function resetAttempts(profileId: string) {
  attempts.delete(profileId);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  if (!checkRateLimit(id)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  await connectToDatabase();
  const profile = await ProfileModel.findOne({
    _id: toObjectId(id),
    accountId: session.user.accountId,
  }).lean();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // No PIN set — always allow
  if (!profile.pin) {
    resetAttempts(id);
    return NextResponse.json({ ok: true });
  }

  const match = await bcrypt.compare(parsed.data.pin, profile.pin);
  if (!match) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  resetAttempts(id);
  return NextResponse.json({ ok: true });
}
