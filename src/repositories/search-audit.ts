import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { programMember } from "@/repositories/legacy/program-member";
import { gmailLocalKey } from "@/features/search-qa/data-quality";
import type {
  CanonicalCandidate,
  PoolCohort,
} from "@/features/search-qa/canonical";

/**
 * Read-only canonical reads for the recruiter-search QA audit.
 *
 * DELIBERATELY INDEPENDENT of `repositories/hire.ts` and `repositories/talent.ts`.
 * Those are the code under test; an audit that loaded candidates through them
 * would inherit every clause they get wrong. So nothing here reuses
 * `searchableUserWhere` or the track queries — the rules are re-derived in
 * `features/search-qa/canonical.ts` from these raw rows.
 *
 * Every function is a SELECT. Nothing here writes, and the CLI runs it on a
 * session with `default_transaction_read_only=on` so a mistake cannot either.
 *
 * Batched by id cursor: memory is one batch, never the table.
 */

const CANONICAL_SELECT = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  deletedAt: true,
  anonymizedAt: true,
  disabledAt: true,
  visibility: { select: { searchableByRecruiters: true, withdrawnAt: true } },
  candidateProfile: {
    select: {
      fullName: true,
      headline: true,
      locationCity: true,
      linkedinUrl: true,
      githubUsername: true,
      portfolioUrl: true,
      resumeUrl: true,
      skills: {
        select: {
          skillId: true,
          claimedByCandidate: true,
          verified: true,
          evidenceScore: true,
          evidenceCount: true,
          skill: { select: { name: true, isActive: true } },
        },
      },
      education: {
        select: {
          institutionName: true,
          collegeId: true,
          degree: true,
          fieldOfStudy: true,
          startYear: true,
          graduationYear: true,
          isCurrent: true,
        },
      },
      experience: {
        select: {
          companyName: true,
          title: true,
          totalMonths: true,
          startedOn: true,
          endedOn: true,
          isCurrent: true,
        },
      },
      projects: { select: { title: true, repoUrl: true, liveUrl: true } },
      links: { select: { type: true, url: true } },
      preference: {
        select: {
          openToWork: true,
          noticePeriodDays: true,
          preferredLocations: true,
          opportunityTypes: true,
          willingToRelocate: true,
          remotePreference: true,
          expectedSalaryMin: true,
          expectedSalaryMax: true,
        },
      },
    },
  },
  programMembers: { select: { id: true, cohortId: true, status: true, skills: true } },
  enrollments: {
    select: {
      challenge: { select: { domain: true } },
      _count: { select: { submissions: true } },
    },
  },
  hackathonParticipants: {
    where: { team: { submission: { isNot: null } } },
    select: { id: true },
    take: 1,
  },
  studentProfile: { select: { skills: true, graduationYear: true } },
} satisfies Prisma.UserSelect;

type CanonicalRow = Prisma.UserGetPayload<{ select: typeof CANONICAL_SELECT }>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toCanonical(row: CanonicalRow): CanonicalCandidate {
  const p = row.candidateProfile;
  const at = row.email.lastIndexOf("@");
  return {
    userId: row.id,
    role: row.role,
    emailDomain: at > 0 ? row.email.slice(at + 1).toLowerCase() : null,
    emailValid: EMAIL.test(row.email),
    emailAliasKey: gmailLocalKey(row.email),
    createdAt: row.createdAt,
    deleted: row.deletedAt != null,
    disabled: row.disabledAt != null,
    anonymized: row.anonymizedAt != null,
    visibility: row.visibility
      ? {
          searchable: row.visibility.searchableByRecruiters,
          withdrawn: row.visibility.withdrawnAt != null,
        }
      : null,
    profile: p
      ? {
          fullName: p.fullName,
          headline: p.headline,
          locationCity: p.locationCity,
          linkedinUrl: p.linkedinUrl,
          githubUsername: p.githubUsername,
          portfolioUrl: p.portfolioUrl,
          hasResume: Boolean(p.resumeUrl),
        }
      : null,
    skills: (p?.skills ?? []).map((s) => ({
      skillId: s.skillId,
      name: s.skill.name,
      isActive: s.skill.isActive,
      claimed: s.claimedByCandidate,
      verified: s.verified,
      evidenceScore: s.evidenceScore,
      evidenceCount: s.evidenceCount,
    })),
    education: p?.education ?? [],
    experience: p?.experience ?? [],
    projects: p?.projects ?? [],
    links: (p?.links ?? []).map((l) => ({ type: l.type, url: l.url })),
    preference: p?.preference
      ? {
          ...p.preference,
          opportunityTypes: p.preference.opportunityTypes.map(String),
        }
      : null,
    memberships: {
      program: row.programMembers.map((m) => ({
        memberId: m.id,
        cohortId: m.cohortId,
        status: m.status,
      })),
      challenge: row.enrollments.map((e) => ({
        domain: e.challenge.domain,
        submissions: e._count.submissions,
      })),
      hackathonWithSubmission: row.hackathonParticipants.length > 0,
    },
    legacy: {
      studentProfileSkills: row.studentProfile?.skills ?? null,
      studentProfileGradYear: row.studentProfile?.graduationYear ?? null,
      programMemberSkills: row.programMembers[0]?.skills ?? null,
    },
  };
}

