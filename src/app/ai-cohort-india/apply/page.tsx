import type { Metadata } from "next";
import { ApplicationFormIndia } from "@/components/talent-hunt/application-form-india";
import { ApplyGate } from "@/components/talent-hunt/apply-gate";
import { COHORT_INDIA_ONBOARDING_KEY } from "@/components/talent-hunt/constants";

export const metadata: Metadata = {
  title: "Apply | AI Cohort Training Program (India) | Klymb AI",
  description:
    "Complete your application for the AI Cohort Training Program - a 30-day intensive AI cohort for India-based working professionals.",
};

export default function AICohortIndiaApplyPage() {
  return (
    <ApplyGate
      basePath="/ai-cohort-india"
      storageKey={COHORT_INDIA_ONBOARDING_KEY}
    >
      <div className="min-h-svh bg-background px-4 py-8 md:py-12">
        <ApplicationFormIndia />
      </div>
    </ApplyGate>
  );
}
