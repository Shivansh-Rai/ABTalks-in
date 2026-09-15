import { prisma } from "@/lib/db";

export async function getDeliveryLog(filter?: "SENT" | "FAILED" | "SKIPPED") {
  const where = filter ? { status: filter } : {};

  const [sent, failed, pending, rows] = await Promise.all([
    prisma.outboundDelivery.count({ where: { status: "SENT" } }),
    prisma.outboundDelivery.count({ where: { status: "FAILED" } }),
    prisma.outboundDelivery.count({ where: { status: "SKIPPED" } }),
    prisma.outboundDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        kind: true,
        channel: true,
        status: true,
        failureReason: true,
        createdAt: true,
        subjectType: true,
        subjectId: true,
      },
    }),
  ]);

  return { sent, failed, pending, rows };
}
