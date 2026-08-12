import "server-only";
import type { DataRightsRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DataRightsRow = {
  id: string;
  email: string;
  type: string;
  message: string | null;
  status: DataRightsRequestStatus;
  createdAt: Date;
  ageDays: number;
  /** Privacy Policy §10 commits to a 30-day response. */
  overdue: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RESPONSE_TARGET_DAYS = 30;

export async function getDataRightsRequests(params: {
  status: DataRightsRequestStatus | "ALL";
}): Promise<DataRightsRow[]> {
  const rows = await prisma.dataRightsRequest.findMany({
    where: params.status === "ALL" ? {} : { status: params.status },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      email: true,
      type: true,
      message: true,
      status: true,
      createdAt: true,
    },
  });

  const now = Date.now();
  return rows.map((row) => {
    const ageDays = Math.floor((now - row.createdAt.getTime()) / DAY_MS);
    return {
      ...row,
      ageDays,
      overdue: row.status === "PENDING" && ageDays >= RESPONSE_TARGET_DAYS,
    };
  });
}
