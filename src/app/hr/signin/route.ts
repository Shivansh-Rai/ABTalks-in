import { NextResponse } from "next/server";
import { auth, signIn } from "@/auth";
import { logger } from "@/lib/logger";
import { peekHrInviteEmail } from "@/features/hire/hr-invite";

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

  // An existing session is kept ONLY when it is already this link's recipient.
  //
  // It used to be kept whenever there was one at all — the same mistake
  // /preview/enter made, fixed there in #798 and missed here. The effect was
  // that clicking an HR link in a browser signed in as somebody else (the
  // preview candidate, typically) skipped the sign-in, forwarded to /hire,
  // bounced off the gate and ended on /dashboard: the invited recruiter never
  // got their own account, and the link looked broken.
  //
  // So the question is who the browser is, not whether it is anybody. The
  // token is peeked rather than spent to ask it, so a link clicked by its own
  // recipient twice is not burned the second time.
  const session = await auth();
  if (session?.user?.id) {
    const invited = await peekHrInviteEmail(token);
    if (invited && session.user.email?.toLowerCase() === invited) {
      return NextResponse.redirect(desk);
    }
    // Anyone else: the link is a credential for ONE named person, so it wins
    // over whatever session happens to be in this browser.
    logger.info("[hr-invite] replacing another account's session", {
      userId: session.user.id,
    });
  }

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
