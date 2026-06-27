import { RedemptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MyRedemptionRow = {
  id: string;
  itemTitle: string;
  costSP: number;
  status: RedemptionStatus;
  dateIso: string;
};

export async function getMyRedemptions(
  userId: string,
): Promise<MyRedemptionRow[]> {
  const rows = await prisma.redemption.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      itemTitle: true,
      costSP: true,
      status: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    itemTitle: r.itemTitle,
    costSP: r.costSP,
    status: r.status,
    dateIso: r.createdAt.toISOString(),
  }));
}
