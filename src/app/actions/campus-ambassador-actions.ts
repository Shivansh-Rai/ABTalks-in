"use server";

import { auth } from "@/auth";
import { writeClient } from "@/lib/db";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { applyAmbassadorChange } from "@/repositories/ambassador";

export async function applyCampusAmbassador() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Not authenticated" };
  }

  try {
    await writeClient().$transaction(async (tx) => {
      await applyAmbassadorChange(tx, session.user.id, { kind: "apply" });
    });

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    logger.error("[applyCampusAmbassador] error:", {
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    });
    return { ok: false, message: "Failed to apply. Try again." };
  }
}

export async function dismissCampusAmbassador() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Not authenticated" };
  }

  try {
    await writeClient().$transaction(async (tx) => {
      await applyAmbassadorChange(tx, session.user.id, { kind: "dismiss" });
    });

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    logger.error("[dismissCampusAmbassador] error:", {
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    });
    return { ok: false, message: "Failed to dismiss." };
  }
}
