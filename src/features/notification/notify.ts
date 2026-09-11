import "server-only";
import type { SendEmailResult } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { NotifyDelivery, NotifyInput, NotifyResponse } from "./types";

/**
 * The shared notification helper — in-app + email in one call.
 *
 * ⚠️ THIS IS A NO-OP STUB. Nothing is written and no email is sent. What is
 * real here is the *contract*: the signature and the type names in ./types.ts
 * are frozen, so call sites written today are correct when the implementation
 * lands. See docs/plans/115-notify-helper-contract-stub.md (this phase) and
 * docs/plans/114-unified-notify-helper.md (the implementation).
 *
 * Reuses, rather than reinventing:
 *   - `sendEmail` / `SendEmailResult` from @/lib/email — the only email door in
 *     this project. `emailDeliveryFrom` below maps its result onto the
 *     contract, which is what makes that reuse a compile-time fact rather than
 *     a promise in a comment.
 *   - `NotificationCategoryKey` from ./types — the existing notification-type
 *     identifier, used verbatim for `NotifyInput.category`.
 *   - The `AppNotification.key` namespace convention, extended by
 *     `PERSONAL_KEY_PREFIX`.
 *
 * CALLER OBLIGATION, from day one: call this AFTER your transaction commits,
 * never inside `prisma.$transaction`. Holding a pooled connection across an
 * outbound Brevo request is how a free-tier pool is exhausted. The stub cannot
 * enforce this; the rule applies anyway.
 */
export async function notifyUser(input: NotifyInput): Promise<NotifyResponse> {
  logger.info("[notify] stub — nothing delivered", {
    userId: input.userId,
    eventKey: input.eventKey,
  });

  return {
    ok: true,
    data: {
      notificationId: null,
      inApp: "skipped",
      email: "skipped",
      skipReasons: { inApp: "not_implemented", email: "not_implemented" },
    },
  };
}

/**
 * Maps `sendEmail`'s three-state result onto the contract's `NotifyDelivery`.
 *
 * Pure, and real even in this phase. `{ ok: false, skipped: true }` is not a
 * failure — it is `sendEmail` correctly declining to send (no BREVO_API_KEY, or
 * an @abtalks.dev seed address), and it must not be reported as an error.
 *
 * If `SendEmailResult` ever changes shape, this is the single place that
 * breaks. By design.
 */
export function emailDeliveryFrom(result: SendEmailResult): NotifyDelivery {
  if (result.ok) return "delivered";
  return result.skipped ? "skipped" : "failed";
}
