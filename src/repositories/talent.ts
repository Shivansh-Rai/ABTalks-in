import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  CandidateSearchFilters,
  RecruiterContext,
} from "@/repositories/types";

/**
 * THE recruiter-discovery gate, and the only one.
 *
 * `CandidateVisibility` hangs off `User`, so this one fragment applies
 * identically to every track — AI cohort, 60-day challenge, Claude, hackathon,
 * and whatever ships next. That is the whole point of it living here: the
 * previous arrangement gated program members on
 * `ProgramMember.recruiterVisibilityConsentAt` and gated the other three tracks
 * on nothing at all, which is not a gate, it is a gap.
 *
 * Visibility is always `CandidateVisibility` on `User`. There is no
 * `ENABLE_NEW_TALENT` runtime switch. `openToWork` (`CandidatePreference`) is a
 * different question — whether the candidate is actively looking. Never
 * substitute one for the other.
 */
export function searchableUserWhere(): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    disabledAt: null,
    visibility: { is: { searchableByRecruiters: true, withdrawnAt: null } },
  };
}

export type RecruiterFieldPolicy = Readonly<{
  /** Whether a LinkedIn profile exists — never the URL. */
  linkedin: boolean;
  /** Whether a GitHub account exists — never the username. */
  github: boolean;
  /** Whether a résumé exists — never the file. */
  resume: boolean;
  /** AI interview scores and summary. */
  interviewResults: boolean;
  /** Quiz and assessment averages. */
  assessmentScores: boolean;
  /** Current employer name. */
  currentEmployer: boolean;
}>;

/**
 * What a recruiter sees about a candidate. Decided by the platform, the same
 * for every candidate (plan 133).
 *
 * This replaces eight per-candidate `CandidateVisibility.show*` columns. No
 * candidate path ever wrote them, so every live row held the schema defaults —
 * and these values ARE those defaults, which makes the swap a no-op on every
 * recruiter surface. It is a constant on purpose: which fields are shown is not
 * a candidate setting and must not become one again.
 *
 * Email and phone are not here. They are released only at CONTACT_SHARED
 * through `features/hire/contact-access.ts`, never by a field policy.
 */
export const RECRUITER_FIELD_POLICY: RecruiterFieldPolicy = Object.freeze({
  linkedin: true,
  github: true,
  resume: false,
  interviewResults: false,
  assessmentScores: false,
  currentEmployer: true,
});

/** Recruiter-safe identity. No email, phone, or resume URL. */
export type RecruiterPublicIdentity = {
  fullName: string;
  role: string | null;
  yearsExperience: number | null;
  graduationYear: number | null;
  education: string | null;
  university: string | null;
  skills: string[];
  hasLinkedin: boolean;
  hasGithub: boolean;
  hasResume: boolean;
};

/**
 * Overlay for `/hire` and `/talent` list/detail. Does not select email, phone,
 * or resume URL — resume presence is an existence check only.
 */
