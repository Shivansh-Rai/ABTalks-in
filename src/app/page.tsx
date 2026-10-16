import Script from "next/script";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLandingState } from "@/features/landing/get-landing-state";
import type { LandingUser } from "@/features/landing/get-landing-state";
import { getRecruiterState } from "@/features/talent-pool/recruiter-registration";
import { isCandidateRegistered } from "@/features/registration/registration-gate";
import {
  hasPreviewAccess,
  isClaudeEnabled,
  isDatabricksEnabled,
  isLaunchOnePagerEnabled,
  PREVIEW_COOKIE_NAMES,
} from "@/lib/feature-flags";
import { LandingPage } from "@/components/landing/site/landing-page";
import { LaunchOnePager } from "@/components/landing/launch/launch-one-pager";

const GOOGLE_ADS_ID = "AW-18456978326";

/**
 * Unchanged by plan 191 and rendered by both home pages — the campaigns
 * pointing at `/` keep reporting conversions while the one-pager is up.
 */
function GoogleAdsScripts() {
  return (
    <>
      <Script
        id="google-ads-gtag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script id="google-ads-config" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_ID}');
gtag('event', 'conversion', {'send_to': '${GOOGLE_ADS_ID}/NG4TCOnlroMdEJbH_OBE'});
function gtag_report_conversion(url) {
  var callback = function () {
    if (typeof(url) != 'undefined') {
      window.location = url;
    }
  };
  gtag('event', 'conversion', {
      'send_to': '${GOOGLE_ADS_ID}/NG4TCOnlroMdEJbH_OBE',
      'event_callback': callback
  });
  return false;
}`}
      </Script>
    </>
  );
}

export default async function HomePage() {
  const session = await auth();
  // Plans 191 + 192, temporary: the launch one-pager stands in for the
  // marketing landing and the whole platform is closed behind it.
  const onePager = isLaunchOnePagerEnabled();
  const isAdmin =
    session?.user?.isAdmin === true ||
    (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  if (onePager) {
    // Who gets past the launch page: an admin, or a browser holding the
    // candidate preview cookie. Everyone else stays on it — signed in or not,
    // registered or not. Sending a registered candidate to /dashboard here
    // would bounce them straight back (middleware gates /dashboard), so the
    // old redirect must not fire for them.
    const jar = await cookies();
    const mayEnter =
      isAdmin ||
      hasPreviewAccess(
        "candidate",
        jar.get(PREVIEW_COOKIE_NAMES.candidate)?.value,
      );
    // The candidate door is open to everyone again: people who already have
    // an account can sign in and carry on with the track they were doing.
    // Only a browser holding the RECRUITER preview link — and no candidate
    // one — is pointed at /talent/login instead, since that is the door its
    // cookie opens.
    const hasRecruiterPreview = hasPreviewAccess(
      "recruiter",
      jar.get(PREVIEW_COOKIE_NAMES.recruiter)?.value,
    );
    const signInHref =
      !mayEnter && hasRecruiterPreview ? "/talent/login" : "/login";

    if (session?.user?.id && mayEnter) {
      // Asked for explicitly: an admin lands on the product, not the console.
      // /admin is still one URL away. An admin with no CandidateProfile is
      // passed on to /register by the dashboard's own gate, which is open to
      // them.
      if (isAdmin || (await isCandidateRegistered(session.user.id))) {
        redirect("/dashboard");
      }
    }

    const user: LandingUser | null = session?.user?.id
      ? {
          name: session.user.name ?? null,
          email: session.user.email ?? "",
          image: session.user.image ?? null,
          isAdmin: session.user.isAdmin ?? false,
        }
      : null;

    return (
      <>
        <GoogleAdsScripts />
        <LaunchOnePager user={user} signInHref={signInHref} />
      </>
    );
  }

  if (session?.user?.id) {
    if (isAdmin) {
      redirect("/admin");
    }

    // RecruiterProfile is the current database-backed recruiter authority.
    // Checking it here keeps a stale JWT role from sending the wrong account
    // to its home surface.
    const recruiter = await getRecruiterState(session.user.id);
    redirect(recruiter.status === "none" ? "/dashboard" : "/hire");
  }

  const state = await getLandingState();
  return (
    <>
      <GoogleAdsScripts />
      <LandingPage
        claudeEnabled={isClaudeEnabled()}
        databricksEnabled={isDatabricksEnabled()}
        state={state}
      />
    </>
  );
}
