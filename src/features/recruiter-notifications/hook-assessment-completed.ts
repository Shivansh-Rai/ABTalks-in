import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notifyAssessmentCompleted } from "./notify-recruiter";

/**
 * T-249 #3 hook — fires when a candidate finishes an assessment.
 *
 * Called from the action layer (`submitAssessmentAttemptAction`) after
 * `submitAttempt` returns success, so it never runs on a race-lost
 * submit and never runs when the attempt was rejected as
 * INCOMPLETE / NOT_OPEN.
 *
 * The service layer stays pure — this helper does the small extra
 * lookup for the recruiter and the candidate name; the aggregator
 * fires the notification.
 *
 * Fail-open: any failure logs and returns. The candidate's submit
 * already succeeded upstream and must not fail because a notification
 * did.
 */
export async function fireAssessmentCompletedNotification(input: {
  assignmentId: string;
  candidateUserId: string;
}): Promise<void> {
  try {
    const assignment = await prisma.recruiterAssessmentAssignment.findUnique({
      where: { id: input.assignmentId },
      select: {
        candidateUserId: true,
        assessment: {
          select: {
            id: true,
            createdByUserId: true,
          },
        },
      },
    });

    if (!assignment) {
      logger.warn("recruiter-notifications.assessment_lookup_missing", {
        assignmentId: input.assignmentId,
      });
      return;
    }

    // The assessment's `createdByUserId` is the recruiter who built and
    // published it — that is who should be told when a candidate finishes.
    const recruiterUserId = assignment.assessment.createdByUserId;
    const assessmentId = assignment.assessment.id;

    // Look up the candidate name outside the primary read so the flow
    // still fires with the "A candidate" fallback if the User row is
    // gone or the name is empty.
    let candidateLabel = "A candidate";
    try {
      const candidate = await prisma.user.findUnique({
        where: { id: assignment.candidateUserId },
        select: { name: true },
      });
      const name = candidate?.name?.trim();
      if (name) candidateLabel = name;
    } catch {
      // fall through with the default label
    }

    await notifyAssessmentCompleted({
      recruiterUserId,
      assignmentId: input.assignmentId,
      candidateLabel,
      assessmentId,
    });
  } catch (err) {
    logger.warn("recruiter-notifications.assessment_hook_failed", {
      assignmentId: input.assignmentId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
