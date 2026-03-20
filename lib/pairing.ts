import { encode } from "next-auth/jwt";

const DEVICE_PAIRING_TTL_MS = 10 * 60 * 1000;
const AUTH_SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export function createPairingToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function getPairingExpiryDate() {
  return new Date(Date.now() + DEVICE_PAIRING_TTL_MS);
}

export function isPairingExpired(expiresAt: Date | string) {
  const expires =
    typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();

  return expires <= Date.now();
}

export function getPairingCallbackUrl(token: string) {
  return `/pair?token=${encodeURIComponent(token)}`;
}

export function sanitizeCallbackUrl(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

export function getAuthSessionCookieConfig(req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ? `${forwardedProto}:` : new URL(req.url).protocol;
  const useSecureCookies = protocol === "https:";
  const name = `${useSecureCookies ? "__Secure-" : ""}authjs.session-token`;

  return {
    name,
    maxAge: AUTH_SESSION_MAX_AGE_SEC,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: useSecureCookies,
      maxAge: AUTH_SESSION_MAX_AGE_SEC,
      expires: new Date(Date.now() + AUTH_SESSION_MAX_AGE_SEC * 1000),
    },
  };
}

export async function createAuthSessionToken(
  req: Request,
  payload: {
    accountId: string;
    profileId?: string | null;
    profileName?: string | null;
    maturityLevel?: string | null;
  }
) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  const cookie = getAuthSessionCookieConfig(req);
  const value = await encode({
    secret,
    salt: cookie.name,
    maxAge: cookie.maxAge,
    token: {
      sub: payload.accountId,
      accountId: payload.accountId,
      profileId: payload.profileId ?? null,
      profileName: payload.profileName ?? null,
      maturityLevel: payload.maturityLevel ?? null,
    },
  });

  return {
    cookie,
    value,
  };
}
