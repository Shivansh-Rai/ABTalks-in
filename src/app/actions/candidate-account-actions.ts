"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { writeClient } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  DeleteOwnAccountError,
  deleteOwnCandidateAccount,
} from "@/features/profile/delete-own-account";

type ActionResult = { ok: true } | { ok: false; message: string };

const schema = z.object({
  confirm: z.literal("DELETE"),
});

export async function deleteOwnAccountAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, message: "Please sign in." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Type "DELETE" to confirm.' };
  }

  try {
    await writeClient().$transaction(async (tx) => {
      await deleteOwnCandidateAccount(tx, { userId });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof DeleteOwnAccountError) {
      return { ok: false, message: error.message };
    }
    logger.error("[profile] deleteOwnAccountAction", { error: String(error) });
    return { ok: false, message: "Could not delete this account." };
  }
}
