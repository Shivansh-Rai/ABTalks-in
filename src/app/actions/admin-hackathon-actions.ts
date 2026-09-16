"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { removeParticipant } from "@/features/hackathon/remove-participant";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { sendMemberRemovedEmail } from "@/lib/hackathon-email";
import { logger } from "@/lib/logger";
import {
  disqualifyTeamSchema,
  removeTeamMemberSchema,
  resetTeamSubmissionSchema,
  type RemoveTeamMemberInput,
} from "@/lib/validations/hackathon";

const problemStatementSchema = z.string().max(5000);

export async function updateHackathonProblemStatementAction(input: {
  problemStatement: string;
}) {
  const admin = await requireAdmin();
  const parsed = problemStatementSchema.safeParse(input.problemStatement);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const problemStatement =
    parsed.data.trim().length === 0 ? null : parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.hackathonEvent.upsert({
        where: { id: 1 },
        create: { id: 1, problemStatement },
        update: { problemStatement },
      });
      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          actorUserId: admin.userId,
          targetUserId: admin.userId,
          actionType: "UPDATE_HACKATHON_PROBLEM",
          metadata: {
            problemStatementLength: problemStatement?.length ?? 0,
          },
        },
      });
    });

    revalidatePath("/hackathon/dashboard");
    revalidatePath("/admin/hackathon");

    return { ok: true as const, data: { problemStatement } };
  } catch {
    return {
      ok: false as const,
      message: "Failed to update problem statement.",
    };
  }
}

export async function adminRemoveHackathonTeamMemberAction(
  input: RemoveTeamMemberInput,
) {
  const admin = await requireAdmin();

  const parsed = removeTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const participant = await prisma.hackathonParticipant.findFirst({
    where: { id: parsed.data.participantId, eventId: HACKATHON.eventId },
    select: { teamId: true },
  });
  if (!participant) {
    return { ok: false as const, message: "Participant not found." };
  }

  const result = await removeParticipant({
    participantId: parsed.data.participantId,
    teamId: participant.teamId,
    removedByUserId: admin.userId,
    removedByRole: "ADMIN",
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    return { ok: false as const, message: result.message };
  }

  try {
    await sendMemberRemovedEmail(
      result.data.fullName,
      result.data.email,
      result.data.teamName,
    );
  } catch (error) {
    logger.error("hackathon removal emails failed", { error });
  }

  revalidatePath("/admin/hackathon");
  revalidatePath("/hackathon/dashboard");
  revalidatePath("/admin/hackathon-links");

  return {
    ok: true as const,
    data: { fullName: result.data.fullName },
  };
}

/**
 * T-276 — disqualify (hard-delete) a hackathon team.
 *
 * Cascades to participants and submission via the existing schema
 * relations. Writes an AdminAction row FIRST so the audit survives
 * even if the delete transaction fails halfway. Admin-only.
 */
export async function disqualifyHackathonTeamAction(input: unknown) {
  const admin = await requireAdmin();
  const parsed = disqualifyTeamSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const team = await prisma.hackathonTeam.findUnique({
    where: { id: parsed.data.teamId },
    select: { id: true, teamName: true, teamCode: true },
  });
  if (!team) {
    return { ok: false as const, message: "Team not found." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          actorUserId: admin.userId,
          targetUserId: admin.userId,
          actionType: "DISQUALIFY_HACKATHON_TEAM",
          metadata: {
            teamId: team.id,
            teamName: team.teamName,
            teamCode: team.teamCode,
            reason: parsed.data.reason ?? null,
          },
        },
      });
      await tx.hackathonTeam.delete({ where: { id: team.id } });
    });

    revalidatePath("/admin/hackathon");
    revalidatePath("/hackathon/dashboard");

    return {
      ok: true as const,
      data: { teamId: team.id, teamCode: team.teamCode },
    };
  } catch (error) {
    logger.error("hackathon team disqualification failed", {
      teamId: team.id,
      error: String(error),
    });
    return {
      ok: false as const,
      message: "Failed to disqualify team.",
    };
  }
}

/**
 * T-276 — reset a team's hackathon submission so they can submit again.
 *
 * Deletes the team's HackathonSubmission row (unique per teamId).
 * The team stays intact — this is the "let them fix a broken repo
 * link and re-submit" ops action. Audit-logged first.
 */
export async function resetHackathonTeamSubmissionAction(input: unknown) {
  const admin = await requireAdmin();
  const parsed = resetTeamSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const submission = await prisma.hackathonSubmission.findUnique({
    where: { teamId: parsed.data.teamId },
    select: { id: true, teamId: true },
  });
  if (!submission) {
    return {
      ok: false as const,
      message: "That team has not submitted yet — nothing to reset.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          actorUserId: admin.userId,
          targetUserId: admin.userId,
          actionType: "RESET_HACKATHON_SUBMISSION",
          metadata: {
            teamId: submission.teamId,
            submissionId: submission.id,
            reason: parsed.data.reason ?? null,
          },
        },
      });
      await tx.hackathonSubmission.delete({ where: { id: submission.id } });
    });

    revalidatePath("/admin/hackathon");
    revalidatePath("/hackathon/dashboard");

    return {
      ok: true as const,
      data: { teamId: submission.teamId },
    };
  } catch (error) {
    logger.error("hackathon submission reset failed", {
      teamId: submission.teamId,
      error: String(error),
    });
    return {
      ok: false as const,
      message: "Failed to reset submission.",
    };
  }
}
