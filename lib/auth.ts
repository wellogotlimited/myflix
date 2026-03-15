import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { AccountModel, connectToDatabase, isValidObjectId, ProfileModel, toObjectId } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On sign-in, embed accountId from the credentials authorize result
      if (user) {
        token.accountId = user.id;
        token.profileId = null;
        token.profileName = null;
        token.maturityLevel = null;
      }

      // On profile switch via useSession().update({ profileId, ... })
      if (trigger === "update" && session?.profileId !== undefined) {
        if (session.profileId === null) {
          token.profileId = null;
          token.profileName = null;
          token.maturityLevel = null;
        } else if (isValidObjectId(session.profileId as string)) {
          await connectToDatabase();
          const profile = await ProfileModel.findOne({
            _id: toObjectId(session.profileId as string),
            accountId: token.accountId as string,
          }).lean();

          if (profile) {
            token.profileId = profile._id.toString();
            token.profileName = profile.name;
            token.maturityLevel = profile.maturityLevel;
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.accountId = (token.accountId as string) ?? "";
      session.user.profileId = (token.profileId as string | null) ?? null;
      session.user.profileName = (token.profileName as string | null) ?? null;
      session.user.maturityLevel = (token.maturityLevel as string | null) ?? null;
      return session;
    },
  },

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        await connectToDatabase();
        const account = await AccountModel.findOne({ email }).lean();

        if (!account) return null;

        const valid = await bcrypt.compare(password, account.passwordHash);
        if (!valid) return null;

        return { id: account._id.toString(), email: account.email };
      },
    }),
  ],
});
