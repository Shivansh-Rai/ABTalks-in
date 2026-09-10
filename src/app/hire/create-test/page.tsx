import type { Metadata } from "next";
import { requireRecruiter } from "@/lib/program-auth";
import { getShortlist } from "@/features/talent-pool/pool";
import { encodeCandidateRef } from "@/features/hire/candidate-ref";
import { AssessmentBuilder } from "@/components/hire/assessment/assessment-builder";

export const metadata: Metadata = {
  title: "Create an assessment | ABTalks Hire",
};

export default async function CreateTestPage() {
  const { userId } = await requireRecruiter();
  const list = await getShortlist(userId);
  const refs = list.ok
    ? list.data.map((r) => encodeCandidateRef("PROGRAM", r.memberId))
    : [];
  return (
    <AssessmentBuilder
      shortlistCount={refs.length}
      shortlistRefs={refs}
      existingDraft={null}
    />
  );
}
