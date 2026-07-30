import "server-only";
import { prisma } from "@/lib/db";

export type HackathonLinkStat = {
  id: string;
  slug: string;
  label: string;
  note: string | null;
  registrations: number;
  users: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    team: "solo" | "team";
    college: string;
  }[];
};

export type HackathonLinkUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  team: "solo" | "team";
  college: string;
};

export type HackathonLinkStats = {
  links: HackathonLinkStat[];
  totalRegistrations: number;
  attributedRegistrations: number;
  directRegistrations: number;
  unknownSlugs: {
    slug: string;
    registrations: number;
    users: HackathonLinkUser[];
  }[];
};

export async function getHackathonLinkStats(): Promise<HackathonLinkStats> {
  const [linkRows, participantRows] = await Promise.all([
    prisma.hackathonLink.findMany({
      select: { id: true, slug: true, label: true, note: true },
      orderBy: { label: "asc" },
    }),
    prisma.hackathonParticipant.findMany({
      select: {
        id: true,
        sourceSlug: true,
        fullName: true,
        email: true,
        phone: true,
        college: true,
        team: {
          select: {
            entryType: true,
          },
        },
      },
    }),
  ]);

  const counts = new Map<string, number>();
  const usersBySlug = new Map<
    string,
    {
      id: string;
      fullName: string;
      email: string;
      phone: string;
      team: "solo" | "team";
      college: string;
    }[]
  >();
  let directRegistrations = 0;

  for (const row of participantRows) {
    const slug = row.sourceSlug;
    if (!slug) {
      directRegistrations += 1;
      continue;
    }
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
    const users = usersBySlug.get(slug) ?? [];
    users.push({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      team: row.team.entryType === "SOLO" ? "solo" : "team",
      college: row.college,
    });
    usersBySlug.set(slug, users);
  }

  const known = new Set(linkRows.map((r) => r.slug));

  const links: HackathonLinkStat[] = linkRows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      label: r.label,
      note: r.note ?? null,
      registrations: counts.get(r.slug) ?? 0,
      users: usersBySlug.get(r.slug) ?? [],
    }))
    .sort((a, b) => b.registrations - a.registrations);

  const unknownSlugs = [...counts.entries()]
    .filter(([slug]) => !known.has(slug))
    .map(([slug, registrations]) => ({
      slug,
      registrations,
      users: usersBySlug.get(slug) ?? [],
    }))
    .sort((a, b) => b.registrations - a.registrations);

  return {
    links,
    totalRegistrations: participantRows.length,
    attributedRegistrations: participantRows.length - directRegistrations,
    directRegistrations,
    unknownSlugs,
  };
}
