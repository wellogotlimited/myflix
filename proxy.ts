import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Always allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Auth pages: redirect to profiles if already logged in
  if (pathname === "/login" || pathname === "/register") {
    if (session?.user?.accountId) {
      return NextResponse.redirect(new URL("/profiles", req.url));
    }
    return NextResponse.next();
  }

  // All other routes require a session
  if (!session?.user?.accountId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Profile selector & management: session required but no profile needed
  if (pathname.startsWith("/profiles")) {
    return NextResponse.next();
  }

  // API routes: let individual handlers do their own auth checks
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // All browsing pages require an active profile
  if (!session.user.profileId) {
    return NextResponse.redirect(new URL("/profiles", req.url));
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
