import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth, signIn } from "@/auth";
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

  // An existing session is never overwritten. An admin who opens a preview
  // link keeps their own account instead of being silently demoted into the
  // preview one; they already pass the gate on both sides anyway.
  const session = await auth();
  if (session?.user?.id) {
    return NextResponse.redirect(destination);
  }

  const token = previewToken(side);
  if (!token) return NextResponse.redirect(home);

  // Throws the redirect that carries the session cookie.
  await signIn("preview", { side, token, redirectTo: HOME[side] });

  // Not reached — signIn redirects. Here so the handler always returns.
  return NextResponse.redirect(destination);
}
