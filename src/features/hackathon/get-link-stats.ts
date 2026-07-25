import "server-only";
import { prisma } from "@/lib/db";

export type HackathonLinkStat = {
  slug: string;
  label: string;
  note: string | null;
  registrations: number;
};

export type HackathonLinkStats = {
  links: HackathonLinkStat[];
  totalRegistrations: number;
  attributedRegistrations: number;
  directRegistrations: number;
  unknownSlugs: { slug: string; registrations: number }[];
};

export async function getHackathonLinkStats(): Promise<HackathonLinkStats> {
  const [linkRows, participantRows] = await Promise.all([
    prisma.hackathonLink.findMany({
      select: { slug: true, label: true, note: true },
      orderBy: { label: "asc" },
    }),
    prisma.hackathonParticipant.findMany({
      select: { sourceSlug: true },
    }),
  ]);

  const counts = new Map<string, number>();
  let directRegistrations = 0;

  for (const row of participantRows) {
    const slug = row.sourceSlug;
    if (!slug) {
      directRegistrations += 1;
      continue;
    }
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  const known = new Set(linkRows.map((r) => r.slug));

  const links: HackathonLinkStat[] = linkRows
    .map((r) => ({
      slug: r.slug,
      label: r.label,
      note: r.note ?? null,
      registrations: counts.get(r.slug) ?? 0,
    }))
    .sort((a, b) => b.registrations - a.registrations);

  const unknownSlugs = [...counts.entries()]
    .filter(([slug]) => !known.has(slug))
    .map(([slug, registrations]) => ({ slug, registrations }))
    .sort((a, b) => b.registrations - a.registrations);

  return {
    links,
    totalRegistrations: participantRows.length,
    attributedRegistrations: participantRows.length - directRegistrations,
    directRegistrations,
    unknownSlugs,
  };
}
