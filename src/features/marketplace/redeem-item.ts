import { Prisma, RedemptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type RedeemResult =
  | { ok: true; redemptionId: string; newBalance: number }
  | {
      ok: false;
      reason:
        | "insufficient"
        | "inactive"
        | "not_found"
        | "no_profile"
        | "validation";
      message: string;
    };

export async function redeemItem(input: {
  userId: string;
  itemId: string;
  shippingAddress: string;
  recipientPhone: string;
}): Promise<RedeemResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const item = await tx.marketplaceItem.findUnique({
          where: { id: input.itemId },
          select: { id: true, title: true, costSP: true, active: true },
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

        const profile = await tx.studentProfile.findUnique({
          where: { userId: input.userId },
          select: { synergyPoints: true },
        });
        if (!profile)
          return {
            ok: false,
            reason: "no_profile",
            message: "Profile not found",
          };
        if (profile.synergyPoints < item.costSP) {
          return {
            ok: false,
            reason: "insufficient",
            message: `You need ${item.costSP - profile.synergyPoints} more SP for this item.`,
          };
        }

        const redemption = await tx.redemption.create({
          data: {
            userId: input.userId,
            itemId: item.id,
            costSP: item.costSP,
            itemTitle: item.title,
            status: RedemptionStatus.PENDING,
            shippingAddress: input.shippingAddress.trim(),
            recipientPhone: input.recipientPhone.trim(),
          },
          select: { id: true },
        });

        const updated = await tx.studentProfile.update({
          where: { userId: input.userId },
          data: { synergyPoints: { decrement: item.costSP } },
          select: { synergyPoints: true },
        });

        await tx.synergyEvent.create({
          data: {
            userId: input.userId,
            points: -item.costSP,
            type: "REDEEM",
            reason: `Redeemed ${item.title} (redemptionId=${redemption.id})`,
          },
        });

        return {
          ok: true,
          redemptionId: redemption.id,
          newBalance: updated.synergyPoints,
        };
      },
      { maxWait: 5000, timeout: 10000 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      false
    ) {
      return {
        ok: false,
        reason: "insufficient",
        message: "Balance changed; try again.",
      };
    }
    throw error;
  }
}