export type CanonicalScope =
  /** Users whose visibility row says searchable — the superset of anyone eligible. */
  | "searchable"
  /** Users with a candidate profile — the data-quality population. */
  | "profiles";

function scopeWhere(scope: CanonicalScope): Prisma.UserWhereInput {
  return scope === "searchable"
    ? { visibility: { is: { searchableByRecruiters: true } } }
    : { candidateProfile: { isNot: null } };
}

export async function* iterateCanonicalCandidates(opts: {
  scope: CanonicalScope;
  batchSize?: number;
  onBatch?: (ms: number, rows: number) => void;
}): AsyncGenerator<CanonicalCandidate[]> {
  const take = Math.min(Math.max(opts.batchSize ?? 300, 50), 1000);
  let cursor: string | null = null;
  for (;;) {
    const started = performance.now();
    const rows: CanonicalRow[] = await prisma.user.findMany({
      where: {
        ...scopeWhere(opts.scope),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take,
      select: CANONICAL_SELECT,
    });
    opts.onBatch?.(performance.now() - started, rows.length);
    if (rows.length === 0) return;
    yield rows.map(toCanonical);
    if (rows.length < take) return;
    cursor = rows[rows.length - 1]!.id;
  }
}

export async function fetchCanonicalCandidates(
  userIds: string[],
): Promise<Map<string, CanonicalCandidate>> {
  const out = new Map<string, CanonicalCandidate>();
  const ids = [...new Set(userIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await prisma.user.findMany({
      where: { id: { in: ids.slice(i, i + 500) } },
      select: CANONICAL_SELECT,
    });
    for (const r of rows) out.set(r.id, toCanonical(r));
  }
  return out;
}

export async function listCohortsForAudit(): Promise<Map<string, PoolCohort>> {
  const rows = await prisma.programCohort.findMany({
    select: { id: true, status: true, resultsPublishedAt: true },
  });
  return new Map(
    rows.map((r) => [r.id, { id: r.id, status: r.status, published: r.resultsPublishedAt != null }]),
  );
}

export type PopulationCounts = {
  users: number;
  candidateUsers: number;
  deleted: number;
  disabled: number;
  withProfile: number;
  visibilityRows: number;
  searchableRows: number;
  usableProfileWithoutVisibilityRow: number;
  nonStudentSearchable: number;
};

export async function countPopulation(): Promise<PopulationCounts> {
  const [users, candidateUsers, deleted, disabled, withProfile, visibilityRows, searchableRows, noRow, nonStudent] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "STUDENT", deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: { not: null } } }),
      prisma.user.count({ where: { disabledAt: { not: null } } }),
      prisma.candidateProfile.count(),
      prisma.candidateVisibility.count(),
      prisma.candidateVisibility.count({ where: { searchableByRecruiters: true, withdrawnAt: null } }),
      prisma.user.count({
        where: {
          deletedAt: null,
          disabledAt: null,
          visibility: { is: null },
          candidateProfile: {
            is: { fullName: { not: "" }, skills: { some: { claimedByCandidate: true } } },
          },
        },
      }),
      prisma.user.count({
        where: {
          role: { not: "STUDENT" },
          visibility: { is: { searchableByRecruiters: true, withdrawnAt: null } },
        },
      }),
    ]);
  return {
    users,
    candidateUsers,
    deleted,
    disabled,
    withProfile,
    visibilityRows,
    searchableRows,
    usableProfileWithoutVisibilityRow: noRow,
    nonStudentSearchable: nonStudent,
  };
}

export async function sampleUsableProfilesWithoutVisibilityRow(take = 25): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      disabledAt: null,
      visibility: { is: null },
      candidateProfile: {
        is: { fullName: { not: "" }, skills: { some: { claimedByCandidate: true } } },
      },
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take,
  });
  return rows.map((r) => r.id);
}

