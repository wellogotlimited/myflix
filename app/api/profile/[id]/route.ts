import { NextResponse } from "next/server";
import { z } from "zod";
import {
  connectToDatabase,
  isValidObjectId,
  ProfileModel,
  serializeDocument,
  toObjectId,
} from "@/lib/db";
import { requireAuth } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(1).max(24).optional(),
  avatarId: z.string().optional(),
  maturityLevel: z.enum(["KIDS", "TEEN", "ADULT"]).optional(),
  isKidsProfile: z.boolean().optional(),
});

export async function PATCH(
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const result = await ProfileModel.findOneAndUpdate(
    { _id: toObjectId(id), accountId: session.user.accountId },
    { $set: parsed.data },
    { new: true }
  ).lean();

  if (!result) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json(serializeDocument(result));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  await connectToDatabase();
  const count = await ProfileModel.countDocuments({ accountId: session.user.accountId });

  if (count <= 1) {
    return NextResponse.json({ error: "Cannot delete the last profile" }, { status: 400 });
  }

  const result = await ProfileModel.deleteOne({
    _id: toObjectId(id),
    accountId: session.user.accountId,
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
