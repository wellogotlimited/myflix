import {
  CollectionItemModel,
  CollectionModel,
  connectToDatabase,
  type CollectionItemDoc,
  type CollectionDoc,
} from "@/lib/db";

export function slugifyCollectionName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "collection";
}

export async function ensureDefaultCollection(accountId: string, profileId: string) {
  await connectToDatabase();
  const now = new Date();

  await CollectionModel.updateOne(
    { accountId, profileId, slug: "my-list" },
    {
      $setOnInsert: {
        accountId,
        profileId,
        name: "My List",
        slug: "my-list",
        isDefault: true,
        isPinned: true,
        isShared: false,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  return CollectionModel.findOne({ accountId, profileId, slug: "my-list" }).lean();
}

export async function createCollection({
  accountId,
  profileId,
  name,
  isPinned = false,
  isShared = false,
}: {
  accountId: string;
  profileId: string;
  name: string;
  isPinned?: boolean;
  isShared?: boolean;
}) {
  await connectToDatabase();
  const now = new Date();
  const baseSlug = slugifyCollectionName(name);
  let slug = baseSlug;
  let suffix = 1;
  while (await CollectionModel.exists({ profileId, slug })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const collection = await CollectionModel.create({
    accountId,
    profileId,
    name: name.trim(),
    slug,
    isDefault: false,
    isPinned,
    isShared,
    createdAt: now,
    updatedAt: now,
  });

  const plain = collection.toObject();
  return {
    ...plain,
    _id: plain._id.toString(),
  } as CollectionDoc;
}

export async function listCollectionsForProfile(profileId: string) {
  await connectToDatabase();
  const collections = await CollectionModel.find({ profileId })
    .sort({ isPinned: -1, updatedAt: -1, createdAt: 1 })
    .lean();
  const ids = collections.map((collection) => collection._id.toString());
  const items = ids.length
    ? await CollectionItemModel.find({ collectionId: { $in: ids } })
        .sort({ rank: -1, addedAt: -1 })
        .lean()
    : [];

  const itemsByCollection = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.collectionId;
    const current = itemsByCollection.get(key) ?? [];
    current.push(item);
    itemsByCollection.set(key, current);
  }

  return collections.map((collection) => ({
    ...collection,
    _id: collection._id.toString(),
    items: (itemsByCollection.get(collection._id.toString()) ?? []).map((item) => ({
      ...item,
      _id: item._id.toString(),
    })),
  }));
}

export async function addItemToCollection({
  collectionId,
  profileId,
  tmdbId,
  mediaType,
  title,
  posterPath,
  backdropPath,
}: {
  collectionId: string;
  profileId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
}) {
  await connectToDatabase();
  const now = new Date();

  await CollectionItemModel.updateOne(
    { collectionId, tmdbId, mediaType },
    {
      $set: {
        title,
        posterPath: posterPath ?? null,
        backdropPath: backdropPath ?? null,
        rank: Date.now(),
        addedAt: now,
      },
      $setOnInsert: {
        collectionId,
        profileId,
        tmdbId,
        mediaType,
      },
    },
    { upsert: true }
  );

  await CollectionModel.updateOne({ _id: collectionId }, { $set: { updatedAt: now } });
}

export async function removeItemFromCollection(
  collectionId: string,
  tmdbId: number,
  mediaType: "movie" | "tv"
) {
  await connectToDatabase();
  await CollectionItemModel.deleteOne({ collectionId, tmdbId, mediaType });
  await CollectionModel.updateOne({ _id: collectionId }, { $set: { updatedAt: new Date() } });
}

export async function reorderCollectionItems(
  collectionId: string,
  orderedIds: string[]
) {
  await connectToDatabase();
  await Promise.all(
    orderedIds.map((id, index) =>
      CollectionItemModel.updateOne(
        { _id: id, collectionId },
        { $set: { rank: orderedIds.length - index } }
      )
    )
  );
  await CollectionModel.updateOne({ _id: collectionId }, { $set: { updatedAt: new Date() } });
}

export async function syncDefaultCollectionItem(
  accountId: string,
  profileId: string,
  item: Pick<CollectionItemDoc, "tmdbId" | "mediaType" | "title" | "posterPath" | "backdropPath">,
  saved: boolean
) {
  const collection = await ensureDefaultCollection(accountId, profileId);
  if (!collection) return;

  if (saved) {
    await addItemToCollection({
      collectionId: collection._id.toString(),
      profileId,
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
    });
    return;
  }

  await removeItemFromCollection(collection._id.toString(), item.tmdbId, item.mediaType);
}
