import type { Metadata } from "next";
import Link from "next/link";
import { requireRecruiter } from "@/lib/program-auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import {
  buildContentFromPresets,
  listAssessmentPresets,
} from "@/features/recruiter-assessments/presets";
import {
  getAssessment,
  listSendableCandidates,
  type AssessmentRow,
} from "@/features/recruiter-assessments/service";
import { prismaAssessmentStore } from "@/features/recruiter-assessments/prisma-store";
import { MAX_PARAGRAPH_WORDS } from "@/lib/validations/assessment";
import { AssessmentBuilder } from "@/components/hire/assessment/assessment-builder";
import { AssessmentPresetPicker } from "@/components/hire/assessment/preset-picker";
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
    cameraRequired: row.cameraRequired,
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

function BuilderView({
  candidates,
  existingDraft,
  presetLocked,
  showBack,
  projectId,
}: {
  candidates: Awaited<ReturnType<typeof listSendableCandidates>>;
  existingDraft: AssessmentDraft | null;
  presetLocked: boolean;
  showBack: boolean;
  projectId: string | null;
}) {
  return (
    <>
      {showBack ? (
        <Link
          href={
            projectId
              ? `/hire/create-test?projectId=${encodeURIComponent(projectId)}`
              : "/hire/create-test"
          }
          className="hire-assess-presets__back"
        >
          ← Templates
        </Link>
      ) : null}
      <AssessmentBuilder
        candidates={candidates}
        existingDraft={existingDraft}
        presetLocked={presetLocked}
        projectId={projectId}
      />
    </>
  );
}

export default async function CreateTestPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    preset?: string;
    presets?: string;
    from?: string;
    projectId?: string;
  }>;
}) {
  const { userId } = await requireRecruiter();
  const { id, preset, presets, from, projectId: projectIdParam } = await searchParams;

  // Plan 133 D-4: the Shortlist the recruiter is actually looking at. Coming
  // from a project's pod, that project's shortlisted candidates and nobody
  // else; opened bare, the legacy saved list — the same two cases the header's
  // `scopePodRows` has. Ownership is enforced in the query, so a project id
  // belonging to someone else yields an empty pool rather than their people.
  //
  // Refs and labels only; no user id is sent down.
  const projectId = projectIdParam?.trim() || null;
  const candidates = await listSendableCandidates(prismaAssessmentStore(), userId, {
    projectId,
  });
  const refs = candidates.map((c) => c.candidateRef);

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
          <BuilderView
            candidates={candidates}
            existingDraft={rowToDraft(found.data)}
            presetLocked={false}
            showBack={false}
            projectId={projectId}
          />
        );
      }
    }
    // Fall through to a blank builder if the draft isn't found / not owned.
    return (
      <BuilderView
        candidates={candidates}
        existingDraft={null}
        presetLocked={false}
        showBack={false}
        projectId={projectId}
      />
    );
  }

  // 2) Customize from one or many templates (`?presets=a,b,c` or `?preset=a`).
  const presetIds = (presets ?? preset ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const content = presetIds.length ? buildContentFromPresets(presetIds) : null;
  if (content) {
    return (
      <BuilderView
        candidates={candidates}
        existingDraft={{ ...content, shortlistRefs: refs }}
        presetLocked
        showBack
        projectId={projectId}
      />
    );
  }

  // 3) Blank builder — Start from scratch.
  if (from === "scratch") {
    return (
      <BuilderView
        candidates={candidates}
        existingDraft={null}
        presetLocked={false}
        showBack
        projectId={projectId}
      />
    );
  }

  // 4) Landing — templates first, then the blank builder underneath.
  const presetSummaries = listAssessmentPresets().map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    tags: p.tags,
    questionCount: p.content.questions.length,
    durationMinutes: p.content.durationMinutes,
  }));

  return (
    <div className="hire-assess">
      <div className="hire-assess__top">
        <div>
          <p className="hire-assess__kicker">Assessment builder</p>
          <h1>Create an assessment</h1>
          <p className="hire-assess__sub">
            For {candidates.length} shortlisted candidate
            {candidates.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <AssessmentPresetPicker
        presets={presetSummaries}
        candidates={candidates}
        projectId={projectId}
      />
      <AssessmentBuilder
        candidates={candidates}
        existingDraft={null}
        presetLocked={false}
        projectId={projectId}
        embedded
      />
    </div>
  );
}
