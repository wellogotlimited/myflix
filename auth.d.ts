import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      accountId: string;
      profileId: string | null;
      profileName: string | null;
      maturityLevel: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accountId?: string;
    profileId?: string | null;
    profileName?: string | null;
    maturityLevel?: string | null;
  }
}
