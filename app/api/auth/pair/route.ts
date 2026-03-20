import { NextResponse } from "next/server";
import { connectToDatabase, DevicePairingModel } from "@/lib/db";
import { createPairingToken, getPairingExpiryDate } from "@/lib/pairing";

export async function POST() {
  await connectToDatabase();

  const token = createPairingToken();
  const expiresAt = getPairingExpiryDate();

  await DevicePairingModel.create({
    token,
    status: "pending",
    createdAt: new Date(),
    expiresAt,
  });

  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
  });
}
