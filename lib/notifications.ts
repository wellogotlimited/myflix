import {
  NotificationEventModel,
  NotificationSubscriptionModel,
  connectToDatabase,
} from "@/lib/db";

export async function recordNotificationEvent({
  accountId,
  profileId,
  kind,
  title,
  body,
  href,
}: {
  accountId: string;
  profileId?: string | null;
  kind: "reminder" | "recommendation" | "system" | "social" | "party" | "download";
  title: string;
  body: string;
  href?: string | null;
}) {
  await connectToDatabase();
  return NotificationEventModel.create({
    accountId,
    profileId: profileId ?? null,
    kind,
    title,
    body,
    href: href ?? null,
    createdAt: new Date(),
  });
}

export async function upsertNotificationSubscription({
  accountId,
  profileId,
  permission,
  browserSupported,
  pushEnabled,
  endpoint,
  userAgent,
}: {
  accountId: string;
  profileId?: string | null;
  permission: "default" | "granted" | "denied";
  browserSupported: boolean;
  pushEnabled: boolean;
  endpoint?: string | null;
  userAgent?: string | null;
}) {
  await connectToDatabase();
  await NotificationSubscriptionModel.updateOne(
    { accountId, profileId: profileId ?? null },
    {
      $set: {
        permission,
        browserSupported,
        pushEnabled,
        endpoint: endpoint ?? null,
        userAgent: userAgent ?? null,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        accountId,
        profileId: profileId ?? null,
      },
    },
    { upsert: true }
  );
}
