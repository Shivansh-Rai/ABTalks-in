import type { Metadata } from "next";
import { Hero } from "@/components/talent-hunt/hero";
import { CohortRegisterOnboardingFlow } from "@/components/talent-hunt/onboarding-flow";
import { ProgramAtAGlance } from "@/components/talent-hunt/program-at-a-glance";
import { WhatYouWillBuild } from "@/components/talent-hunt/what-you-will-build";
import { WhoThisIsFor } from "@/components/talent-hunt/who-this-is-for";
import { COHORT_INDIA_ONBOARDING_KEY } from "@/components/talent-hunt/constants";

export const metadata: Metadata = {
  title: "AI Cohort Training Program (India) for Working Professionals | Klymb AI",
  description:
    "A 30-day intensive AI cohort for India-based working professionals. 4 core modules, 4 live projects, 1-on-1 mentorship. 50 seats. Apply now.",
};

export default function AICohortIndiaPage() {
  return (
    <CohortRegisterOnboardingFlow
      basePath="/ai-cohort-india"
      storageKey={COHORT_INDIA_ONBOARDING_KEY}
    >
      <Hero compact country="India" />
      <ProgramAtAGlance compact country="India" />
      <WhatYouWillBuild compact />
      <WhoThisIsFor compact country="India" />
    </CohortRegisterOnboardingFlow>
  );
}
