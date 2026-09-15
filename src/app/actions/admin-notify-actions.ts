"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import {
  notifyApplicationStatusChanged,
  notifySystemNotice,
} from "@/features/recruiter-notifications/notify-recruiter";

/**
 * T-249 admin surfaces for the two events without a user-facing emit
 * site: pipeline-action nudges and system notices.
 *
 * Both are guarded by `requireAdmin()`. The recruiter is looked up by
 * userId (system.notice) or by the job's `recruiterId`
 * (application.status_changed nudge). No client-supplied recruiter
 * identity is trusted.
 */

type ActionOk<T = undefined> = T extends undefined
  ? { ok: true }
  : { ok: true; data: T };
type ActionErr = { ok: false; message: string; status?: number };

const systemNoticeSchema = z.object({
  recruiterUserId: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  href: z.string().max(500).optional(),
});

/**
 * T-249 #5 — an admin broadcasts a workspace-specific notice to one
 * recruiter, delivered in-app and by email (per T-248 preferences).
 * Use case: "your outreach is failing because your custom domain has a
 * DNS issue", "your subscription expires in 3 days", etc.
 */
export async function broadcastRecruiterSystemNoticeAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  // requireAdmin throws a Next redirect if the caller is not an admin —
  // no ok/false envelope to unwrap. On the happy path it returns the
  // admin session details.
  const admin = await requireAdmin();

  const parsed = systemNoticeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
      status: 400,
    };
  }

  // Verify the target is actually a recruiter — the notification would
  // be delivered to any User row otherwise, and the label copy assumes
  // recruiter context.
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: parsed.data.recruiterUserId },
    select: { id: true },
  });
  if (!recruiter) {
    return {
      ok: false,
      message: "That user is not a recruiter.",
      status: 404,
    };
  }

  await notifySystemNotice({
    recipientUserId: parsed.data.recruiterUserId,
    title: parsed.data.title,
    body: parsed.data.body,
    href: parsed.data.href,
  });

  logger.info("admin-notify.system_notice_sent", {
    adminUserId: admin.userId,
    recruiterUserId: parsed.data.recruiterUserId,
    title: parsed.data.title,
  });

  return { ok: true };
}

const pipelineNudgeSchema = z.object({
  applicationId: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

/**
 * T-249 #4 — the "pipeline action" event. An admin nudges the
 * recruiter that owns a specific JobApplication that the pipeline row
 * needs their attention. Fires `application.status_changed` against
 * the application's owning recruiter. Idempotent by the T-248 default
 * dedupe.
 *
 * There is no user-facing scheduler firing this yet — the emit site is
 * admin-callable for now, which is enough for the Demo 2 scope. A
 * later ticket can add a cron that fires this automatically for
 * candidates stuck at a stage for N days.
 */
export async function sendRecruiterPipelineNudgeAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  const admin = await requireAdmin();

  const parsed = pipelineNudgeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
      status: 400,
    };
  }

  const application = await prisma.jobApplication.findUnique({
    where: { id: parsed.data.applicationId },
    select: {
      id: true,
      status: true,
      userId: true,
      job: { select: { id: true, recruiterId: true } },
      user: { select: { name: true } },
    },
  });

  if (!application) {
    return { ok: false, message: "Application not found.", status: 404 };
  }
  if (!application.job.recruiterId) {
    return {
      ok: false,
      message: "This application belongs to an admin-posted job — no recruiter to nudge.",
      status: 400,
    };
  }

  const candidateLabel = application.user?.name?.trim() || "Candidate";

  await notifyApplicationStatusChanged({
    recruiterUserId: application.job.recruiterId,
    applicationId: application.id,
    candidateLabel,
    status: application.status,
    jobId: application.job.id,
  });

  logger.info("admin-notify.pipeline_nudge_sent", {
    adminUserId: admin.userId,
    applicationId: application.id,
    recruiterUserId: application.job.recruiterId,
  });

  return { ok: true };
}
