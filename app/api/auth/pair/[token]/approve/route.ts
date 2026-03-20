import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase, DevicePairingModel } from "@/lib/db";
import { createPairingToken, isPairingExpired } from "@/lib/pairing";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await auth();
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  await connectToDatabase();

  const pairing = await DevicePairingModel.findOne({ token });
  if (!pairing || isPairingExpired(pairing.expiresAt)) {
    return NextResponse.json({ error: "Pairing session expired" }, { status: 404 });
  }

  if (pairing.status === "consumed") {
    return NextResponse.json({ error: "Pairing session already used" }, { status: 409 });
  }

  if (pairing.status === "approved") {
    if (pairing.accountId && pairing.accountId !== session.user.accountId) {
      return NextResponse.json({ error: "Pairing session already approved" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  }

  pairing.status = "approved";
  pairing.accountId = session.user.accountId;
  pairing.exchangeToken = createPairingToken();
  pairing.approvedAt = new Date();
  await pairing.save();

  return NextResponse.json({ ok: true });
}
