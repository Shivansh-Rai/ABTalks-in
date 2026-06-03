import { Domain, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getSubmissionsFeed(input: {
  domain?: string;
  status?: "ALL" | "ON_TIME" | "LATE";
  minDay?: number;
  maxDay?: number;
  take?: number;
}): Promise<
  Array<{
    id: string;
    userId: string;
    studentName: string;
    domain: string;
    dayNumber: number;
    status: string;
    githubUrl: string;
    linkedinUrl: string;
    submittedAt: Date;
  }>
> {
  const domainFilter =
    input.domain && input.domain !== "ALL" ? (input.domain as Domain) : undefined;
  const statusFilter =
    input.status && input.status !== "ALL"
      ? (input.status as SubmissionStatus)
      : undefined;

  const dayNumberFilter =
    input.minDay != null || input.maxDay != null
      ? {
          dayNumber: {
            ...(input.minDay != null ? { gte: input.minDay } : {}),
            ...(input.maxDay != null ? { lte: input.maxDay } : {}),
          },
        }
      : {};

  const rows = await prisma.submission.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...dayNumberFilter,
      ...(domainFilter
        ? {
            enrollment: {
              domain: domainFilter,
            },
          }
        : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: input.take ?? 100,
    select: {
      id: true,
      dayNumber: true,
      status: true,
      githubUrl: true,
      linkedinUrl: true,
      submittedAt: true,
      enrollment: { select: { domain: true } },
      user: {
        select: {
          id: true,
          email: true,
          studentProfile: { select: { fullName: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.user.id,
    studentName:
      row.user.studentProfile?.fullName?.trim() || row.user.email || "Unknown",
    domain: row.enrollment.domain,
    dayNumber: row.dayNumber,
    status: row.status,
    githubUrl: row.githubUrl,
    linkedinUrl: row.linkedinUrl,
    submittedAt: row.submittedAt,
  }));
}