export async function loadRecruiterIdentities(
  userIds: string[],
): Promise<Map<string, RecruiterPublicIdentity>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const out = new Map<string, RecruiterPublicIdentity>();
  if (ids.length === 0) return out;

  const [profiles, withResume] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { userId: { in: ids } },
      select: {
        userId: true,
        fullName: true,
        headline: true,
        linkedinUrl: true,
        githubUsername: true,
        skills: {
          orderBy: { evidenceScore: "desc" },
          select: { skill: { select: { name: true } } },
        },
        education: {
          // NULLS LAST, not Postgres' default NULLS FIRST for DESC: a row with
          // no graduation year used to sort first and hide the year the
          // candidate actually entered (audit 2026-09-16, QA-KI-005).
          orderBy: { graduationYear: { sort: "desc", nulls: "last" } },
          take: 1,
          select: {
            degree: true,
            institutionName: true,
            graduationYear: true,
          },
        },
        experience: {
          select: { totalMonths: true },
        },
      },
    }),
    prisma.candidateProfile.findMany({
      where: { userId: { in: ids }, resumeUrl: { not: null } },
      select: { userId: true },
    }),
  ]);
  const resumeSet = new Set(withResume.map((r) => r.userId));

  for (const p of profiles) {
    const months = p.experience.reduce((sum, e) => sum + (e.totalMonths ?? 0), 0);
    const edu = p.education[0];
    out.set(p.userId, {
      fullName: p.fullName,
      role: p.headline,
      yearsExperience: months > 0 ? Math.round(months / 12) : null,
      graduationYear: edu?.graduationYear ?? null,
      education: edu?.degree ?? null,
      university: edu?.institutionName ?? null,
      skills: p.skills.map((s) => s.skill.name).filter(Boolean),
      hasLinkedin: RECRUITER_FIELD_POLICY.linkedin && Boolean(p.linkedinUrl),
      hasGithub: RECRUITER_FIELD_POLICY.github && Boolean(p.githubUsername),
      hasResume: RECRUITER_FIELD_POLICY.resume && resumeSet.has(p.userId),
    });
  }
  return out;
}

/**
 * The role titles a candidate has given, for search ranking: headline, target
 * roles, then work-history titles (current first, then most recent).
 *
 * Titles only. Employer names, dates and descriptions are not selected — the
 * role dimension needs what someone does, not where. Nothing here is shown on a
 * card; the scorer reads it and the recruiter sees a score.
 */
export async function loadRoleTitleSources(userIds: string[]): Promise<
  Map<string, { headline: string | null; preferredRoles: string[]; experienceTitles: string[] }>
> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const out = new Map<
    string,
    { headline: string | null; preferredRoles: string[]; experienceTitles: string[] }
  >();
  if (ids.length === 0) return out;
  // Three flat reads in parallel rather than one nested one, which Prisma runs
  // as the same three queries one after another — this sits on every search.
  const [profiles, preferences, experience] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { userId: { in: ids }, headline: { not: null } },
      select: { userId: true, headline: true },
    }),
    prisma.candidatePreference.findMany({
      where: { userId: { in: ids }, NOT: { preferredRoles: { isEmpty: true } } },
      select: { userId: true, preferredRoles: true },
    }),
    prisma.candidateExperience.findMany({
      where: { userId: { in: ids } },
      orderBy: [{ userId: "asc" }, { isCurrent: "desc" }, { startedOn: "desc" }],
      select: { userId: true, title: true },
    }),
  ]);
  const entry = (userId: string) => {
    let e = out.get(userId);
    if (!e) {
      e = { headline: null, preferredRoles: [], experienceTitles: [] };
      out.set(userId, e);
    }
    return e;
  };
  for (const p of profiles) entry(p.userId).headline = p.headline;
  for (const p of preferences) entry(p.userId).preferredRoles = p.preferredRoles;
  for (const x of experience) entry(x.userId).experienceTitles.push(x.title);
  return out;
}

/**
 * Set-membership form of {@link searchableUserWhere}, for the paths that hold
 * candidate ids already and need to drop the ones that must not be shown.
 */
