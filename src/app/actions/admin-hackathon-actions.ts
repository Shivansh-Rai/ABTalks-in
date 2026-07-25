"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

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
