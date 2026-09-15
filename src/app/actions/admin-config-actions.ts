"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import {
  CONTACT_UNLOCK_COST_KEY,
  MOCK_FREE_ALLOWANCE_KEY,
  MOCK_POINT_COST_KEY,
  STARTING_GRANT_KEY,
  writeIntConfig,
} from "@/lib/platform-config";

type ActionResult = { ok: true } | { ok: false; message: string };

const schema = z.object({
  startingGrantMinor: z.number().int(),
  unlockCostMinor: z.number().int(),
  mockFreeAllowance: z.number().int(),
  mockPointCost: z.number().int(),
  reason: z.string().trim().min(8).max(500),
});

export async function updatePlatformConfigAction(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter valid integers and a reason of at least 8 characters.",
    };
  }

  try {
    await writeIntConfig({
      key: STARTING_GRANT_KEY,
      intValue: parsed.data.startingGrantMinor,
      actorUserId: admin.userId,
      reason: parsed.data.reason,
    });
    await writeIntConfig({
      key: CONTACT_UNLOCK_COST_KEY,
      intValue: parsed.data.unlockCostMinor,
      actorUserId: admin.userId,
      reason: parsed.data.reason,
    });
    await writeIntConfig({
      key: MOCK_FREE_ALLOWANCE_KEY,
      intValue: parsed.data.mockFreeAllowance,
      actorUserId: admin.userId,
      reason: parsed.data.reason,
    });
    await writeIntConfig({
      key: MOCK_POINT_COST_KEY,
      intValue: parsed.data.mockPointCost,
      actorUserId: admin.userId,
      reason: parsed.data.reason,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/actions");
    return { ok: true };
  } catch (error) {
    logger.error("[admin] updatePlatformConfigAction", { error: String(error) });
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save configuration.",
    };
  }
}
