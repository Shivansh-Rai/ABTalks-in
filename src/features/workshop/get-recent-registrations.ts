import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface RecentRegistrant {
  name: string;
  org: string | null;
}

/**
 * Recent signups for the public "just joined" social-proof ticker, scoped to one
 * event. First name + organization ONLY — this renders on a public page, so email
 * and phone must never be selected here. Returns [] on any error so the ticker
 * falls back to its sample data.
 *
 * Note: the Supabase-era version queried a `registrations` table that does not
 * exist, so it always failed soft and the ticker only ever showed sample names.
 */
export async function getRecentRegistrations(
  eventId: string,
): Promise<RecentRegistrant[]> {
  try {
    const rows = await prisma.workshopRegistration.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { name: true, organization: true },
    });
    return rows
      .filter((r) => r.name)
      .map((r) => ({
        name: r.name.trim().split(/\s+/)[0]!,
        org: r.organization ? r.organization.trim() : null,
      }));
  } catch (err) {
    logger.error("Failed to load recent workshop registrations", {
      eventId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
