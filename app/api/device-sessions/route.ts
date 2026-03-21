import { NextRequest, NextResponse } from "next/server";
import { DeviceSessionModel, connectToDatabase, serializeDocuments } from "@/lib/db";
import { recordDeviceSession, setDeviceTrusted } from "@/lib/device-sessions";
import { requireProfile } from "@/lib/session";

export async function GET() {
  const session = await requireProfile();
  await connectToDatabase();
  const items = await DeviceSessionModel.find({ accountId: session.accountId })
    .sort({ lastSeenAt: -1 })
    .limit(20)
    .lean();
  return NextResponse.json(serializeDocuments(items));
}

export async function POST(req: NextRequest) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const sessionKey = String(body.sessionKey ?? "").trim();
  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey required" }, { status: 400 });
  }

  await recordDeviceSession({
    accountId: session.accountId,
    profileId: session.profileId,
    sessionKey,
    userAgent: req.headers.get("user-agent") ?? "Unknown browser",
    path: typeof body.path === "string" ? body.path : null,
  });

  if (typeof body.trusted === "boolean") {
    await setDeviceTrusted(sessionKey, body.trusted);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => ({}));
  const sessionKey = String(body.sessionKey ?? "").trim();
  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey required" }, { status: 400 });
  }

  await connectToDatabase();
  await DeviceSessionModel.deleteOne({ accountId: session.accountId, sessionKey });
  return NextResponse.json({ ok: true });
}
