import type { Metadata } from "next";
import { AssessScreen } from "@/components/recruiter-onboarding/assess-screen";

export const metadata: Metadata = {
  title: "Create assessments | Hire with ABTalks",
  description:
    "Build custom assessments, test the right skills and get deeper insights so you hire with confidence.",
};

// Public, step 4 (final) of the pre-signup recruiter onboarding (see ../page.tsx).
export default function RecruiterOnboardingAssessPage() {
  return <AssessScreen />;
}
