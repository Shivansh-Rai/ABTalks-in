"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  AccountOpsError,
  disableAccount,
  restoreAccount,
  secureAccount,
} from "@/features/admin/account-ops";
import { logger } from "@/lib/logger";

type ActionResult = { ok: true } | { ok: false; message: string };

const accountOpsSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().trim().min(8).max(500),
});

function revalidateAccountViews(targetUserId: string) {
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${targetUserId}`);
  revalidatePath("/admin/recruiters");
  revalidatePath("/admin/actions");
}

async function runAccountOp(
  input: unknown,
  fn: (args: {
    targetUserId: string;
    actorUserId: string;
    reason: string;
  }) => Promise<void>,
  label: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = accountOpsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a reason of at least 8 characters.",
    };
  }

  try {
    await fn({
      targetUserId: parsed.data.targetUserId,
      actorUserId: admin.userId,
      reason: parsed.data.reason,
    });
    revalidateAccountViews(parsed.data.targetUserId);
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountOpsError) {
      return { ok: false, message: error.message };
    }
    logger.error(`[admin] ${label}`, { error: String(error) });
    return { ok: false, message: "Could not update this account." };
  }
}

export async function disableAccountAction(
  input: unknown,
): Promise<ActionResult> {
  return runAccountOp(input, disableAccount, "disableAccountAction");
}

export async function restoreAccountAction(
  input: unknown,
): Promise<ActionResult> {
  return runAccountOp(input, restoreAccount, "restoreAccountAction");
}

export async function secureAccountAction(
  input: unknown,
): Promise<ActionResult> {
  return runAccountOp(input, secureAccount, "secureAccountAction");
}
