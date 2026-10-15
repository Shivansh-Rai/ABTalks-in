import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth, signIn } from "@/auth";
import { logger } from "@/lib/logger";
import { isCandidateRegistered } from "@/features/registration/registration-gate";
import { getRecruiterState } from "@/features/talent-pool/recruiter-registration";
import {
  hasPreviewAccess,
  isLaunchOnePagerEnabled,
  previewToken,
  PREVIEW_COOKIE_NAMES,
  type PreviewSide,
} from "@/lib/feature-flags";

/**
 * Plan 193, TEMPORARY — where a preview link lands.
 *
 * `middleware.ts` validates `?preview=<token>`, sets the httpOnly cookie for
 * that side and sends the browser here. This route reads the cookie — never
 * the URL, which no longer carries the token — and signs in as that side's
 * preview account, so the visitor arrives inside the product rather than at a
 * login form they have no way of passing.
 *
 * Public by necessity and harmless without a cookie: a stranger gets `/`.
 */
export const dynamic = "force-dynamic";

const HOME: Record<PreviewSide, string> = {
  candidate: "/dashboard",
  recruiter: "/hire",
};

export async function GET(request: Request) {
  const home = new URL("/", request.url);
  if (!isLaunchOnePagerEnabled()) {
    return NextResponse.redirect(home);
  }

  const jar = await cookies();
  // Candidate wins when a browser holds both: /dashboard is the more common
  // destination, and the other side is one link away in the same browser.
  const side: PreviewSide | null = hasPreviewAccess(
    "candidate",
    jar.get(PREVIEW_COOKIE_NAMES.candidate)?.value,
  )
    ? "candidate"
    : hasPreviewAccess(
          "recruiter",
          jar.get(PREVIEW_COOKIE_NAMES.recruiter)?.value,
        )
      ? "recruiter"
      : null;

  if (!side) return NextResponse.redirect(home);

  const destination = new URL(HOME[side], request.url);

  // An existing session is kept ONLY when it can actually use this side.
  //
  // It used to be kept unconditionally, to avoid demoting an admin into the
  // preview account. The result was the opposite of helpful: an admin — or
  // anyone signed in as the other side's preview account — opened the
  // candidate link, was forwarded to /dashboard holding an account with no
  // CandidateProfile, and landed on /register. A link whose whole job is "show
  // me the product" must not end at a signup form.
  //
  // So the question asked here is not "is somebody signed in" but "can this
  // session open the door this link opens". A registered candidate keeps their
  // own account on the candidate link, a recruiter keeps theirs on the
  // recruiter link, and anyone else is signed in as that side's preview
  // account, which is what the link promised.
  const session = await auth();
  if (session?.user?.id) {
    const canUseSide =
      side === "candidate"
        ? await isCandidateRegistered(session.user.id)
        : (await getRecruiterState(session.user.id)).status === "active";

    if (canUseSide) {
      return NextResponse.redirect(destination);
    }

    // Replacing a session is worth a line in the log: an admin who does this
    // is signed out of their own account and signs back in at /login, which
    // their preview cookie keeps reachable.
    logger.info("[preview] replacing a session that cannot use this side", {
      side,
      userId: session.user.id,
    });
  }

  const token = previewToken(side);
  if (!token) return NextResponse.redirect(home);

  // Throws the redirect that carries the session cookie.
  await signIn("preview", { side, token, redirectTo: HOME[side] });

  // Not reached — signIn redirects. Here so the handler always returns.
  return NextResponse.redirect(destination);
}
