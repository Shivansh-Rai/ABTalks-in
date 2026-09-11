import type { Metadata } from "next";
import { DiscoverScreen } from "@/components/recruiter-onboarding/discover-screen";

export const metadata: Metadata = {
  title: "Discover candidates | Hire with ABTalks",
  description:
    "Explore relevant candidates, understand their strengths and build your shortlist without the endless scrolling.",
};

// Public, step 2 of the pre-signup recruiter onboarding (see ../page.tsx).
export default function RecruiterOnboardingDiscoverPage() {
  return <DiscoverScreen />;
}
