import type { Metadata } from "next";
import { Hero } from "@/components/talent-hunt/hero";
import { CohortRegisterOnboardingFlow } from "@/components/talent-hunt/onboarding-flow";
import { ProgramAtAGlance } from "@/components/talent-hunt/program-at-a-glance";
import { WhatYouWillBuild } from "@/components/talent-hunt/what-you-will-build";
import { WhoThisIsFor } from "@/components/talent-hunt/who-this-is-for";

export const metadata: Metadata = {
  title: "AI Cohort Training Program for Working Professionals | ABTalks",
  description:
    "A 30-day intensive AI cohort for USA-based working professionals. 4 core modules, 4 live projects, 1-on-1 mentorship. 50 seats. Apply now.",
};

export default function AICohortRegisterPage() {
  return (
    <CohortRegisterOnboardingFlow>
      <Hero compact />
      <ProgramAtAGlance compact />
      <WhatYouWillBuild compact />
      <WhoThisIsFor compact />
    </CohortRegisterOnboardingFlow>
  );
}
