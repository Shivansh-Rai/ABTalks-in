import type { Metadata } from "next";
import { requireRecruiter } from "@/lib/program-auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { buildContentFromPresets } from "@/features/recruiter-assessments/presets";
import {
  getAssessment,
  listSendableCandidates,
  type AssessmentRow,
} from "@/features/recruiter-assessments/service";
import { prismaAssessmentStore } from "@/features/recruiter-assessments/prisma-store";
import { MAX_PARAGRAPH_WORDS } from "@/lib/validations/assessment";
import { AssessmentBuilder } from "@/components/hire/assessment/assessment-builder";
import type { AssessmentDraft } from "@/components/hire/assessment/assessment-types";

export const metadata: Metadata = {
  title: "Create an assessment | ABTalks Hire",
};
// Create sends up to MAX_ASSIGN_PER_CALL notifications inline; the server
// action runs under this page's function limit.
export const maxDuration = 60;

/**
 * Map a stored assessment into the builder's draft shape. Questions are mapped
 * explicitly per type — no extra keys — so the strict per-question schema
 * accepts the payload on save. `assessmentId` is set, so Save updates in place.
 */
function rowToDraft(row: AssessmentRow): AssessmentDraft {
  return {
    assessmentId: row.id,
    title: row.title,
    subheading: row.subheading,
    instructions: row.instructions,
    durationMinutes: row.durationMinutes,
    passMarkPercent: row.passMarkPercent,
    shortlistRefs: row.shortlistRefs,
    questions: row.questions.map((q) => {
      if (q.type === "MULTIPLE_CHOICE") {
        return {
          type: "MULTIPLE_CHOICE" as const,
          title: q.title,
          helpText: q.helpText,
          isRequired: q.isRequired,
          points: q.points,
          allowMultipleCorrect: q.allowMultipleCorrect,
          options: q.options.map((o) => ({
            body: o.body,
            isCorrect: o.isCorrect,
          })),
        };
      }
      if (q.type === "PARAGRAPH") {
        return {
          type: "PARAGRAPH" as const,
          title: q.title,
          helpText: q.helpText,
          isRequired: q.isRequired,
          points: q.points,
          maxWords: q.maxWords ?? MAX_PARAGRAPH_WORDS,
        };
      }
      return {
        type: "FILE_UPLOAD" as const,
        title: q.title,
        helpText: q.helpText,
        isRequired: q.isRequired,
        points: q.points,
        uploadDestinationUrl: q.uploadDestinationUrl ?? "",
      };
    }),
  };
}

export default async function CreateTestPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; preset?: string; presets?: string }>;
}) {
  const { userId } = await requireRecruiter();
  // The same live Shortlist the assign panel uses — legacy and project halves,
  // searchable candidates only. Refs and labels only; no user id is sent down.
  const candidates = await listSendableCandidates(prismaAssessmentStore(), userId);
  const refs = candidates.map((c) => c.candidateRef);

  const { id, preset, presets } = await searchParams;

  // 1) Editing an existing draft — load it (editable, not locked).
  if (id) {
    const workspace = await requireRecruiterWorkspace();
    if (workspace.ok) {
      const found = await getAssessment(
        prismaAssessmentStore(),
        {
          organizationId: workspace.data.organizationId,
          createdByUserId: workspace.data.userId,
        },
        id,
      );
      if (found.ok) {
        return (
          <AssessmentBuilder
            candidates={candidates}
            existingDraft={rowToDraft(found.data)}
            presetLocked={false}
          />
        );
      }
    }
    // Fall through to a blank builder if the draft isn't found / not owned.
  }

  // 2) Customize from one or many templates (`?presets=a,b,c` or `?preset=a`).
  const presetIds = (presets ?? preset ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const content = presetIds.length ? buildContentFromPresets(presetIds) : null;

  return (
    <AssessmentBuilder
      candidates={candidates}
      existingDraft={content ? { ...content, shortlistRefs: refs } : null}
      presetLocked={Boolean(content)}
    />
  );
}
