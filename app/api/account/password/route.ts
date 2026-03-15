import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AccountModel, connectToDatabase, isValidObjectId, toObjectId } from "@/lib/db";
import { requireAuth } from "@/lib/session";

const schema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export async function PATCH(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  if (!isValidObjectId(session.user.accountId)) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await connectToDatabase();
  const account = await AccountModel.findById(toObjectId(session.user.accountId)).lean();

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const valid = await bcrypt.compare(parsed.data.currentPassword, account.passwordHash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await AccountModel.updateOne({ _id: account._id }, { $set: { passwordHash: newHash } });

  return NextResponse.json({ ok: true });
}