type CountRow = { value: string | null; n: bigint | number };

function counts(rows: CountRow[]): { raw: string; count: number }[] {
  return rows
    .filter((r) => r.value != null)
    .map((r) => ({ raw: String(r.value), count: Number(r.n) }));
}

/** Search-value aggregates for choosing representative filter values. */
export async function searchValueStats(): Promise<{ skills: string[]; cities: string[] }> {
  const [skills, cities] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT s."name" AS value, COUNT(*) AS n
      FROM "CandidateSkill" cs
      JOIN "Skill" s ON s."id" = cs."skillId"
      JOIN "CandidateVisibility" v ON v."userId" = cs."userId"
      WHERE cs."claimedByCandidate" AND v."searchableByRecruiters" AND v."withdrawnAt" IS NULL
      GROUP BY s."name" ORDER BY n DESC, s."name" ASC LIMIT 12`,
    prisma.$queryRaw<CountRow[]>`
      SELECT loc AS value, COUNT(*) AS n
      FROM "CandidatePreference" p
      CROSS JOIN LATERAL unnest(p."preferredLocations") AS loc
      GROUP BY loc ORDER BY n DESC, loc ASC LIMIT 8`,
  ]);
  return {
    skills: counts(skills).map((s) => s.raw),
    cities: counts(cities).map((c) => c.raw),
  };
}

export type NormalizationInputs = {
  skillNames: { raw: string; count: number }[];
  preferredLocations: { raw: string; count: number }[];
  profileCities: { raw: string; count: number }[];
  workModes: { raw: string; count: number }[];
  degrees: { raw: string; count: number }[];
  institutions: { raw: string; count: number }[];
  institutionsUnlinked: number;
  fieldsOfStudy: { raw: string; count: number }[];
  jobTitles: { raw: string; count: number }[];
};

export async function normalizationInputs(): Promise<NormalizationInputs> {
  const [skillNames, preferredLocations, profileCities, workModes, degrees, institutions, unlinked, fields, titles] =
    await Promise.all([
      prisma.$queryRaw<CountRow[]>`
        SELECT s."name" AS value, COUNT(cs."id") AS n
        FROM "Skill" s LEFT JOIN "CandidateSkill" cs ON cs."skillId" = s."id" AND cs."claimedByCandidate"
        GROUP BY s."name"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT loc AS value, COUNT(*) AS n
        FROM "CandidatePreference" p CROSS JOIN LATERAL unnest(p."preferredLocations") AS loc
        GROUP BY loc`,
      prisma.$queryRaw<CountRow[]>`
        SELECT "locationCity" AS value, COUNT(*) AS n FROM "CandidateProfile"
        WHERE "locationCity" IS NOT NULL GROUP BY "locationCity"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT "remotePreference" AS value, COUNT(*) AS n FROM "CandidatePreference"
        WHERE "remotePreference" IS NOT NULL GROUP BY "remotePreference"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT "degree" AS value, COUNT(*) AS n FROM "CandidateEducation"
        WHERE "degree" IS NOT NULL GROUP BY "degree"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT "institutionName" AS value, COUNT(*) AS n FROM "CandidateEducation"
        GROUP BY "institutionName" ORDER BY n DESC LIMIT 5000`,
      prisma.candidateEducation.count({ where: { collegeId: null } }),
      prisma.$queryRaw<CountRow[]>`
        SELECT "fieldOfStudy" AS value, COUNT(*) AS n FROM "CandidateEducation"
        WHERE "fieldOfStudy" IS NOT NULL GROUP BY "fieldOfStudy"`,
      prisma.$queryRaw<CountRow[]>`
        SELECT "title" AS value, COUNT(*) AS n FROM "CandidateExperience"
        GROUP BY "title" ORDER BY n DESC LIMIT 5000`,
    ]);
  return {
    skillNames: counts(skillNames),
    preferredLocations: counts(preferredLocations),
    profileCities: counts(profileCities),
    workModes: counts(workModes),
    degrees: counts(degrees),
    institutions: counts(institutions),
    institutionsUnlinked: unlinked,
    fieldsOfStudy: counts(fields),
    jobTitles: counts(titles),
  };
}

/** College ids referenced by education rows that the catalog does not contain. */
export async function orphanCollegeReferences(): Promise<{ count: number; userIds: string[] }> {
  const rows = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT DISTINCT e."userId" FROM "CandidateEducation" e
    LEFT JOIN "College" c ON c."id" = e."collegeId"
    WHERE e."collegeId" IS NOT NULL AND c."id" IS NULL`;
  return { count: rows.length, userIds: rows.slice(0, 25).map((r) => r.userId) };
}

