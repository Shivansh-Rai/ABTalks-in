import type { Metadata } from "next";
import { ApplicationForm } from "@/components/talent-hunt/application-form";
import { ApplyGate } from "@/components/talent-hunt/apply-gate";

export const metadata: Metadata = {
  title: "Apply | AI Cohort Training Program | ABTalks",
  description:
    "Complete your application for the AI Cohort Training Program - a 30-day intensive AI cohort for USA-based working professionals.",
};

export default function AICohortRegisterApplyPage() {
  return (
    <ApplyGate>
      <div className="min-h-svh bg-background px-4 py-8 md:py-12">
        <ApplicationForm />
      </div>
    </ApplyGate>
  );
}
