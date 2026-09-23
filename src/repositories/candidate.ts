import "server-only";
import {
  CandidatePersona,
  OpportunityType,
  Prisma,
  UserType,
} from "@prisma/client";
import { prisma, writeClient } from "@/lib/db";
import {
  pickPrimaryEducation,
  pickPrimaryExperience,
  splitMonthDate,
  totalExperienceMonths,
} from "@/repositories/candidate-primary";
import {
  applyCandidateIdentityChange,
} from "@/repositories/candidate-identity";
import type { CandidateProfileView } from "@/repositories/types";

const legacyIdentitySelect = {
  userId: true,
  fullName: true,
  userType: true,
  college: true,
  collegeId: true,
  graduationYear: true,
  organization: true,
  role: true,
  yearsExperience: true,
  phone: true,
  phoneVerified: true,
  phoneVerifiedAt: true,
  linkedinUrl: true,
  githubUsername: true,
  resumeUrl: true,
  referralCode: true,
  skills: true,
  isReadyForInterview: true,
  isCampusAmbassadorCandidate: true,
  ambassadorDismissedAt: true,
} as const;

const newIdentitySelect = {
  userId: true,
  fullName: true,
  headline: true,
  primaryPersona: true,
  phone: true,
  phoneVerified: true,
  phoneVerifiedAt: true,
  linkedinUrl: true,
  githubUsername: true,
  resumeUrl: true,
  referralCode: true,
  isReadyForInterview: true,
  isCampusAmbassadorCandidate: true,
  ambassadorDismissedAt: true,
  // No id filter: a candidate may own many rows, and the one legacy surfaces
  // need is chosen by `pickPrimary*`, not by a migration-era deterministic id.
  education: {
    select: {
      institutionName: true,
      collegeId: true,
      startYear: true,
      startMonth: true,
      graduationYear: true,
      endMonth: true,
      isCurrent: true,
      sortOrder: true,
    },
  },
  experience: {
    select: {
      companyName: true,
      title: true,
      startedOn: true,
      endedOn: true,
      isCurrent: true,
    },
  },
  // Only live claims mirror into the legacy string array; a withdrawn claim
  // keeps its row (and its evidence) but is no longer something the candidate
  // asserts, so it must not read back as a declared skill.
  skills: {
    where: { claimedByCandidate: true },
    select: { skill: { select: { name: true } } },
  },
} as const;

function userTypeFromPersona(persona: string): "STUDENT" | "PROFESSIONAL" {
  return persona === "PROFESSIONAL" ? "PROFESSIONAL" : "STUDENT";
}

function viewFromLegacy(row: {
  userId: string;
  fullName: string;
  userType: UserType;
  college: string | null;
  collegeId: string | null;
  graduationYear: number | null;
  organization: string | null;
  role: string | null;
  yearsExperience: number | null;
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  linkedinUrl: string | null;
  githubUsername: string | null;
  resumeUrl: string | null;
  referralCode: string;
  skills: string[];
  isReadyForInterview: boolean;
  isCampusAmbassadorCandidate: boolean;
  ambassadorDismissedAt: Date | null;
}): CandidateProfileView {
  return {
    userId: row.userId,
    fullName: row.fullName,
    headline: null,
    phone: row.phone,
    phoneVerified: row.phoneVerified,
    phoneVerifiedAt: row.phoneVerifiedAt,
    linkedinUrl: row.linkedinUrl,
    githubUsername: row.githubUsername,
    resumeUrl: row.resumeUrl,
    referralCode: row.referralCode,
    skills: row.skills,
    isReadyForInterview: row.isReadyForInterview,
    userType: userTypeFromPersona(row.userType),
    college: row.college,
    collegeId: row.collegeId,
    graduationYear: row.graduationYear,
    organization: row.organization,
    role: row.role,
    yearsExperience: row.yearsExperience,
    isCampusAmbassadorCandidate: row.isCampusAmbassadorCandidate,
    ambassadorDismissedAt: row.ambassadorDismissedAt,
  };
}

