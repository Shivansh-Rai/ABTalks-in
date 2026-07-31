"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { removeParticipant } from "@/features/hackathon/remove-participant";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { sendMemberRemovedEmail } from "@/lib/hackathon-email";
import { logger } from "@/lib/logger";
import {
  removeTeamMemberSchema,
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

  const participant = await prisma.hackathonParticipant.findUnique({
    where: { id: parsed.data.participantId },
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