/** Saved match rows and sessions: the persisted copies of search results. */
export async function persistedResultHealth(): Promise<{
  matches: number;
  matchesForUnsearchable: number;
  unsearchableSample: string[];
  profileSourceMatches: number;
  sessionsWithDuplicateIds: number;
  sessionDuplicateSample: string[];
  enrollmentDomainMismatch: number;
  /** Saved matches sharing a score within one request — ordered by score alone on read. */
  scoreTieGroups: number;
}> {
  const notSearchable: Prisma.UserWhereInput = {
    OR: [
      { deletedAt: { not: null } },
      { disabledAt: { not: null } },
      { visibility: { is: null } },
      { visibility: { is: { searchableByRecruiters: false } } },
      { visibility: { is: { withdrawnAt: { not: null } } } },
    ],
  };
  const [matches, stale, staleSample, profileSource, dupSessions, domainMismatch, ties] = await Promise.all([
    prisma.talentRequestMatch.count(),
    prisma.talentRequestMatch.count({ where: { candidate: notSearchable } }),
    prisma.talentRequestMatch.findMany({
      where: { candidate: notSearchable },
      select: { candidateUserId: true },
      distinct: ["candidateUserId"],
      take: 25,
    }),
    prisma.talentRequestMatch.count({ where: { source: "PROFILE" } }),
    prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "TalentSearchSession"
      WHERE cardinality("resultCandidateIds") <> (SELECT COUNT(DISTINCT x) FROM unnest("resultCandidateIds") AS x)`,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM "Enrollment" e JOIN "Challenge" c ON c."id" = e."challengeId"
      WHERE e."domain" <> c."domain"`,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM (
        SELECT "requestId", "score" FROM "TalentRequestMatch"
        GROUP BY "requestId", "score" HAVING COUNT(*) > 1
      ) t`,
  ]);
  return {
    matches,
    matchesForUnsearchable: stale,
    unsearchableSample: staleSample.map((r) => r.candidateUserId),
    profileSourceMatches: profileSource,
    sessionsWithDuplicateIds: dupSessions.length,
    sessionDuplicateSample: dupSessions.slice(0, 25).map((r) => r.id),
    enrollmentDomainMismatch: Number(domainMismatch[0]?.n ?? 0),
    scoreTieGroups: Number(ties[0]?.n ?? 0),
  };
}

/**
 * People who must never be discoverable but who hold a track membership a
 * forged candidate ref could point at — the direct-API bypass probe.
 */
export async function sampleNeverAppearUsers(take = 40): Promise<
  { userId: string; programMemberIds: string[]; reason: string }[]
> {
  const hasMembership: Prisma.UserWhereInput = {
    OR: [
      { programMembers: { some: {} } },
      { enrollments: { some: { submissions: { some: {} } } } },
      { hackathonParticipants: { some: {} } },
      { candidateProfile: { is: { skills: { some: { claimedByCandidate: true } } } } },
    ],
  };
  const groups: [string, Prisma.UserWhereInput][] = [
    ["DELETED", { deletedAt: { not: null } }],
    ["DISABLED", { disabledAt: { not: null } }],
    ["NOT_SEARCHABLE", { visibility: { is: { searchableByRecruiters: false } } }],
    ["WITHDRAWN", { visibility: { is: { withdrawnAt: { not: null } } } }],
    ["NO_VISIBILITY_ROW", { visibility: { is: null } }],
  ];
  const per = Math.max(1, Math.ceil(take / groups.length));
  const out: { userId: string; programMemberIds: string[]; reason: string }[] = [];
  for (const [reason, where] of groups) {
    const rows = await prisma.user.findMany({
      where: { AND: [where, hasMembership] },
      select: { id: true, programMembers: { select: { id: true } } },
      orderBy: { id: "asc" },
      take: per,
    });
    for (const r of rows) {
      out.push({ userId: r.id, programMemberIds: r.programMembers.map((m) => m.id), reason });
    }
  }
  return out;
}

/** Cohort-track members whose legacy ProgramMember row exists without a canonical profile. */
export async function programMembersWithoutProfile(): Promise<number> {
  return programMember.count({
    where: { status: { in: ["ENROLLED", "COMPLETED"] }, user: { candidateProfile: { is: null } } },
  });
}
