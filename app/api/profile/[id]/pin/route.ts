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
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN must be exactly 4 digits")
    .nullable(),
});

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

  await connectToDatabase();

  const hash = parsed.data.pin ? await bcrypt.hash(parsed.data.pin, 10) : null;

  const result = await ProfileModel.findOneAndUpdate(
    { _id: toObjectId(id), accountId: session.user.accountId },
    { $set: { pin: hash } }
  ).lean();

  if (!result) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
