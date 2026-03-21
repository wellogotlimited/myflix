import { NextResponse } from "next/server";
import { z } from "zod";
import { CollectionModel, connectToDatabase } from "@/lib/db";
import { addItemToCollection, removeItemFromCollection, reorderCollectionItems } from "@/lib/collections";
import { requireProfile } from "@/lib/session";

const addSchema = z.object({
  tmdbId: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().min(1),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
});

const patchSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await requireProfile();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const collection = await CollectionModel.findOne({ _id: id, profileId: session.profileId }).lean();
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  await addItemToCollection({
    collectionId: id,
    profileId: session.profileId,
    ...parsed.data,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireProfile();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const collection = await CollectionModel.findOne({ _id: id, profileId: session.profileId }).lean();
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  await reorderCollectionItems(id, parsed.data.orderedIds);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await requireProfile();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tmdbId = Number(body.tmdbId);
  const mediaType = body.mediaType as "movie" | "tv" | undefined;
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "tmdbId and mediaType required" }, { status: 400 });
  }

  await connectToDatabase();
  const collection = await CollectionModel.findOne({ _id: id, profileId: session.profileId }).lean();
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  await removeItemFromCollection(id, tmdbId, mediaType);
  return NextResponse.json({ ok: true });
}
