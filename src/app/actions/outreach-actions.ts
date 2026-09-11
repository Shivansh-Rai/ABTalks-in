"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logger, safeErrorMessage } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  sendOutreachSchema,
  threadReplySchema,
} from "@/lib/validations/hire-outreach";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { resolveEligibleCandidates } from "@/features/hire/pool-policy";
import {
  sendCandidateReply,
  sendRecruiterMessage,
  type OutreachSendOutcome,
} from "@/features/hire/outreach";

/**
 * Outreach, from the browser (T-232, plan 130).
 *
 * Three doors, each with its own gate and the same rules: Zod first, the
 * caller from the session, the OUTREACH rate limit, and nothing identifying
 * a recipient accepted from the payload. The recruiter's name, company and
 * organization, and the candidate's user id and address, are all resolved on
 * the server.
 */

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

const SEND_FAILED = "Could not send the message. Try again.";

/** Recruiter messages a candidate from the desk. Starts the thread if needed. */
export async function sendOutreachAction(
  input: unknown,
): Promise<ActionResult<OutreachSendOutcome>> {
  const parsed = sendOutreachSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? SEND_FAILED };
  }

  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return workspace;
  const { userId, organizationId, company } = workspace.data;

  const limited = await assertRateLimit({ bucket: "OUTREACH", subjectId: userId });
  if (!limited.ok) return limited;

  try {
    // A ref is a name, not a capability: re-checked against the pool, which
    // also refuses the fabricated SAMPLE: preview cards.
    const [candidate] = await resolveEligibleCandidates([parsed.data.candidateRef]);
    if (!candidate) {
      return { ok: false, message: "This candidate is no longer available." };
    }

    const result = await sendRecruiterMessage({
      recruiterUserId: userId,
      organizationId,
      candidateUserId: candidate.userId,
      subject: parsed.data.subject || null,
      body: parsed.data.body,
      clientRequestId: parsed.data.clientRequestId,
      recruiterName: await recruiterName(userId),
      company,
    });

    if (result.ok) revalidatePath("/hire/messages");
    return result;
  } catch (error) {
    logger.error("[outreach] sendOutreachAction", { error: safeErrorMessage(error) });
    return { ok: false, message: SEND_FAILED };
  }
}

/** Recruiter continues a conversation they own. */
export async function recruiterReplyAction(
  input: unknown,
): Promise<ActionResult<OutreachSendOutcome>> {
  const parsed = threadReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? SEND_FAILED };
  }

  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return workspace;
  const { userId, organizationId, company } = workspace.data;

  const limited = await assertRateLimit({ bucket: "OUTREACH", subjectId: userId });
  if (!limited.ok) return limited;

  try {
    // Scoped to this recruiter: another recruiter's thread id is not found.
    const thread = await prisma.outreachThread.findFirst({
      where: { id: parsed.data.threadId, recruiterUserId: userId },
      select: { candidateUserId: true },
    });
    if (!thread) return { ok: false, message: "Conversation not found." };

    const result = await sendRecruiterMessage({
      recruiterUserId: userId,
      organizationId,
      candidateUserId: thread.candidateUserId,
      subject: null,
      body: parsed.data.body,
      clientRequestId: parsed.data.clientRequestId,
      recruiterName: await recruiterName(userId),
      company,
    });

    if (result.ok) {
      revalidatePath("/hire/messages");
      revalidatePath(`/hire/messages/${parsed.data.threadId}`);
    }
    return result;
  } catch (error) {
    logger.error("[outreach] recruiterReplyAction", { error: safeErrorMessage(error) });
    return { ok: false, message: SEND_FAILED };
  }
}

/** Candidate replies on ABTalks. The reply reaches the thread's recruiter only. */
export async function candidateReplyAction(
  input: unknown,
): Promise<ActionResult<{ threadId: string; messageId: string; duplicate: boolean }>> {
  const parsed = threadReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? SEND_FAILED };
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Sign in to reply." };

  const limited = await assertRateLimit({ bucket: "OUTREACH", subjectId: userId });
  if (!limited.ok) return limited;

  try {
    const result = await sendCandidateReply({
      candidateUserId: userId,
      threadId: parsed.data.threadId,
      body: parsed.data.body,
      clientRequestId: parsed.data.clientRequestId,
    });

    if (result.ok) {
      revalidatePath("/messages");
      revalidatePath(`/messages/${parsed.data.threadId}`);
    }
    return result;
  } catch (error) {
    logger.error("[outreach] candidateReplyAction", { error: safeErrorMessage(error) });
    return { ok: false, message: SEND_FAILED };
  }
}

async function recruiterName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, recruiterProfile: { select: { fullName: true } } },
  });
  return user?.recruiterProfile?.fullName || user?.name || "A recruiter";
}
