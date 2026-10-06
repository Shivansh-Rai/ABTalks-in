import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRecruiterState } from "@/features/talent-pool/recruiter-registration";
import { RecruiterAuthClosed } from "@/components/talent/recruiter-auth-closed";
import { RecruiterOnboardingWizard } from "@/components/recruiter-onboarding/recruiter-onboarding-wizard";
import { isEmailLoginEnabled, isRecruiterAuthEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Set up your recruiting workspace | Hire with ABTalks",
  description:
    "Create your ABTalks recruiter workspace in a few short steps: your details, your company and who you're hiring.",
};

/**
 * Public. The recruiter onboarding wizard — the same account rules as
 * /talent/register (it calls the same two actions), spread over short steps.
 *
 * Deliberately NOT under /hire: that layout wraps every page in HireChrome,
 * and the middleware's `/hire` prefix check would put anything named /hire-*
 * behind a session. Same guards as /recruiter-onboarding/signup.
 */
export default async function RecruiterOnboardingPage() {
  const session = await auth();
  if (session?.user?.id) {
    const state = await getRecruiterState(session.user.id);
    if (state.status === "active") redirect("/hire");
  }

  if (!isRecruiterAuthEnabled()) {
    return <RecruiterAuthClosed />;
  }

  // Plan 167. Signed in, but no RecruiterProfile yet — plan 160's deletions and
  // plan 159's admin-created accounts both leave people here. The session
  // already proves the address, so the wizard must not email them a code to
  // prove it again; it finishes through registerRecruiterAction instead.
  const sessionIdentity =
    session?.user?.id && session.user.email
      ? { email: session.user.email, name: session.user.name ?? "" }
      : null;

  return (
    <RecruiterOnboardingWizard
      passwordEnabled={isEmailLoginEnabled()}
      session={sessionIdentity}
    />
  );
}
