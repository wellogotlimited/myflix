import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  connectToDatabase,
  isValidObjectId,
  ProfileModel,
  TvReceiverModel,
} from "@/lib/db";
import { createAuthSessionToken } from "@/lib/pairing";
import { TV_RECEIVER_ONLINE_WINDOW_MS } from "@/lib/tv-remote";

export async function GET() {
  const session = await auth();
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const onlineSince = new Date(Date.now() - TV_RECEIVER_ONLINE_WINDOW_MS);
  const receiver = await TvReceiverModel.findOne({
    accountId: session.user.accountId,
    lastSeenAt: { $gte: onlineSince },
  })
    .sort({ lastSeenAt: -1 })
    .lean();

  if (!receiver) {
    return NextResponse.json({ receiver: null });
  }

  return NextResponse.json({
    receiver: {
      id: receiver._id.toString(),
      profileName: receiver.profileName,
      lastSeenAt:
        typeof receiver.lastSeenAt === "string"
          ? receiver.lastSeenAt
          : receiver.lastSeenAt.toISOString(),
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const profile =
    session.user.profileId && session.user.profileName && session.user.maturityLevel
      ? {
          _id: session.user.profileId,
          name: session.user.profileName,
          maturityLevel: session.user.maturityLevel as "KIDS" | "TEEN" | "ADULT",
        }
      : await ProfileModel.findOne({ accountId: session.user.accountId })
          .sort({ createdAt: 1 })
          .lean();

  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { receiverId?: string } | null;
  const requestedReceiverId =
    body?.receiverId && isValidObjectId(body.receiverId) ? body.receiverId : null;

  let receiver =
    requestedReceiverId
      ? await TvReceiverModel.findOne({
          _id: requestedReceiverId,
          accountId: session.user.accountId,
        })
      : null;

  const now = new Date();
  if (receiver) {
    receiver.profileId = profile._id.toString();
    receiver.profileName = profile.name;
    receiver.maturityLevel = profile.maturityLevel;
    receiver.lastSeenAt = now;
    await receiver.save();
  } else {
    receiver = await TvReceiverModel.create({
      accountId: session.user.accountId,
      profileId: profile._id.toString(),
      profileName: profile.name,
      maturityLevel: profile.maturityLevel,
      pairedAt: now,
      lastSeenAt: now,
    });
  }

  const nextSession = await createAuthSessionToken(req, {
    accountId: session.user.accountId,
    profileId: profile._id.toString(),
    profileName: profile.name,
    maturityLevel: profile.maturityLevel,
  });

  const response = NextResponse.json({
    receiver: {
      id: receiver._id.toString(),
      profileName: receiver.profileName,
      lastSeenAt: receiver.lastSeenAt.toISOString(),
    },
  });
  response.cookies.set(
    nextSession.cookie.name,
    nextSession.value,
    nextSession.cookie.options
  );

  return response;
}
