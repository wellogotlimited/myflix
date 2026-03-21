import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PairDeviceClient from "@/components/auth/PairDeviceClient";
import { connectToDatabase, DevicePairingModel } from "@/lib/db";
import {
  createPairingToken,
  getPairingCallbackUrl,
  isPairingExpired,
  sanitizeCallbackUrl,
} from "@/lib/pairing";

export const metadata = { title: "Connect TV - Popflix" };

export default async function PairPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login");
  }

  const session = await auth();
  if (!session?.user?.accountId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(getPairingCallbackUrl(token))}`);
  }
  if (!session.user.profileId || !session.user.profileName || !session.user.maturityLevel) {
    redirect(
      `/profiles?callbackUrl=${encodeURIComponent(
        sanitizeCallbackUrl(getPairingCallbackUrl(token), "/")
      )}`
    );
  }

  await connectToDatabase();

  const pairing = await DevicePairingModel.findOne({ token });
  if (!pairing || isPairingExpired(pairing.expiresAt)) {
    return <PairDeviceClient state="error" />;
  }

  if (pairing.status === "consumed") {
    return <PairDeviceClient state="error" />;
  }

  if (pairing.status === "approved") {
    if (pairing.accountId && pairing.accountId !== session.user.accountId) {
      return <PairDeviceClient state="error" />;
    }

    return <PairDeviceClient state="success" />;
  }

  pairing.status = "approved";
  pairing.accountId = session.user.accountId;
  pairing.profileId = session.user.profileId;
  pairing.profileName = session.user.profileName;
  pairing.maturityLevel = session.user.maturityLevel;
  pairing.exchangeToken = createPairingToken();
  pairing.approvedAt = new Date();
  await pairing.save();

  return <PairDeviceClient state="success" />;
}
