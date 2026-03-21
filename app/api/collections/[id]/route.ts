import { NextResponse } from "next/server";
import { z } from "zod";
import { CollectionModel, connectToDatabase } from "@/lib/db";
import { slugifyCollectionName } from "@/lib/collections";
import { requireProfile } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  isPinned: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireProfile();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const update: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date(),
  };
  if (parsed.data.name) {
    update.slug = slugifyCollectionName(parsed.data.name);
  }

  const collection = await CollectionModel.findOneAndUpdate(
    { _id: id, profileId: session.profileId, isDefault: false },
    { $set: update },
    { new: true }
  ).lean();

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  return NextResponse.json({ ...collection, _id: collection._id.toString() });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireProfile();
  const { id } = await params;
  await connectToDatabase();
  const result = await CollectionModel.deleteOne({
    _id: id,
    profileId: session.profileId,
    isDefault: false,
  });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
