"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Role, PointsSourceType } from "@prisma/client";
import { z } from "zod";
import { prisma, writeClient } from "@/lib/db";
import { hasPlatformAdmin, requireAdmin } from "@/lib/admin-auth";
import { getCurrentDayNumber } from "@/lib/date-utils";
import { computeStreakStats, daysCompletedFromCanonical, listCanonicalChallengeDays } from "@/features/submission/streak-utils";
import { sendChallengeResetEmail } from "@/features/email/challenge-reset-email";
import { studentProfile } from "@/repositories/legacy/student-profile";
import { applyCandidateIdentityChange } from "@/repositories/candidate-identity";
import { getCandidateProfile } from "@/repositories/candidate";
import {
  applyChallengeProgramEnrollmentById,
  applyEnrollmentProgressDenorm,
} from "@/repositories/enrollment-state";
import {
  applyDeleteChallengeSubmission,
  applyDeleteEnrollmentChallengeAttempts,
} from "@/repositories/progress-writes";
import {
  attemptIdForSubmission,
  enrollmentIdFromPe,
  peIdForEnrollment,
  submissionIdFromAttemptId,
} from "@/repositories/ids";
import {
  anonymizeUser,
  AnonymizeUserError,
} from "@/features/admin/anonymize-user";
import {
  applyPointsChange,
  lockWalletBalance,
  submissionAwardTotal,
  withLegacyPointsMirrorFlush,
} from "@/repositories/points";
import { randomUUID } from "node:crypto";

const baseInput = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

