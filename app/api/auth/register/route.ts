import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AccountModel, connectToDatabase, ProfileModel } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(24),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;
  await connectToDatabase();

  const normalizedEmail = email.toLowerCase();
  const existing = await AccountModel.findOne({ email: normalizedEmail }).lean();

  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const account = await AccountModel.create({
    email: normalizedEmail,
    passwordHash,
    createdAt: now,
  });

  await ProfileModel.create({
    accountId: account._id.toString(),
    name,
    avatarId: "red",
    maturityLevel: "ADULT",
    isKidsProfile: false,
    createdAt: now,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