function viewFromNew(
  row: {
    userId: string;
    fullName: string;
    headline: string | null;
    primaryPersona: CandidatePersona;
    phone: string | null;
    phoneVerified: boolean;
    phoneVerifiedAt: Date | null;
    linkedinUrl: string | null;
    githubUsername: string | null;
    resumeUrl: string | null;
    referralCode: string;
    isReadyForInterview: boolean;
    isCampusAmbassadorCandidate: boolean;
    ambassadorDismissedAt: Date | null;
    education: Array<{
      institutionName: string;
      collegeId: string | null;
      startYear: number | null;
      startMonth: number | null;
      graduationYear: number | null;
      endMonth: number | null;
      isCurrent: boolean;
      sortOrder: number;
    }>;
    experience: Array<{
      companyName: string;
      title: string;
      startedOn: Date;
      endedOn: Date | null;
      isCurrent: boolean;
    }>;
    skills: Array<{ skill: { name: string } }>;
  },
): CandidateProfileView {
  const education = pickPrimaryEducation(row.education);

  const experienceRows = row.experience.map((e) => {
    const start = splitMonthDate(e.startedOn);
    const end = splitMonthDate(e.endedOn);
    return {
      companyName: e.companyName,
      title: e.title,
      startMonth: start.month ?? 1,
      startYear: start.year ?? 0,
      endMonth: end.month,
      endYear: end.year,
      isCurrent: e.isCurrent,
    };
  });
  const experience = pickPrimaryExperience(experienceRows);

  return {
    userId: row.userId,
    fullName: row.fullName,
    headline: row.headline,
    phone: row.phone,
    phoneVerified: row.phoneVerified,
    phoneVerifiedAt: row.phoneVerifiedAt,
    linkedinUrl: row.linkedinUrl,
    githubUsername: row.githubUsername,
    resumeUrl: row.resumeUrl,
    referralCode: row.referralCode,
    skills: row.skills.map((s) => s.skill.name),
    isReadyForInterview: row.isReadyForInterview,
    userType: userTypeFromPersona(row.primaryPersona),
    college: unspecifiedToNull(education?.institutionName),
    collegeId: education?.collegeId ?? null,
    graduationYear: education?.graduationYear ?? null,
    organization: unspecifiedToNull(experience?.companyName),
    role: unspecifiedToNull(experience?.title),
    // Merged span across every role, not the primary row's own duration —
    // this is what `/hire`'s "minimum years" filter compares against.
    yearsExperience:
      experienceRows.length > 0
        ? Math.floor(totalExperienceMonths(experienceRows) / 12)
        : null,
    isCampusAmbassadorCandidate: row.isCampusAmbassadorCandidate,
    ambassadorDismissedAt: row.ambassadorDismissedAt,
  };
}

function unspecifiedToNull(value: string | undefined): string | null {
  if (!value || value === "Not specified") return null;
  return value;
}

export async function getCandidateProfile(
  userId: string,
): Promise<CandidateProfileView | null> {
const row = await prisma.candidateProfile.findUnique({
  where: { userId },
  select: newIdentitySelect,
});
if (!row) return null;
return viewFromNew(row);
}

export async function listCandidateProfiles(
  userIds: string[],
): Promise<Map<string, CandidateProfileView>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

const rows = await prisma.candidateProfile.findMany({
  where: { userId: { in: ids } },
  select: newIdentitySelect,
});
return new Map(rows.map((row) => [row.userId, viewFromNew(row)]));
}

/** Current-state display names for admin/CSV. Never reads frozen SP identity. */
export async function canonicalFullNameByUserId(
  userIds: string[],
): Promise<Map<string, string>> {
  const profiles = await listCandidateProfiles(userIds);
  const out = new Map<string, string>();
  for (const [id, profile] of profiles) out.set(id, profile.fullName);
  return out;
}

export async function getProfileSummary(userId: string): Promise<{
  fullName: string;
  referralCode: string;
} | null> {
  const profile = await getCandidateProfile(userId);
  if (!profile) return null;
  return { fullName: profile.fullName, referralCode: profile.referralCode };
}

/**
 * Resolve a pasted/shared referral code to a user.
 * Flag off: StudentProfile (legacy unique). Flag on: CandidateProfile
 * (canonical unique). Frozen StudentProfile.referralCode remains a collision
 * namespace for generation, not a live lookup source.
 */
export async function findUserIdByReferralCode(
  code: string,
): Promise<string | null> {
const row = await prisma.candidateProfile.findUnique({
  where: { referralCode: code },
  select: { userId: true },
});
return row?.userId ?? null;
}

function skillSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function resolveOrCreateSkillId(
  tx: Prisma.TransactionClient,
  raw: string,
): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const slug = skillSlug(trimmed);
  if (!slug) return null;
  const key = trimmed.toLowerCase();

  const bySlug = await tx.skill.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (bySlug) return bySlug.id;

  const byNameOrAlias = await tx.skill.findFirst({
    where: {
      OR: [
        { name: { equals: trimmed, mode: "insensitive" } },
        { aliases: { has: key } },
        { aliases: { has: trimmed } },
      ],
    },
    select: { id: true },
  });
  if (byNameOrAlias) return byNameOrAlias.id;

  try {
    const created = await tx.skill.create({
      data: { slug, name: trimmed },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const again = await tx.skill.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (again) return again.id;
    }
    throw e;
  }
}

export async function syncCandidateSkillsFromLegacy(
  tx: Prisma.TransactionClient,
  userId: string,
  declared: string[],
): Promise<void> {
  for (const raw of declared) {
    const skillId = await resolveOrCreateSkillId(tx, raw);
    if (!skillId) continue;
    await tx.candidateSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId, claimedByCandidate: true },
      update: {},
    });
  }
}

export async function updateCandidateLinks(
  userId: string,
  data: { linkedinUrl: string; githubUsername: string; skills: string[] },
): Promise<void> {
  await writeClient().$transaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    await applyCandidateIdentityChange(tx, userId, {
      linkedinUrl: data.linkedinUrl,
      githubUsername: data.githubUsername,
    });
    await syncCandidateSkillsFromLegacy(tx, userId, data.skills);
  });
}

