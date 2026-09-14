import type { ReactNode } from "react";
import { OnboardingStoryFrame } from "@/components/recruiter-onboarding/onboarding-story";

// The four story screens (Define, Discover, Connect, Assess) share one frame
// that stays mounted across their routes, so the background can morph from one
// photo into the next instead of reloading. signin/signup sit outside the group.
export default function RecruiterOnboardingStoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <OnboardingStoryFrame>{children}</OnboardingStoryFrame>;
}
