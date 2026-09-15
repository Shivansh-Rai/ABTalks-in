"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import {
  searchDeliveries,
  searchDeliveriesInputSchema,
  type DeliveryRow,
} from "@/features/notification/delivery-diagnosis";

/**
 * T-268 — the one server action the admin diagnosis console needs.
 *
 * Read-only. Every call gates on `requireAdmin()` first. The Zod schema is the
 * only surface an untrusted client can push values through.
 */

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

export async function searchDeliveriesAction(
  input: unknown,
): Promise<ActionResult<DeliveryRow[]>> {
  await requireAdmin();

  const parsed = searchDeliveriesInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid search input." };
  }

  try {
    const rows = await searchDeliveries(parsed.data);
    return { ok: true, data: rows };
  } catch (error) {
    logger.error("[admin-delivery] search failed", {
      error: String(error),
    });
    return { ok: false, message: "Could not search deliveries." };
  }
}
