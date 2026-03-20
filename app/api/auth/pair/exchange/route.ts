import { NextResponse } from "next/server";
import { connectToDatabase, DevicePairingModel, TvReceiverModel } from "@/lib/db";
import { createAuthSessionToken, isPairingExpired } from "@/lib/pairing";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exchangeToken = url.searchParams.get("token");

  if (!exchangeToken) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  await connectToDatabase();

  const pairing = await DevicePairingModel.findOne({
    exchangeToken,
    status: "approved",
  });

  if (
    !pairing ||
    !pairing.accountId ||
    !pairing.profileId ||
    !pairing.profileName ||
    !pairing.maturityLevel ||
    pairing.consumedAt ||
    isPairingExpired(pairing.expiresAt)
  ) {
    return NextResponse.redirect(new URL("/login?error=pairing-expired", req.url));
  }

  const now = new Date();
  const receiver = await TvReceiverModel.create({
    accountId: pairing.accountId,
    profileId: pairing.profileId,
    profileName: pairing.profileName,
    maturityLevel: pairing.maturityLevel,
    pairedAt: now,
    lastSeenAt: now,
    commandNonce: null,
    commandPath: null,
    commandTitle: null,
    commandSentAt: null,
  });

  const session = await createAuthSessionToken(req, {
    accountId: pairing.accountId,
    profileId: pairing.profileId,
    profileName: pairing.profileName,
    maturityLevel: pairing.maturityLevel,
  });

  pairing.status = "consumed";
  pairing.consumedAt = new Date();
  await pairing.save();

  const response = NextResponse.redirect(
    new URL(`/tv?receiver=${receiver._id.toString()}`, req.url)
  );
  response.cookies.set(session.cookie.name, session.value, session.cookie.options);
  return response;
}
