import Script from "next/script";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLandingState } from "@/features/landing/get-landing-state";
import type { LandingUser } from "@/features/landing/get-landing-state";
import { getRecruiterState } from "@/features/talent-pool/recruiter-registration";
import { isCandidateRegistered } from "@/features/registration/registration-gate";
import {
  isClaudeEnabled,
  isDatabricksEnabled,
  isLaunchOnePagerEnabled,
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
  // Plan 191, temporary: the launch one-pager stands in for the marketing
  // landing, and the recruiter product is hidden.
  const onePager = isLaunchOnePagerEnabled();

  if (session?.user?.id) {
    if (session.user.isAdmin || (session.user as { role?: string }).role === "ADMIN") {
      redirect("/admin");
    }

    if (onePager) {
      // A registered candidate still goes to their dashboard, exactly as
      // before. What must NOT happen here is the /hire redirect below:
      // middleware sends /hire back to / while the one-pager is on, so a
      // recruiter account would bounce between the two forever. They see the
      // one-pager with their account menu instead.
      if (await isCandidateRegistered(session.user.id)) {
        redirect("/dashboard");
      }
    } else {
      // RecruiterProfile is the current database-backed recruiter authority.
      // Checking it here keeps a stale JWT role from sending the wrong account
      // to its home surface.
      const recruiter = await getRecruiterState(session.user.id);
      redirect(recruiter.status === "none" ? "/dashboard" : "/hire");
    }
  }

  if (onePager) {
    const user: LandingUser | null = session?.user?.id
      ? {
          name: session.user.name ?? null,
          email: session.user.email ?? "",
          image: session.user.image ?? null,
          isAdmin: session.user.isAdmin ?? false,
        }
      : null;
    // Signed out, /register bounces through the candidate door anyway, so the
    // CTA says so up front. Signed in and unregistered — the only signed-in
    // case that reaches here besides a recruiter — goes straight to it.
    const getStartedHref = user ? "/register" : "/login?from=%2Fregister";

    return (
      <>
        <GoogleAdsScripts />
        <LaunchOnePager
          user={user}
          getStartedHref={getStartedHref}
          // /claude-signup redirects to / unless the challenge is open, so the
          // hero CTA only points there once it is.
          claudeHref={isClaudeEnabled() ? "/claude-signup" : getStartedHref}
        />
      </>
    );
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
