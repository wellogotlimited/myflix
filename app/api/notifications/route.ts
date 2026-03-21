import { NextResponse } from "next/server";
import { z } from "zod";
import {
  NotificationEventModel,
  NotificationSubscriptionModel,
  connectToDatabase,
  serializeDocuments,
} from "@/lib/db";
import { upsertNotificationSubscription } from "@/lib/notifications";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  permission: z.enum(["default", "granted", "denied"]).optional(),
  browserSupported: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  endpoint: z.string().nullable().optional(),
  markReadIds: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await requireProfile();
  await connectToDatabase();

  const [events, subscription] = await Promise.all([
    NotificationEventModel.find({
      accountId: session.accountId,
      $or: [{ profileId: null }, { profileId: session.profileId }],
    })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean(),
    NotificationSubscriptionModel.findOne({
      accountId: session.accountId,
      profileId: session.profileId,
    }).lean(),
  ]);

  return NextResponse.json({
    events: serializeDocuments(events),
    subscription: subscription
      ? { ...subscription, _id: subscription._id.toString() }
      : null,
  });
}

export async function PUT(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  if (parsed.data.markReadIds?.length) {
    await NotificationEventModel.updateMany(
      {
        _id: { $in: parsed.data.markReadIds },
        accountId: session.accountId,
      },
      { $set: { readAt: new Date() } }
    );
  }

  if (parsed.data.permission || parsed.data.browserSupported !== undefined) {
    await upsertNotificationSubscription({
      accountId: session.accountId,
      profileId: session.profileId,
      permission: parsed.data.permission ?? "default",
      browserSupported: parsed.data.browserSupported ?? false,
      pushEnabled: parsed.data.pushEnabled ?? false,
      endpoint: parsed.data.endpoint,
    });
  }

  return NextResponse.json({ ok: true });
}
