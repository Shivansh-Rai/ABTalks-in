import { redirect } from "next/navigation";

// The four story screens (Define, Discover, Connect, Assess) became the
// onboarding wizard's welcome and its supporting visual. Old links land there.
export default function RecruiterOnboardingStoryRedirect() {
  redirect("/recruiter-onboarding");
}
