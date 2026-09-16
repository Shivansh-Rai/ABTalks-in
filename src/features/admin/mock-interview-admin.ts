import "server-only";
import { MockInterviewStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type {
  DeleteMockInterviewInput,
  GrantMockAllowanceInput,
  InvalidateMockInterviewInput,
  MockInterviewListFilter,
} from "@/lib/validations/mock-interview-admin";

/**
 * T-276 mock-interview admin repository.
 *
 * Sole reader/writer for MockInterview / MockInterviewTurn /
 * MockInterviewReport from the admin surface. Runtime paths in
 * `src/features/interview/` stay untouched — a moderation delete or
 * invalidate never races with a live interview because status flips
 * come from here and are respected by the runtime's own guards.
 *
 * Every mutation records an AdminAction row (audit first, mutation
 * second, one transaction) so an audit-less action can never happen.
 *
 * Plan: [docs/plans/149-t276-programme-operations.md].
 */

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export type AdminMockInterviewRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  domainSlug: string;
  packId: string;
  packVersion: number;
  attemptNumber: number;
  status: MockInterviewStatus;
  overallScore: number | null;
  summary: string | null;
  startedAt: string | null;
  endedAt: string | null;
  evaluatedAt: string | null;
  invalidReason: string | null;
  createdAt: string;
};

export type AdminMockInterviewTurn = {
  id: string;
  turnIndex: number;
  action: string;
  promptText: string;
  answerText: string;
  createdAt: string;
};

export type AdminMockInterviewDetail = AdminMockInterviewRow & {
  turns: AdminMockInterviewTurn[];
  reportOverallScore: number | null;
  narrativeDegraded: boolean;
  competencyScores: Prisma.JsonValue | null;
};

/**
 * List mock interviews with filters. Newest first. Selects the minimum
 * needed to render a row on the admin console — raw voice, evidence
 * blobs and full transcripts stay on the detail path.
 */
