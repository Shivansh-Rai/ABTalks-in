import type { Metadata } from "next";
import { DefineRoleScreen } from "@/components/recruiter-onboarding/define-role-screen";

export const metadata: Metadata = {
  title: "Define the role | Hire with ABTalks",
  description:
    "Set the role, skills and requirements that matter. ABTalks turns your brief into a focused hiring journey.",
};

// Public, pre-signup recruiter onboarding. Deliberately NOT under /hire: that
// layout wraps every page in HireChrome, and the middleware's `/hire` prefix
// check would put anything named /hire-* behind a session.
export default function RecruiterOnboardingPage() {
  return <DefineRoleScreen />;
}
