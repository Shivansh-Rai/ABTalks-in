"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { getSubmissionWindow } from "@/features/hackathon/submission-window";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  hackathonSubmissionSchema,
  type HackathonSubmissionInput,
} from "@/lib/validations/hackathon";

export async function saveHackathonSubmissionAction(
  input: HackathonSubmissionInput,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, message: "Not authenticated" };
  }

  const parsed = hackathonSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const window = getSubmissionWindow();
  if (!window.unlocked) {
    return {
      ok: false as const,
      message: `Submissions open at kickoff — ${HACKATHON.kickoffLabel}.`,
    };
  }
  if (window.closed) {
    return {
      ok: false as const,
      message: `Submissions closed on ${HACKATHON.deadlineLabel}.`,
    };
  }

  const participant = await prisma.hackathonParticipant.findUnique({
    where: { userId: session.user.id },
    select: { teamId: true },
  });
  if (!participant) {
    return {
      ok: false as const,
      message: "You're not registered for the hackathon.",
    };
  }

  const problem = await prisma.hackathonProblem.findUnique({
    where: { id: parsed.data.problemId },
    select: { id: true },
  });
  if (!problem) {
    return {
      ok: false as const,
      message: "That brief is no longer available. Reload the page.",
    };
  }

  try {
    const saved = await prisma.hackathonSubmission.upsert({
      where: { teamId: participant.teamId },
      create: {
        teamId: participant.teamId,
        problemId: parsed.data.problemId,
        repoUrl: parsed.data.repoUrl,
        liveUrl: parsed.data.liveUrl,
        aiLogUrl: parsed.data.aiLogUrl,
      },
      update: {
        problemId: parsed.data.problemId,
        repoUrl: parsed.data.repoUrl,
        liveUrl: parsed.data.liveUrl,
        aiLogUrl: parsed.data.aiLogUrl,
      },
      select: {
        problemId: true,
        updatedAt: true,
      },
    });

    revalidatePath("/hackathon/submission");
    revalidatePath("/hackathon/dashboard");

    return {
      ok: true as const,
      data: {
        problemId: saved.problemId,
        updatedAtIso: saved.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    logger.error("hackathon submission save failed", { error });
    return {
      ok: false as const,
      message: "Couldn't save your submission. Try again.",
    };
  }
}
