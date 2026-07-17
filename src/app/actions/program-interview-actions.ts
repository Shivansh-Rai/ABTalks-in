"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  completeInterview,
  evaluateInterview,
  adminResetInterview,
} from "@/features/program/interview";
import {
  adminEvaluateInterviewSchema,
  adminResetInterviewSchema,
  completeInterviewSchema,
} from "@/lib/validations/program";

type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

async function requireProgramMemberId(): Promise<
  { ok: true; memberId: string } | { ok: false; message: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const cohort = await prisma.programCohort.findFirst({
    where: { status: { in: ["ENROLLING", "ACTIVE", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!cohort) return { ok: false, message: "Program unavailable." };

  const member = await prisma.programMember.findUnique({
    where: {
      userId_cohortId: { userId: session.user.id, cohortId: cohort.id },
    },
    select: { id: true, status: true },
  });
  if (!member || (member.status !== "ENROLLED" && member.status !== "COMPLETED")) {
    return { ok: false, message: "Enrollment required." };
  }
  return { ok: true, memberId: member.id };
}

export async function completeInterviewAction(
  input: unknown,
): Promise<ActionResult<{ evaluated: boolean }>> {
  const authResult = await requireProgramMemberId();
  if (!authResult.ok) return authResult;

  const parsed = completeInterviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid interview data." };

  const completed = await completeInterview(
    authResult.memberId,
    parsed.data.transcript,
    parsed.data.durationSec,
  );
  if (!completed.ok) return { ok: false, message: completed.message };

  const evaluated = await evaluateInterview(completed.interviewId);
  if (!evaluated.ok) {
    revalidatePath("/program/interview");
    revalidatePath("/program/dashboard");
    return {
      ok: true,
      data: { evaluated: false },
    };
  }

  revalidatePath("/program/interview");
  revalidatePath("/program/dashboard");
  return { ok: true, data: { evaluated: true } };
}

export async function adminEvaluateInterviewAction(
  input: unknown,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = adminEvaluateInterviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid interview." };

  const result = await evaluateInterview(parsed.data.interviewId);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/admin/program/interviews");
  revalidatePath("/program/interview");
  revalidatePath("/program/dashboard");
  return { ok: true };
}

export async function adminResetInterviewAction(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = adminResetInterviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input." };

  const result = await adminResetInterview(
    admin.userId,
    parsed.data.memberId,
    parsed.data.reason,
  );
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/admin/program/interviews");
  revalidatePath("/program/interview");
  revalidatePath("/program/dashboard");
  return { ok: true };
}
