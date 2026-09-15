import "server-only";
import { dispatch } from "@/features/notification/notification-service";
import { logger } from "@/lib/logger";

/**
 * T-249 recruiter notifications — the four recruiter-facing event
 * emitters, aggregated in one file.
 *
 * The whole point of this module is that every wording, every href and
 * every log key lives here, once. A rename ripples once. A screening
 * of a stray `dispatch()` call is a source-scan grep because the shape
 * test refuses any file outside this aggregator that calls `dispatch`
 * with one of the four T-249 event types.
 *
 * Every wrapper is fire-and-forget from the caller's perspective:
 *
 * - `dispatch()` is wrapped in try/catch. On any failure the wrapper
 *   logs and returns; the caller's own action (apply, submit, status
 *   move, admin broadcast) already succeeded upstream and must not
 *   fail because the notification did.
 * - The wrappers never throw. Enforced by the shape test.
 *
 * The fifth event on the sheet — candidate reply (`outreach.reply_received`)
 * — is already fired end-to-end from `src/features/hire/outreach.ts` and
 * lives on its own path; it is not part of this aggregator.
 *
 * Plan: [docs/plans/148-t249-recruiter-notifications.md].
 */

async function fire(event: {
  eventType: string;
  recipientUserId: string;
  primaryEntityId: string;
  title: string;
  body?: string;
  href?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}): Promise<void> {
  try {
    const result = await dispatch(event);
    if (!result.ok) {
      logger.warn("recruiter-notifications.dispatch_refused", {
        eventType: event.eventType,
        recipientUserId: event.recipientUserId,
        primaryEntityId: event.primaryEntityId,
        message: result.message,
      });
    }
  } catch (err) {
    logger.warn("recruiter-notifications.dispatch_threw", {
      eventType: event.eventType,
      recipientUserId: event.recipientUserId,
      primaryEntityId: event.primaryEntityId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * T-249 #1 — A candidate applied to a job the recruiter posted.
 *
 * Fires immediately after T-247's `convergeApplicantToPipeline`
 * finishes the pipeline write. The href points at the pipeline board
 * because that is now the one hub for both sourced and applied
 * candidates.
 */
export async function notifyApplicationReceived(input: {
  recruiterUserId: string;
  applicationId: string;
  candidateLabel: string;
}): Promise<void> {
  await fire({
    eventType: "application.received",
    recipientUserId: input.recruiterUserId,
    primaryEntityId: input.applicationId,
    title: `New application: ${input.candidateLabel}`,
    body: `${input.candidateLabel} applied to one of your jobs. They are in your pipeline at Sourced.`,
    href: "/hire/pipeline",
  });
}

/**
 * T-249 #3 — A candidate finished an assessment the recruiter had
 * assigned. Fires from `submitAttempt` after the store's submit call
 * succeeds. The href points at the recruiter's assessment view for
 * that assignment.
 */
export async function notifyAssessmentCompleted(input: {
  recruiterUserId: string;
  assignmentId: string;
  candidateLabel: string;
  assessmentId: string;
}): Promise<void> {
  await fire({
    eventType: "assessment.completed",
    recipientUserId: input.recruiterUserId,
    primaryEntityId: input.assignmentId,
    title: `Assessment completed: ${input.candidateLabel}`,
    body: `${input.candidateLabel} finished the assessment you assigned.`,
    href: `/hire/assessments/${input.assessmentId}`,
  });
}

/**
 * T-249 #4 — The "pipeline action" event: a JobApplication.status
 * transition landed and is written back to the recruiter's own
 * notification list as a first-class event. The dedupe key T-248 uses
 * by default (`{eventType}:{recipient}:{primaryEntity}`) makes a
 * same-status re-submit a no-op.
 */
export async function notifyApplicationStatusChanged(input: {
  recruiterUserId: string;
  applicationId: string;
  candidateLabel: string;
  status: string;
  jobId?: string;
}): Promise<void> {
  await fire({
    eventType: "application.status_changed",
    recipientUserId: input.recruiterUserId,
    primaryEntityId: input.applicationId,
    title: `Pipeline updated: ${input.candidateLabel}`,
    body: `Marked ${input.status.toLowerCase()} — review from your pipeline.`,
    href: input.jobId ? `/hire/jobs/${input.jobId}` : "/hire/pipeline",
  });
}

/**
 * T-249 #5 — Admin-initiated system notice targeted at one recruiter's
 * workspace. Emit site is `broadcastRecruiterSystemNoticeAction`,
 * guarded by `requireAdmin()`. Content is admin-authored, so the
 * wrapper accepts the title and body verbatim; only the eventType and
 * defaults are pinned.
 */
export async function notifySystemNotice(input: {
  recipientUserId: string;
  title: string;
  body?: string;
  href?: string;
  entityId?: string;
}): Promise<void> {
  await fire({
    eventType: "system.notice",
    recipientUserId: input.recipientUserId,
    // Admin broadcasts are one-shot events; keeping the entity id
    // distinct per call ensures repeat notices are not silently
    // deduped as the same issue.
    primaryEntityId: input.entityId ?? `system-notice-${Date.now()}`,
    title: input.title,
    body: input.body,
    href: input.href,
  });
}
