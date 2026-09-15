import "server-only";
import { PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureRecruiterWorkspace } from "@/features/hire/provision-recruiter";
import { addToPipeline } from "@/repositories/talent-pipeline";

/**
 * T-247 applicant → pipeline convergence.
 *
 * When a candidate applies to a recruiter-posted job, the same person
 * lands on that recruiter's `/hire/pipeline` board at `SOURCED`. Same
 * row, same board, same nine stages as the Scout-sourced candidates
 * T-240 already put there — "one hub, not two inboxes".
 *
 * Fire-and-forget from the applicant's request: the applicant's own
 * flow already succeeded upstream, so a broken pipeline write must
 * never throw back at them. Every failure path is a `warn` log and a
 * silent return. If the recruiter's board is broken today it stays
 * broken until the recruiter fixes it — the candidate does not learn.
 *
 * Idempotent by T-240 contract (`@@unique([talentListId,
 * candidateUserId])` on `TalentListItem` + `addToPipeline` recovering
 * the P2002 race), so a candidate withdrawing and re-applying stays as
 * a single row on the board, and the stage the recruiter last had them
 * at is preserved — a re-apply never demotes the recruiter's decision.
 *
 * Plan: [docs/plans/147-t247-applicant-pipeline-convergence.md].
 */
export async function convergeApplicantToPipeline({
  applicationId,
}: {
  applicationId: string;
}): Promise<void> {
  let application;
  try {
    application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        job: { select: { id: true, recruiterId: true } },
        user: { select: { name: true } },
      },
    });
  } catch (err) {
    logger.warn("pipeline-convergence.lookup failed", {
      applicationId,
      err: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!application) {
    // A race: the application was deleted between create and this call.
    // Nothing to converge; the row is not there to attach to a board.
    logger.warn("pipeline-convergence.application_missing", { applicationId });
    return;
  }

  const recruiterUserId = application.job.recruiterId;
  if (!recruiterUserId) {
    // Admin-posted jobs have no recruiter to attach to. The T-246
    // candidate tracker still shows the application on the candidate's
    // side; nothing lands on any recruiter's board because no recruiter
    // owns it. Deliberate; not a warning.
    logger.info("pipeline-convergence.admin_job_skipped", {
      applicationId,
      jobId: application.job.id,
    });
    return;
  }

  let workspace;
  try {
    workspace = await ensureRecruiterWorkspace(recruiterUserId);
  } catch (err) {
    logger.warn("pipeline-convergence.workspace_resolve_failed", {
      applicationId,
      recruiterUserId,
      err: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!workspace) {
    // The recruiter account is gone or was never a recruiter. Rare, but
    // possible if the recruiter was demoted between posting and the
    // applicant clicking Apply.
    logger.warn("pipeline-convergence.recruiter_not_found", {
      applicationId,
      recruiterUserId,
    });
    return;
  }

  const label = application.user?.name?.trim() || "Candidate";

  const result = await addToPipeline(
    {
      userId: recruiterUserId,
      recruiterProfileId: workspace.recruiterProfileId,
      organizationId: workspace.organizationId,
    },
    {
      candidateUserId: application.userId,
      label,
      stage: PipelineStage.SOURCED,
    },
  );

  if (!result.ok) {
    logger.warn("pipeline-convergence.add_failed", {
      applicationId,
      recruiterUserId,
      candidateUserId: application.userId,
      message: result.message,
    });
  }
}
