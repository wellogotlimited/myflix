import { NextResponse } from "next/server";
import { connectToDatabase, DevicePairingModel } from "@/lib/db";
import { isPairingExpired } from "@/lib/pairing";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  await connectToDatabase();

  const pairing = await DevicePairingModel.findOne({ token }).lean();
  if (!pairing || isPairingExpired(pairing.expiresAt)) {
    return NextResponse.json({ status: "expired" }, { status: 404 });
  }

  return NextResponse.json({
    status: pairing.status,
    exchangeToken: pairing.status === "approved" ? pairing.exchangeToken : null,
  });
}
