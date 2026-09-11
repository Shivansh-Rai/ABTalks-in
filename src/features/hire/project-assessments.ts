import "server-only";

import { prisma } from "@/lib/db";

/**
 * Assessments filed under a project (plan 133, D-2 / D-3).
 *
 * The assessment system (T-243/T-244) is not modified. Filing lives in its own
 * table, `TalentProjectAssessment`; an assessment with no row there is
 * "Unassigned", which is what every assessment was before this existed, so
 * nothing is lost, rewritten or silently assigned.
 *
 * Scope: an assessment is the recruiter's own when they created it
 * (`createdByUserId`); a project is theirs when `recruiterUserId` matches.
 * Both are checked on every read and write, so another recruiter's ids are
 * not found.
 *
 * Integration point left for the assessment owner: after `createAssessment`
 * in the create-test flow, call `linkProjectAssessment` with the project the
 * recruiter came from. Until then, recruiters attach an existing assessment to
 * a project from the project sidebar.
 */

export type ProjectAssessmentRow = {
  id: string;
  title: string;
  status: string;
};

const ROW_SELECT = { id: true, title: true, status: true } as const;

/** Assessments filed under this project, if the recruiter owns it. */
export async function listProjectAssessments(
  recruiterUserId: string,
  requestId: string,
): Promise<ProjectAssessmentRow[]> {
  return prisma.recruiterAssessment.findMany({
    where: {
      createdByUserId: recruiterUserId,
      archivedAt: null,
      projectLink: { requestId, request: { recruiterUserId } },
    },
    orderBy: { updatedAt: "desc" },
    select: ROW_SELECT,
  });
}

/** The recruiter's assessments that belong to no project. */
export async function listUnassignedAssessments(
  recruiterUserId: string,
): Promise<ProjectAssessmentRow[]> {
  return prisma.recruiterAssessment.findMany({
    where: { createdByUserId: recruiterUserId, archivedAt: null, projectLink: null },
    orderBy: { updatedAt: "desc" },
    select: ROW_SELECT,
  });
}

type LinkResult = { ok: true } | { ok: false; message: string };

/**
 * File an assessment under a project. Re-filing moves it (one project each).
 * Both ids must belong to the caller; either one belonging to someone else
 * reads as not found.
 */
export async function linkProjectAssessment(input: {
  recruiterUserId: string;
  requestId: string;
  assessmentId: string;
}): Promise<LinkResult> {
  const [project, assessment] = await Promise.all([
    prisma.talentRequest.findFirst({
      where: { id: input.requestId, recruiterUserId: input.recruiterUserId },
      select: { id: true },
    }),
    prisma.recruiterAssessment.findFirst({
      where: { id: input.assessmentId, createdByUserId: input.recruiterUserId },
      select: { id: true },
    }),
  ]);
  if (!project) return { ok: false, message: "Project not found." };
  if (!assessment) return { ok: false, message: "Assessment not found." };

  await prisma.talentProjectAssessment.upsert({
    where: { assessmentId: assessment.id },
    create: {
      requestId: project.id,
      assessmentId: assessment.id,
      linkedByUserId: input.recruiterUserId,
    },
    update: { requestId: project.id, linkedByUserId: input.recruiterUserId },
    select: { id: true },
  });
  return { ok: true };
}

/** Return an assessment to Unassigned. The assessment itself is untouched. */
export async function unlinkProjectAssessment(input: {
  recruiterUserId: string;
  assessmentId: string;
}): Promise<LinkResult> {
  const removed = await prisma.talentProjectAssessment.deleteMany({
    where: {
      assessmentId: input.assessmentId,
      assessment: { createdByUserId: input.recruiterUserId },
      request: { recruiterUserId: input.recruiterUserId },
    },
  });
  return removed.count > 0 ? { ok: true } : { ok: false, message: "Assessment not found." };
}
