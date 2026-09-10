"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  assertApplyAllowed,
  CLOSED_JOB_MESSAGE,
} from "@/features/recruiter-jobs/service";
import { prismaJobStore } from "@/features/recruiter-jobs/prisma-store";

const applySchema = z.object({
  jobId: z.string().min(1),
  note: z.string().max(1000).optional().default(""),
});

export { CLOSED_JOB_MESSAGE };

export async function applyToJobAction(input: { jobId: string; note?: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, message: "Sign in to apply." };
  }

  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid input" };
  }

  const guard = await assertApplyAllowed(
    { jobs: prismaJobStore() },
    parsed.data.jobId,
  );
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  try {
    await prisma.jobApplication.create({
      data: {
        jobId: parsed.data.jobId,
        userId: session.user.id,
        note: parsed.data.note.trim() || null,
      },
    });

    return { ok: true as const };
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code: string }).code)
        : "";
    if (code === "P2002") {
      return {
        ok: false as const,
        message: "You've already applied to this role.",
      };
    }
    return { ok: false as const, message: "Application failed. Try again." };
  }
}