function revalidateAdminViews(targetUserId: string) {
  revalidatePath(`/admin/students/${targetUserId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/students");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/analytics");
  revalidatePath("/dashboard");
  revalidatePath(`/students/${targetUserId}`);
  revalidatePath("/challenge");
  revalidatePath("/quiz");
  revalidatePath("/register");
  revalidatePath("/marketplace");
  revalidatePath("/hackathon/dashboard");
}

export async function resetProgressAction(input: {
  targetUserId: string;
  reason?: string;
}) {
  const admin = await requireAdmin();
  const parsed = baseInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { targetUserId, reason } = parsed.data;

  let resetDomain: string | null = null;

  try {
    await withLegacyPointsMirrorFlush(() =>
      writeClient().$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { userId: targetUserId },
      });
      if (!enrollment) throw new Error("No enrollment");
      resetDomain = enrollment.domain;

      // Serialize reset against every balance writer before reading the ledger.
      await lockWalletBalance(tx, targetUserId);

      const attempts = await tx.activityAttempt.findMany({
        where: {
          enrollmentId: peIdForEnrollment(enrollment.id),
          id: { startsWith: "aa_sub_" },
        },
        select: { id: true },
      });
      const pointsToRemove = await submissionAwardTotal(tx, {
        submissionIds: attempts
          .map((row) => submissionIdFromAttemptId(row.id))
          .filter((id): id is string => Boolean(id)),
        enrollmentId: enrollment.id,
      });
      if (pointsToRemove > 0) {
        const applied = await applyPointsChange(tx, {
          userId: targetUserId,
          amount: -pointsToRemove,
          mode: "debit_clamp",
          sourceType: PointsSourceType.RECONCILIATION,
          sourceId: enrollment.id,
          idempotencyKey: `reset-progress:${enrollment.id}:${randomUUID()}`,
          reason:
            "Clamped synergy to 0 after reset removed submission points that were already spent.",
          createdByUserId: admin.userId,
        });
        if (!applied.ok) {
          throw new Error("Failed to adjust points for reset");
        }
      }

      await applyDeleteEnrollmentChallengeAttempts(tx, enrollment.id);

      await applyEnrollmentProgressDenorm(tx, {
        enrollmentId: enrollment.id,
        daysCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastSubmittedDay: null,
      });
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "ACTIVE",
          completedAt: null,
          startedAt: new Date(),
        },
      });
      await applyChallengeProgramEnrollmentById(tx, enrollment.id);

      await applyCandidateIdentityChange(tx, targetUserId, {
        isReadyForInterview: false,
      });

      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          actorUserId: admin.userId,
          targetUserId,
          actionType: "RESET_PROGRESS",
          reason,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 20000,
    }),
    );

    revalidateAdminViews(targetUserId);

    // Best-effort: notify the participant that their Claude challenge was reset.
    // Runs after the response and outside the transaction — a mail failure must
    // never fail the reset.
    if (resetDomain === "CLAUDE") {
      const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { email: true },
      });
      const identity = await getCandidateProfile(targetUserId);
      const to = target?.email;
      if (to) {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? "https://abtalks.in";
        const firstName =
          identity?.fullName?.trim().split(/\s+/)[0] || "there";
        after(async () => {
          await sendChallengeResetEmail({
            to,
            firstName,
            dashboardUrl: `${appUrl}/dashboard`,
          });
        });
      }
    }

    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to reset progress",
    };
  }
}

export async function toggleReadyForInterviewAction(input: {
  targetUserId: string;
  reason?: string;
}) {
  const admin = await requireAdmin();
  const parsed = baseInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { targetUserId, reason } = parsed.data;

  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: targetUserId },
      select: { isReadyForInterview: true },
    });
    if (!profile) throw new Error("Profile not found");

    const newValue = !profile.isReadyForInterview;

    await writeClient().$transaction(async (tx) => {
      await applyCandidateIdentityChange(tx, targetUserId, {
        isReadyForInterview: newValue,
      });

      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          actorUserId: admin.userId,
          targetUserId,
          actionType: "TOGGLE_READY_FOR_INTERVIEW",
          metadata: { newValue },
          reason,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    revalidateAdminViews(targetUserId);
    return { ok: true as const, newValue };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to toggle",
    };
  }
}

export async function removeFromChallengeAction(input: {
  targetUserId: string;
  reason?: string;
}) {
  const admin = await requireAdmin();
  const parsed = baseInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { targetUserId, reason } = parsed.data;

  try {
    await writeClient().$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { userId: targetUserId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!enrollment) throw new Error("No active enrollment");

      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "ABANDONED" },
      });
      await applyChallengeProgramEnrollmentById(tx, enrollment.id);

      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          actorUserId: admin.userId,
          targetUserId,
          actionType: "REMOVE_FROM_CHALLENGE",
          reason,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    revalidateAdminViews(targetUserId);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message:
        e instanceof Error ? e.message : "Failed to remove from challenge",
    };
  }
}

const deleteUserAccountInput = z.object({
  targetUserId: z.string().min(1),
  confirm: z.literal("delete"),
});

export async function deleteUserAccountAction(input: {
  targetUserId: string;
  confirm: string;
}) {
  const admin = await requireAdmin();
  const parsed = deleteUserAccountInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: 'Type "delete" to confirm account deletion',
    };
  }

  const { targetUserId } = parsed.data;

  if (targetUserId === admin.userId) {
    return {
      ok: false as const,
      message: "You cannot delete your own account",
    };
  }

  if (await hasPlatformAdmin(targetUserId)) {
    return {
      ok: false as const,
      message: "Cannot delete a platform admin account",
    };
  }

  try {
    await writeClient().$transaction(
      async (tx) => {
        await anonymizeUser(tx, {
          userId: targetUserId,
          adminUserId: admin.userId,
        });
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );

    revalidateAdminViews(targetUserId);
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AnonymizeUserError) {
      return { ok: false as const, message: e.message };
    }
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to delete user account",
    };
  }
}

export async function rejectSubmissionAction(input: {
  submissionId: string;
  reason?: string;
}) {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      submissionId: z.string().min(1),
      reason: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { submissionId, reason } = parsed.data;

  try {
    let targetUserId = "";

    await withLegacyPointsMirrorFlush(() =>
      writeClient().$transaction(async (tx) => {
      const attempt = await tx.activityAttempt.findUnique({
        where: { id: attemptIdForSubmission(submissionId) },
        select: {
          payload: true,
          enrollment: { select: { id: true, userId: true } },
          activity: { select: { dayNumber: true } },
        },
      });
      if (!attempt) throw new Error("Submission not found");
      const enrollmentId = enrollmentIdFromPe(attempt.enrollment.id);
      if (!enrollmentId) throw new Error("Submission not found");
      const enrollmentRow = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        select: {
          id: true,
          startedAt: true,
          challenge: { select: { startsAt: true } },
        },
      });
      if (!enrollmentRow) throw new Error("Submission not found");

      targetUserId = attempt.enrollment.userId;
      const payload =
        attempt.payload &&
        typeof attempt.payload === "object" &&
        !Array.isArray(attempt.payload)
          ? (attempt.payload as Record<string, unknown>)
          : {};
      const githubUrl =
        typeof payload.githubUrl === "string" ? payload.githubUrl : null;

      const pointsToRemove = await submissionAwardTotal(tx, {
        submissionIds: [submissionId],
      });
      if (pointsToRemove > 0) {
        const applied = await applyPointsChange(tx, {
          userId: attempt.enrollment.userId,
          amount: -pointsToRemove,
          mode: "debit_clamp",
          sourceType: PointsSourceType.RECONCILIATION,
          sourceId: submissionId,
          idempotencyKey: `reject-submission:${submissionId}`,
          reason:
            "Clamped synergy to 0 after reject removed submission points that were already spent.",
          createdByUserId: admin.userId,
        });
        if (!applied.ok) {
          throw new Error("Failed to adjust points for reject");
        }
      }

      await applyDeleteChallengeSubmission(tx, submissionId);

      const remainingRows = await listCanonicalChallengeDays(tx, enrollmentId);
      const { daysCompleted, lastSubmittedDay } =
        daysCompletedFromCanonical(remainingRows);

      const { currentStreak, longestStreak } = await computeStreakStats(tx, {
        enrollmentId,
        endDay: getCurrentDayNumber(enrollmentRow, enrollmentRow.challenge),
      });

      await applyEnrollmentProgressDenorm(tx, {
        enrollmentId,
        daysCompleted,
        currentStreak,
        longestStreak,
        lastSubmittedDay,
      });
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: daysCompleted >= 60 ? "COMPLETED" : "ACTIVE",
          completedAt: daysCompleted >= 60 ? new Date() : null,
        },
      });
      await applyChallengeProgramEnrollmentById(tx, enrollmentId);

      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          actorUserId: admin.userId,
          targetUserId,
          actionType: "REJECT_SUBMISSION",
          metadata: {
            submissionId,
            dayNumber: attempt.activity.dayNumber,
            githubUrl,
          },
          reason,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 20000,
    }),
    );

    revalidateAdminViews(targetUserId);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message:
        e instanceof Error ? e.message : "Failed to reject submission",
    };
  }
}

export async function grantSynergyAction(input: {
  targetUserId: string;
  points: number;
  reason?: string;
}) {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      targetUserId: z.string().min(1),
      points: z.coerce.number().int().min(1).max(4000),
      reason: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { targetUserId, points, reason } = parsed.data;

  try {
    await withLegacyPointsMirrorFlush(() =>
      writeClient().$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          email: true,
          role: true,
          studentProfile: { select: { id: true } },
          hackathonParticipants: { take: 1, select: { id: true } },
        },
      });
      const targetIsAdmin = await hasPlatformAdmin(targetUserId);
      if (
        !target ||
        target.role !== Role.STUDENT ||
        targetIsAdmin ||
        (!target.studentProfile && target.hackathonParticipants.length === 0)
      ) {
        throw new Error("Registered student not found");
      }

      const grantId = randomUUID();
      const applied = await applyPointsChange(tx, {
        userId: targetUserId,
        amount: points,
        mode: "credit",
        sourceType: PointsSourceType.ADMIN_GRANT,
        sourceId: grantId,
        idempotencyKey: `admin-grant:${grantId}`,
        reason,
        createdByUserId: admin.userId,
        legacyEvent: {
          type: "COMMUNITY_GRANT",
          createdByAdminId: admin.userId,
        },
      });
      if (!applied.ok) {
        throw new Error("Failed to grant synergy");
      }
      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          actorUserId: admin.userId,
          targetUserId,
          actionType: "GRANT_SYNERGY",
          metadata: { points },
          reason,
        },
      });
    }),
    );
    revalidateAdminViews(targetUserId);
    return { ok: true as const };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Registered student not found"
        ? error.message
        : "Grant failed";
    return {
      ok: false as const,
      message,
    };
  }
}
