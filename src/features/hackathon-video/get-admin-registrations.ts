import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { VIDEOTHON } from "@/features/hackathon-video/config";

export type AdminVideoRegistration = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  employment: "LEARNER" | "WORKING";
  currentCtc: string | null;
  portfolioUrl: string;
  sourceSlug: string | null;
  submissionUrl: string | null;
  submissionNotes: string | null;
  submissionUpdatedAtIso: string | null;
  createdAtIso: string;
};

export type AdminVideoRegistrationsData = {
  total: number;
  learnerCount: number;
  workingCount: number;
  submittedCount: number;
  rows: AdminVideoRegistration[];
};

const querySchema = z.string().trim().max(120).optional();

/** Normalises the `?q=` search param; invalid or empty input means no filter. */
export function parseVideoRegistrationQuery(raw: unknown): string | undefined {
  const parsed = querySchema.safeParse(raw);
  return parsed.success && parsed.data ? parsed.data : undefined;
}

/**
 * Every VideoThon registration for the current event, newest first. Stats
 * are computed over the whole event; `rows` honours the optional search.
 */
export async function getAdminVideoRegistrations({
  q,
}: {
  q?: string;
}): Promise<AdminVideoRegistrationsData> {
  const eventWhere = { eventId: VIDEOTHON.eventId };
  const rowsWhere = q
    ? {
        ...eventWhere,
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { city: { contains: q, mode: "insensitive" as const } },
          { phoneNumber: { contains: q } },
        ],
      }
    : eventWhere;

  const [rows, total, working, submitted] = await Promise.all([
    prisma.hackathonVideoRegistration.findMany({
      where: rowsWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        fullName: true,
        email: true,
        phoneCountryCode: true,
        phoneNumber: true,
        city: true,
        employment: true,
        currentCtc: true,
        portfolioUrl: true,
        sourceSlug: true,
        submissionUrl: true,
        submissionNotes: true,
        submissionUpdatedAt: true,
        createdAt: true,
      },
    }),
    prisma.hackathonVideoRegistration.count({ where: eventWhere }),
    prisma.hackathonVideoRegistration.count({
      where: { ...eventWhere, employment: "WORKING" },
    }),
    prisma.hackathonVideoRegistration.count({
      where: { ...eventWhere, submissionUrl: { not: null } },
    }),
  ]);

  return {
    total,
    learnerCount: total - working,
    workingCount: working,
    submittedCount: submitted,
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      fullName: r.fullName,
      email: r.email,
      phone: `${r.phoneCountryCode} ${r.phoneNumber}`,
      city: r.city,
      employment: r.employment,
      currentCtc: r.currentCtc,
      portfolioUrl: r.portfolioUrl,
      sourceSlug: r.sourceSlug,
      submissionUrl: r.submissionUrl,
      submissionNotes: r.submissionNotes,
      submissionUpdatedAtIso: r.submissionUpdatedAt?.toISOString() ?? null,
      createdAtIso: r.createdAt.toISOString(),
    })),
  };
}