/* ─── Candidate availability (078 `CandidatePreference`) ────────────────────
 *
 * `/hire` used to carry its own `CandidateAvailability` model. Every column it
 * held already exists on `CandidatePreference`, which shipped with the 078
 * additive schema, so the duplicate was dropped rather than merged and later
 * unwound in Phase 8. Three names differ; the mapping is here and nowhere else:
 *
 *   preferredWorkMode  → CandidatePreference.remotePreference
 *   preferredCities    → CandidatePreference.preferredLocations
 *   openToRelocate     → CandidatePreference.willingToRelocate
 *
 * `openToWork` lives here and is INDEPENDENT of recruiter discoverability,
 * which is `CandidateVisibility.searchableByRecruiters` and is enforced only in
 * `repositories/talent.ts`. A candidate can be searchable and not looking.
 */

/** The shape `/hire` reads. Deliberately the hire vocabulary, not the schema's. */
export type CandidateAvailabilityView = {
  userId: string;
  openToWork: boolean;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  salaryCurrency: string;
  noticePeriodDays: number | null;
  preferredWorkMode: string | null;
  preferredCities: string[];
  openToRelocate: boolean;
  /**
   * What the candidate is open to: INTERNSHIP / FULL_TIME / PART_TIME /
   * CONTRACT / FREELANCE. EMPTY MEANS UNSTATED, never "open to nothing" — a
   * filter must not exclude on it. The column has always existed; nothing read
   * it until the recruiter engagement-type filter (plan 117).
   */
  opportunityTypes: OpportunityType[];
};

export type CandidateAvailabilityWrite = {
  openToWork: boolean;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  salaryCurrency: string;
  noticePeriodDays: number | null;
  preferredWorkMode: string | null;
  preferredCities: string[];
  openToRelocate: boolean;
};

/**
 * Batched read. Returns an empty map rather than throwing: a dossier is still
 * worth showing without logistics, and one unreadable table must not take the
 * whole search down.
 */
export async function listCandidateAvailability(
  userIds: string[],
): Promise<Map<string, CandidateAvailabilityView>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const rows = await prisma.candidatePreference.findMany({
    where: { userId: { in: ids } },
    select: {
      userId: true,
      openToWork: true,
      expectedSalaryMin: true,
      expectedSalaryMax: true,
      salaryCurrency: true,
      noticePeriodDays: true,
      remotePreference: true,
      preferredLocations: true,
      willingToRelocate: true,
      opportunityTypes: true,
    },
  });

  return new Map(
    rows.map((r) => [
      r.userId,
      {
        userId: r.userId,
        openToWork: r.openToWork,
        expectedSalaryMin: r.expectedSalaryMin,
        expectedSalaryMax: r.expectedSalaryMax,
        salaryCurrency: r.salaryCurrency ?? "INR",
        noticePeriodDays: r.noticePeriodDays,
        preferredWorkMode: r.remotePreference,
        preferredCities: r.preferredLocations,
        openToRelocate: r.willingToRelocate,
        opportunityTypes: r.opportunityTypes,
      },
    ]),
  );
}

const REFERRAL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomReferralCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)]!;
  }
  return out;
}

async function mintHireOnlyReferralCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomReferralCode();
    const onCandidate = await tx.candidateProfile.findUnique({
      where: { referralCode: code },
      select: { userId: true },
    });
    if (!onCandidate) return code;
  }
  throw new Error("Could not mint unique hire-only referral code");
}

/**
 * `CandidatePreference.userId` is an FK to `CandidateProfile`, not to `User`.
 * If StudentProfile exists, CandidateProfile copies that live referral code.
 * 8-character codes are only for users with no StudentProfile (hire-only).
 */
export async function ensureCandidateProfile(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const existing = await tx.candidateProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (existing) return;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const fullName =
    user?.name?.trim() ||
    user?.email?.split("@")[0] ||
    "Unknown";

  const referralCode = await mintHireOnlyReferralCode(tx);

  await tx.candidateProfile.create({
    data: {
      userId,
      fullName,
      primaryPersona: "STUDENT",
      phone: null,
      phoneVerified: false,
      phoneVerifiedAt: null,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      referralCode,
      isReadyForInterview: false,
    },
  });
}

/**
 * Write the candidate's own logistics. Never touches `CandidateVisibility` —
 * stating you are open to work is not consent to be discovered, and the two
 * must not be wired to each other.
 */
export async function upsertCandidateAvailability(
  userId: string,
  input: CandidateAvailabilityWrite,
): Promise<void> {
  const data = {
    openToWork: input.openToWork,
    expectedSalaryMin: input.expectedSalaryMin,
    expectedSalaryMax: input.expectedSalaryMax,
    salaryCurrency: input.salaryCurrency,
    noticePeriodDays: input.noticePeriodDays,
    remotePreference: input.preferredWorkMode,
    preferredLocations: input.preferredCities,
    willingToRelocate: input.openToRelocate,
  };

  await prisma.$transaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    await tx.candidatePreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  });
}
