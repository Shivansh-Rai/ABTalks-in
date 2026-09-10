import { RedemptionStatus, PointsSourceType } from "@prisma/client";
import { writeClient } from "@/lib/db";
import { reqLogger } from "@/lib/logger";
import { captureFailure } from "@/lib/observability/capture";
import { logMoney } from "@/lib/observability/domain-log";
import { getRequestId } from "@/lib/observability/request-id";
import { applyPointsChange, getBalance, withLegacyPointsMirrorFlush } from "@/repositories/points";
import {
  composeShippingAddress,
  type RedeemItemInput,
} from "@/lib/validations/marketplace";
import { randomUUID } from "node:crypto";

export type RedeemResult =
  | { ok: true; redemptionId: string; newBalance: number }
  | {
      ok: false;
      reason: "insufficient" | "inactive" | "not_found" | "validation";
      message: string;
    };

/**
 * T-259 — a money path that is also a contact path.
 *
 * `input` carries a shipping address, a recipient name and a phone number. None
 * of them are logged: the `redemptionId` is the handle, and the address lives
 * only on the Redemption row where the shipping team reads it. The points side
 * emits its own `credit.debit.*` and `ledger.write.*` events from
 * `applyPointsChange`, so this layer logs the redemption lifecycle only.
 */
export async function redeemItem(
  input: RedeemItemInput & { userId: string },
): Promise<RedeemResult> {
  const requestId = await getRequestId();
  const log = reqLogger(requestId, {
    route: "marketplace:redeemItem",
    userId: input.userId,
    itemId: input.itemId,
  });

  logMoney("redemption", { outcome: "attempt", userId: input.userId, log });

  try {
    const result = await runRedemption(input);
    if (result.ok) {
      logMoney("redemption", {
        outcome: "success",
        userId: input.userId,
        sourceId: result.redemptionId,
        newBalance: result.newBalance,
        log,
      });
    } else {
      logMoney("redemption", {
        outcome: "refused",
        userId: input.userId,
        reason: result.reason,
        log,
      });
    }
    return result;
  } catch (error) {
    await captureFailure(error, {
      event: "redemption.failed",
      message: "redemption threw",
      log,
      tags: {
        requestId,
        userId: input.userId,
        itemId: input.itemId,
        route: "marketplace:redeemItem",
      },
      extra: { area: "money", op: "redemption", outcome: "failed" },
    });
    throw error;
  }
}

function runRedemption(
  input: RedeemItemInput & { userId: string },
): Promise<RedeemResult> {
  return withLegacyPointsMirrorFlush(() =>
    writeClient().$transaction(
    async (tx) => {
      const item = await tx.marketplaceItem.findUnique({
        where: { id: input.itemId },
        select: {
          id: true,
          title: true,
          costSP: true,
          active: true,
          sizeOptions: true,
        },
      });
      if (!item)
        return {
          ok: false,
          reason: "not_found",
          message: "Item not found",
        };
      if (!item.active)
        return {
          ok: false,
          reason: "inactive",
          message: "Item is no longer available",
        };
      // Items priced at 0 SP are "Revealing Soon" — not redeemable yet.
      if (item.costSP <= 0)
        return {
          ok: false,
          reason: "inactive",
          message: "This item isn't available for redemption yet.",
        };

      // Checked against the item's own list rather than the schema, and BEFORE
      // any points move — the client is told which sizes exist, so it must not
      // be the one deciding whether the answer is acceptable.
      if (item.sizeOptions.length > 0) {
        if (!input.selectedSize) {
          return {
            ok: false,
            reason: "validation",
            message: "Select a size before redeeming.",
          };
        }
        if (!item.sizeOptions.includes(input.selectedSize)) {
          return {
            ok: false,
            reason: "validation",
            message: `Size ${input.selectedSize} isn't available for this item.`,
          };
        }
      }
      // An item with no sizes ignores anything sent, rather than failing the
      // redemption: a page loaded before sizes were removed would otherwise
      // break for a reason the student cannot see or fix.
      const selectedSize =
        item.sizeOptions.length > 0 ? input.selectedSize : null;

      const redemptionId = randomUUID();
      const reason = `Redeemed ${item.title} (redemptionId=${redemptionId})`;
      const applied = await applyPointsChange(tx, {
        userId: input.userId,
        amount: -item.costSP,
        mode: "debit_strict",
        sourceType: PointsSourceType.REDEMPTION,
        sourceId: redemptionId,
        idempotencyKey: `redeem:${redemptionId}`,
        reason,
        legacyEvent: { type: "REDEEM" },
      });

      if (!applied.ok) {
        if (applied.reason === "not_found") {
          return {
            ok: false,
            reason: "not_found",
            message: "Account not found",
          };
        }
        const current = await getBalance(input.userId, tx);
        return {
          ok: false,
          reason: "insufficient",
          message: `You need ${Math.max(item.costSP - current, 0)} more SP for this item.`,
        };
      }

      const redemption = await tx.redemption.create({
        data: {
          id: redemptionId,
          userId: input.userId,
          itemId: item.id,
          costSP: item.costSP,
          itemTitle: item.title,
          selectedSize,
          status: RedemptionStatus.PENDING,
          // Zod has already trimmed every part; the printable block is derived
          // here so it can never disagree with the columns beside it.
          shippingAddress: composeShippingAddress(input),
          recipientName: input.recipientName,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          country: input.country,
          recipientPhone: input.recipientPhone,
        },
        select: { id: true },
      });

      return {
        ok: true,
        redemptionId: redemption.id,
        newBalance: applied.newBalance,
      };
    },
    { maxWait: 5000, timeout: 10000 },
    ),
  );
}
