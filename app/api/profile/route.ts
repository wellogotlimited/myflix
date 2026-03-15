import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase, ProfileModel, serializeDocuments } from "@/lib/db";
import { requireAuth } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(24),
  avatarId: z.string().default("red"),
  maturityLevel: z.enum(["KIDS", "TEEN", "ADULT"]).default("ADULT"),
  isKidsProfile: z.boolean().default(false),
});

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const profiles = await ProfileModel.find({ accountId: session.user.accountId })
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json(serializeDocuments(profiles));
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const count = await ProfileModel.countDocuments({ accountId: session.user.accountId });

  if (count >= 5) {
    return NextResponse.json({ error: "Maximum 5 profiles per account" }, { status: 400 });
  }

  const profile = await ProfileModel.create({
    accountId: session.user.accountId,
    name: parsed.data.name,
    avatarId: parsed.data.avatarId,
    maturityLevel: parsed.data.maturityLevel,
    isKidsProfile: parsed.data.isKidsProfile,
    createdAt: new Date(),
  });

  return NextResponse.json({ _id: profile._id.toString(), ...parsed.data }, { status: 201 });
}
