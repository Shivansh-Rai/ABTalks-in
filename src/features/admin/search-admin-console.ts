import { prisma } from "@/lib/db";
import { listCandidateProfiles } from "@/repositories/candidate";

export async function searchAdminConsole(q: string) {
  const term = q.trim();
  if (term.length < 2) {
    return { candidates: [], recruiters: [], jobs: [], assessments: [] };
  }

  const [candidates, recruiters, jobs, assessments] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        recruiterProfile: { is: null },
        OR: [
          { email: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          {
            candidateProfile: {
              fullName: { contains: term, mode: "insensitive" },
            },
          },
        ],
      },
      take: 8,
      select: {
        id: true,
        email: true,
        name: true,
        disabledAt: true,
        candidateProfile: { select: { fullName: true } },
        resume: { select: { blobPathname: true, fileName: true } },
      },
    }),
    prisma.recruiterProfile.findMany({
      where: {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { company: { contains: term, mode: "insensitive" } },
          { user: { email: { contains: term, mode: "insensitive" } } },
        ],
      },
      take: 8,
      select: {
        id: true,
        userId: true,
        fullName: true,
        company: true,
        user: { select: { email: true, disabledAt: true } },
      },
    }),
    prisma.job.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { company: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: {
        id: true,
        title: true,
        company: true,
        isOpen: true,
      },
    }),
    prisma.recruiterAssessment.findMany({
      where: { title: { contains: term, mode: "insensitive" } },
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        createdBy: { select: { email: true, name: true } },
      },
    }),
  ]);

  const names = await listCandidateProfiles(candidates.map((c) => c.id));
  // `resume` is destructured away on purpose: the page needs a boolean and a
  // name, and a private blob pathname has no business on a rendered payload.
  const namedCandidates = candidates.map(({ resume, ...c }) => ({
    ...c,
    hasResumeFile: Boolean(resume?.blobPathname),
    resumeFileName: resume?.fileName ?? null,
    studentProfile: {
      fullName:
        names.get(c.id)?.fullName ?? c.candidateProfile?.fullName ?? c.name ?? c.email,
    },
  }));

  return { candidates: namedCandidates, recruiters, jobs, assessments };
}

/**
 * Typeahead suggestions for the admin global search box.
 *
 * Deliberately separate from `searchAdminConsole` rather than a parameter on
 * it: the two have different budgets. The full search runs once per submit and
 * can afford eight rows per group plus a résumé lookup; this one runs while a
 * key is still down.
 */

export type AdminSuggestItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
};

/**
 * Base UI's `Group` contract is `{ items: Item[] }` plus any other keys
 * (`internals/resolveValueLabel.d.ts`), so `value` carries the heading.
 */
export type AdminSuggestGroup = {
  value: string;
  items: AdminSuggestItem[];
};

/**
 * Three characters, where the submitted search gates at two. A pg_trgm GIN
 * index cannot serve a pattern with fewer than three non-wildcard characters,
 * so a 2-char suggest would guarantee the slowest possible query on the
 * hottest path — and would match a useless share of the table anyway.
 */
const SUGGEST_MIN = 3;
const SUGGEST_TAKE = 5;

export async function suggestAdminConsole(
  q: string,
): Promise<AdminSuggestGroup[]> {
  const term = q.trim();
  if (term.length < SUGGEST_MIN) return [];

  const [candidates, recruiters, jobs, assessments] = await Promise.all([
    prisma.user.findMany({
      // Same guards as the full search: a suggestion must never surface a row
      // the result page would hide.
      where: {
        deletedAt: null,
        recruiterProfile: { is: null },
        OR: [
          { email: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          {
            candidateProfile: {
              fullName: { contains: term, mode: "insensitive" },
            },
          },
        ],
      },
      take: SUGGEST_TAKE,
      // No `resume` relation here, unlike the full search. The dropdown has no
      // résumé affordance, and a private blob pathname has no business on a
      // payload this one is.
      select: {
        id: true,
        email: true,
        name: true,
        disabledAt: true,
        candidateProfile: { select: { fullName: true } },
      },
    }),
    prisma.recruiterProfile.findMany({
      where: {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { company: { contains: term, mode: "insensitive" } },
          { user: { email: { contains: term, mode: "insensitive" } } },
        ],
      },
      take: SUGGEST_TAKE,
      select: {
        id: true,
        fullName: true,
        company: true,
        user: { select: { email: true, disabledAt: true } },
      },
    }),
    prisma.job.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { company: { contains: term, mode: "insensitive" } },
        ],
      },
      take: SUGGEST_TAKE,
      select: { id: true, title: true, company: true, isOpen: true },
    }),
    prisma.recruiterAssessment.findMany({
      where: { title: { contains: term, mode: "insensitive" } },
      take: SUGGEST_TAKE,
      select: { id: true, title: true, status: true },
    }),
  ]);

  // `listCandidateProfiles` is skipped on purpose: it reads `CandidateProfile`
  // by userId, which the query above already joined, so calling it here would
  // be a second round trip for data already in hand.
  const groups: AdminSuggestGroup[] = [
    {
      value: "Candidates",
      items: candidates.map((row) => ({
        id: `candidate-${row.id}`,
        href: `/admin/students/${row.id}`,
        title:
          row.candidateProfile?.fullName?.trim() ||
          row.name?.trim() ||
          row.email,
        meta: `${row.email}${row.disabledAt ? " · Disabled" : ""}`,
      })),
    },
    {
      value: "Recruiters",
      items: recruiters.map((row) => ({
        id: `recruiter-${row.id}`,
        href: "/admin/recruiters",
        title: row.fullName,
        meta: `${row.company}${row.user.disabledAt ? " · Disabled" : ""}`,
      })),
    },
    {
      value: "Jobs",
      items: jobs.map((row) => ({
        id: `job-${row.id}`,
        href: `/admin/jobs/${row.id}`,
        title: row.title,
        meta: `${row.company} · ${row.isOpen ? "Open" : "Closed"}`,
      })),
    },
    {
      value: "Assessments",
      items: assessments.map((row) => ({
        id: `assessment-${row.id}`,
        href: "/admin/assessments",
        title: row.title,
        meta: row.status,
      })),
    },
  ];

  // Drop empty groups so the popup never shows a bare heading.
  return groups.filter((group) => group.items.length > 0);
}
