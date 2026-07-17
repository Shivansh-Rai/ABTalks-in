import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

const REF_COOKIE_NAME = "abtalks_ref";
const REF_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

const { auth } = NextAuth(authConfig);

const protectedPaths = [
  "/dashboard",
  "/challenge",
  "/profile",
  "/quiz",
  "/register",
  "/admin",
  "/jobs",
  "/mission",
  "/program/apply",
  "/program/assessment",
  "/program/dashboard",
  "/program/day",
  "/program/curriculum",
  "/program/videos",
  "/program/leaderboard",
  "/program/interview",
  "/talent",
];

function applyRefCookie(response: NextResponse, ref: string | null) {
  if (!ref || ref.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(ref)) {
    return response;
  }

  response.cookies.set(REF_COOKIE_NAME, ref, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REF_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const ref = req.nextUrl.searchParams.get("ref");

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = pathname === "/login";

  if (isProtected && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("from", pathname);
    return applyRefCookie(NextResponse.redirect(url), ref);
  }

  if (isAuthPage && isLoggedIn) {
    return applyRefCookie(
      NextResponse.redirect(new URL("/dashboard", req.nextUrl)),
      ref,
    );
  }

  return applyRefCookie(NextResponse.next(), ref);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