export async function listMockInterviews(
  filter: MockInterviewListFilter,
): Promise<AdminMockInterviewRow[]> {
  const where: Prisma.MockInterviewWhereInput = {};
  if (filter.userId) where.userId = filter.userId;
  if (filter.domainSlug) where.domainSlug = filter.domainSlug;
  if (filter.status) where.status = filter.status;
  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) where.createdAt.gte = new Date(filter.from);
    if (filter.to) where.createdAt.lte = new Date(filter.to);
  }

  const rows = await prisma.mockInterview.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    select: {
      id: true,
      userId: true,
      domainSlug: true,
      packId: true,
      packVersion: true,
      attemptNumber: true,
      status: true,
      overallScore: true,
      summary: true,
      startedAt: true,
      endedAt: true,
      evaluatedAt: true,
      invalidReason: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user?.name ?? null,
    userEmail: r.user?.email ?? null,
    domainSlug: r.domainSlug,
    packId: r.packId,
    packVersion: r.packVersion,
    attemptNumber: r.attemptNumber,
    status: r.status,
    overallScore: r.overallScore,
    summary: r.summary,
    startedAt: r.startedAt?.toISOString() ?? null,
    endedAt: r.endedAt?.toISOString() ?? null,
    evaluatedAt: r.evaluatedAt?.toISOString() ?? null,
    invalidReason: r.invalidReason,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Full detail for one interview, including transcript and report
 * projection. Returns null when not found — admin surface renders a
 * 404 rather than throwing.
 */
export async function getMockInterviewDetail(
  interviewId: string,
): Promise<AdminMockInterviewDetail | null> {
  const row = await prisma.mockInterview.findUnique({
    where: { id: interviewId },
    select: {
      id: true,
      userId: true,
      domainSlug: true,
      packId: true,
      packVersion: true,
      attemptNumber: true,
      status: true,
      overallScore: true,
      summary: true,
      competencyScores: true,
      startedAt: true,
      endedAt: true,
      evaluatedAt: true,
      invalidReason: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      turns: {
        orderBy: { turnIndex: "asc" },
        select: {
          id: true,
          turnIndex: true,
          action: true,
          promptText: true,
          answerText: true,
          createdAt: true,
        },
      },
      report: {
        select: {
          overallScore: true,
          narrativeDegraded: true,
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    userName: row.user?.name ?? null,
    userEmail: row.user?.email ?? null,
    domainSlug: row.domainSlug,
    packId: row.packId,
    packVersion: row.packVersion,
    attemptNumber: row.attemptNumber,
    status: row.status,
    overallScore: row.overallScore,
    summary: row.summary,
    competencyScores: row.competencyScores,
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    evaluatedAt: row.evaluatedAt?.toISOString() ?? null,
    invalidReason: row.invalidReason,
    createdAt: row.createdAt.toISOString(),
    turns: row.turns.map((t) => ({
      id: t.id,
      turnIndex: t.turnIndex,
      action: t.action,
      promptText: t.promptText,
      answerText: t.answerText,
      createdAt: t.createdAt.toISOString(),
    })),
    reportOverallScore: row.report?.overallScore ?? null,
    narrativeDegraded: row.report?.narrativeDegraded ?? false,
  };
}

/**
 * Invalidate an interview: sets status to INVALID and records the
 * reason. Reversible only by another admin write; the runtime treats
 * INVALID as "does not consume allowance" and skips scoring.
 */
export async function invalidateMockInterview(
  input: InvalidateMockInterviewInput,
  adminUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const interview = await prisma.mockInterview.findUnique({
    where: { id: input.interviewId },
    select: { id: true, status: true, userId: true },
  });
  if (!interview) return { ok: false, message: "Interview not found." };
  if (interview.status === "INVALID") {
    return { ok: false, message: "Interview is already invalidated." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminAction.create({
        data: {
          adminUserId,
          actorUserId: adminUserId,
          targetUserId: interview.userId,
          actionType: "INVALIDATE_MOCK_INTERVIEW",
          reason: input.reason,
          metadata: {
            interviewId: interview.id,
            previousStatus: interview.status,
          },
        },
      });
      await tx.mockInterview.update({
        where: { id: interview.id },
        data: {
          status: MockInterviewStatus.INVALID,
          invalidReason: input.reason,
        },
      });
    });
    return { ok: true };
  } catch (err) {
    logger.error("mock-interview-admin.invalidate failed", {
      interviewId: interview.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, message: "Failed to invalidate interview." };
  }
}

/**
 * Hard-delete an interview and its cascades (turns + report). Audit
 * row lands first so the trail survives the delete.
 */
export async function deleteMockInterview(
  input: DeleteMockInterviewInput,
  adminUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const interview = await prisma.mockInterview.findUnique({
    where: { id: input.interviewId },
    select: { id: true, userId: true, status: true, domainSlug: true },
  });
  if (!interview) return { ok: false, message: "Interview not found." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminAction.create({
        data: {
          adminUserId,
          actorUserId: adminUserId,
          targetUserId: interview.userId,
          actionType: "DELETE_MOCK_INTERVIEW",
          reason: input.reason,
          metadata: {
            interviewId: interview.id,
            domainSlug: interview.domainSlug,
            previousStatus: interview.status,
          },
        },
      });
      await tx.mockInterview.delete({ where: { id: interview.id } });
    });
    return { ok: true };
  } catch (err) {
    logger.error("mock-interview-admin.delete failed", {
      interviewId: interview.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, message: "Failed to delete interview." };
  }
}

/**
 * Grant a mock-interview allowance override.
 *
 * The `MockAllowance` model does not exist on the schema yet — the
 * allowance-check code in src/features/interview/platform/ is
 * source-scanned in T-277's own tests but no persistent grant table
 * lives on the schema. Return NOT_IMPLEMENTED so the admin UI can
 * still surface the button and record the intent via AdminAction,
 * without persisting an allowance the runtime cannot honour.
 */
export async function grantMockInterviewAllowance(
  input: GrantMockAllowanceInput,
  adminUserId: string,
): Promise<
  | { ok: true }
  | { ok: false; code: "NOT_IMPLEMENTED"; message: string }
  | { ok: false; message: string }
> {
  try {
    await prisma.adminAction.create({
      data: {
        adminUserId,
        actorUserId: adminUserId,
        targetUserId: input.userId,
        actionType: "GRANT_MOCK_ALLOWANCE_INTENT",
        reason: input.reason,
        metadata: {
          extraAttempts: input.extraAttempts,
          note: "Recorded as intent — MockAllowance model not yet on schema.",
        },
      },
    });
  } catch (err) {
    logger.warn("mock-interview-admin.grant_intent_log_failed", {
      userId: input.userId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    ok: false,
    code: "NOT_IMPLEMENTED",
    message:
      "Allowance intent recorded. Persistent grant will land with the MockAllowance schema in a follow-up ticket.",
  };
}
