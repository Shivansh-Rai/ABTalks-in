import type { Metadata } from "next";
import { requireRecruiter } from "@/lib/program-auth";
import { listSendableCandidates } from "@/features/recruiter-assessments/service";
import { prismaAssessmentStore } from "@/features/recruiter-assessments/prisma-store";
import { AssessmentBuilder } from "@/components/hire/assessment/assessment-builder";

export const metadata: Metadata = {
  title: "Create an assessment | ABTalks Hire",
};
// Create sends up to MAX_ASSIGN_PER_CALL notifications inline; the server
// action runs under this page's function limit.
export const maxDuration = 60;

export default async function CreateTestPage() {
  const { userId } = await requireRecruiter();
  // The same live Shortlist the assign panel uses — legacy and project halves,
  // searchable candidates only. Refs and labels only; no user id is sent down.
  const candidates = await listSendableCandidates(prismaAssessmentStore(), userId);
  return <AssessmentBuilder candidates={candidates} existingDraft={null} />;
}