export async function filterSearchableUserIds(
  userIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const rows = await prisma.user.findMany({
    where: { id: { in: ids }, ...searchableUserWhere() },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * The discovery gate plus the recruiter's own filters. The gate is spread in
 * from {@link searchableUserWhere} rather than restated, so there is exactly one
 * definition of who may be shown. Nothing a candidate sets reaches this clause.
 */
function buildUserGate(f: CandidateSearchFilters): Prisma.UserWhereInput {
  return {
    ...searchableUserWhere(),
    ...(f.completedProgramIds?.length && {
      programEnrollments: {
        some: {
          status: "COMPLETED",
          cohort: {
            programVersion: { programId: { in: f.completedProgramIds } },
          },
        },
      },
    }),
  };
}

function preferenceFilter(
  f: CandidateSearchFilters,
): Prisma.CandidatePreferenceWhereInput | null {
  const pref: Prisma.CandidatePreferenceWhereInput = {};
  if (f.openToWork === true) pref.openToWork = true;
  if (f.availableBefore) {
    pref.openToWork = true;
    pref.availableFrom = { lte: f.availableBefore };
  }
  if (f.workMode && f.workMode !== "FLEXIBLE") {
    pref.remotePreference = f.workMode;
  }
  if (f.noticePeriodDaysMax != null) {
    pref.noticePeriodDays = { lte: f.noticePeriodDaysMax };
  }
  return Object.keys(pref).length > 0 ? pref : null;
}

export async function searchCandidates(
  _ctx: RecruiterContext,
  f: CandidateSearchFilters,
) {
  const pageSize = Math.min(f.pageSize ?? 25, 50);
  const skip = ((f.page ?? 1) - 1) * pageSize;

const clauses: Prisma.CandidateProfileWhereInput[] = [
  { user: buildUserGate(f) },
];
if (f.q) {
  clauses.push({
    OR: [
      { fullName: { contains: f.q, mode: "insensitive" } },
      { headline: { contains: f.q, mode: "insensitive" } },
    ],
  });
}
if (f.skillIds?.length) {
  clauses.push({
    skills: {
      some: {
        skillId: { in: f.skillIds },
        evidenceScore: { gte: f.minEvidenceScore ?? 0 },
      },
    },
  });
}
if (f.graduationYearFrom || f.graduationYearTo) {
  clauses.push({
    education: {
      some: {
        graduationYear: {
          ...(f.graduationYearFrom && { gte: f.graduationYearFrom }),
          ...(f.graduationYearTo && { lte: f.graduationYearTo }),
        },
      },
    },
  });
}
if (f.minExperienceMonths) {
  clauses.push({
    experience: { some: { totalMonths: { gte: f.minExperienceMonths } } },
  });
}
const pref = preferenceFilter(f);
if (pref) clauses.push({ preference: { is: pref } });
if (f.locationCity) {
  clauses.push({
    OR: [
      { locationCity: { equals: f.locationCity, mode: "insensitive" } },
      {
        preference: {
          is: { preferredLocations: { has: f.locationCity } },
        },
      },
    ],
  });
}
if (f.countryCode) clauses.push({ countryCode: f.countryCode });

const where: Prisma.CandidateProfileWhereInput = { AND: clauses };

const [total, rows] = await prisma.$transaction([
  prisma.candidateProfile.count({ where }),
  prisma.candidateProfile.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    skip,
    take: pageSize,
    select: {
      userId: true,
      fullName: true,
      headline: true,
      locationCity: true,
      countryCode: true,
      skills: {
        orderBy: { evidenceScore: "desc" },
        take: 8,
        select: {
          evidenceScore: true,
          skill: { select: { slug: true, name: true } },
        },
      },
      education: {
        orderBy: { graduationYear: { sort: "desc", nulls: "last" } },
        take: 1,
        select: {
          institutionName: true,
          degree: true,
          graduationYear: true,
        },
      },
      experience: {
        where: { isCurrent: true },
        take: 1,
        select: { title: true, companyName: true, totalMonths: true },
      },
    },
  }),
]);

return {
  total,
  page: f.page ?? 1,
  pageSize,
  rows: rows.map((row) => ({
    userId: row.userId,
    fullName: row.fullName,
    headline: row.headline,
    locationCity: row.locationCity,
    countryCode: row.countryCode,
    hasLinkedin: RECRUITER_FIELD_POLICY.linkedin,
    hasGithub: RECRUITER_FIELD_POLICY.github,
    hasResume: RECRUITER_FIELD_POLICY.resume,
    skills: row.skills,
    education: row.education,
    experience: row.experience.map((e) => ({
      title: e.title,
      companyName: RECRUITER_FIELD_POLICY.currentEmployer
        ? e.companyName
        : null,
      totalMonths: e.totalMonths,
    })),
  })),
};
}
