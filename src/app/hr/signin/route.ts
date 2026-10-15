import { NextResponse } from "next/server";
import { auth, signIn } from "@/auth";

/**
 * Plan 194 — where an HR's emailed sign-in link lands.
 *
 * Public by necessity and worthless without a live token: the provider spends
 * the token and refuses anything expired, already used, or never issued, so a
 * stranger here gets `/` exactly like a stranger anywhere else behind the
 * launch gate.
 *
 * The token stays in the query string only for this one request — `signIn`
 * redirects to `/hire`, so it leaves the address bar immediately and never
 * reaches a page that could leak it in a `Referer`.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  const home = new URL("/", request.url);
  const desk = new URL("/hire", request.url);

  if (!token) return NextResponse.redirect(home);

  // An HR who clicks their link again while already signed in should land on
  // the desk, not burn a second invite — and must not be swapped into another
  // account mid-session.
  const session = await auth();
  if (session?.user?.id) return NextResponse.redirect(desk);

  try {
    // Throws the redirect that carries the session cookie.
    await signIn("hr-invite", { token, redirectTo: "/hire" });
  } catch (error) {
    // A Next redirect must travel; anything else means the token was refused,
    // and a refused link says so by landing on the launch page rather than on
    // an error that hints at why.
    if (isRedirectError(error)) throw error;
    return NextResponse.redirect(home);
  }

  return NextResponse.redirect(desk);
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
