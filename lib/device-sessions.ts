import { connectToDatabase, DeviceSessionModel } from "@/lib/db";

function inferDeviceLabel(userAgent: string) {
  const source = userAgent.toLowerCase();
  const platform =
    source.includes("android") ? "Android"
    : source.includes("iphone") || source.includes("ipad") ? "iPhone"
    : source.includes("windows") ? "Windows"
    : source.includes("mac os") ? "Mac"
    : source.includes("linux") ? "Linux"
    : "Device";
  const browser =
    source.includes("edg/") ? "Edge"
    : source.includes("chrome/") ? "Chrome"
    : source.includes("safari/") && !source.includes("chrome/") ? "Safari"
    : source.includes("firefox/") ? "Firefox"
    : "Browser";

  return `${platform} - ${browser}`;
}

export async function recordDeviceSession({
  accountId,
  profileId,
  sessionKey,
  userAgent,
  path,
}: {
  accountId: string;
  profileId?: string | null;
  sessionKey: string;
  userAgent: string;
  path?: string | null;
}) {
  await connectToDatabase();
  const now = new Date();
  await DeviceSessionModel.updateOne(
    { sessionKey, accountId },
    {
      $set: {
        profileId: profileId ?? null,
        label: inferDeviceLabel(userAgent),
        userAgent,
        lastPath: path ?? null,
        lastSeenAt: now,
      },
      $setOnInsert: {
        accountId,
        sessionKey,
        trusted: false,
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

export async function setDeviceTrusted(sessionKey: string, trusted: boolean) {
  await connectToDatabase();
  await DeviceSessionModel.updateOne({ sessionKey }, { $set: { trusted } });
}
