import "server-only";
import {
  CandidateGender,
  CandidateLinkType,
  CandidatePersona,
  GradeType,
  OpportunityType,
  Prisma,
  UserType,
} from "@prisma/client";
import { prisma, writeClient } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureCandidateProfile } from "@/repositories/candidate";
import {
  pickPrimaryEducation,
  pickPrimaryExperience,
  splitMonthDate,
  toMonthDate,
  totalExperienceMonths,
} from "@/repositories/candidate-primary";

/**
 * The detailed candidate profile: reads and writes for the sections that only
 * exist on the 078 candidate tables.
 *
 * These sections have NO legacy equivalent — `StudentProfile` never held more
 * than one college and one employer — so there is nothing to read through
 * `ENABLE_NEW_CANDIDATE`. The flag stays on `repositories/candidate.ts`, which
 * serves the seven overlapping identity fields; everything here is canonical by
 * construction and behaves identically whatever the flag says.
 *
 * Writes go canonical-first and then mirror DOWN into `StudentProfile` using the
 * primary-row rule below. The `edu_sp_*` / `exp_sp_*` rows minted by the Phase 2
 * migration are compatibility artifacts, not a source of truth: a section save
 * replaces the whole list and they disappear with it.
 */

type Tx = Prisma.TransactionClient;

/* ─── Views ──────────────────────────────────────────────────────────────── */

export type EducationView = {
  id: string;
  institutionName: string;
  collegeId: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  graduationYear: number | null;
  isCurrent: boolean;
  gradeType: GradeType | null;
  grade: string | null;
  description: string | null;
};

export type ExperienceView = {
  id: string;
  companyName: string;
  title: string;
  employmentType: string | null;
  locationCity: string | null;
  startMonth: number;
  startYear: number;
  endMonth: number | null;
  endYear: number | null;
  isCurrent: boolean;
  totalMonths: number;
  description: string | null;
};

export type ProjectView = {
  id: string;
  title: string;
  description: string | null;
  techStack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
};

export type CertificationView = {
  id: string;
  name: string;
  issuer: string;
  issuedMonth: number | null;
  issuedYear: number | null;
  expiresMonth: number | null;
  expiresYear: number | null;
  credentialUrl: string | null;
};

export type SkillClaimView = {
  skillId: string;
  name: string;
  slug: string;
  categoryName: string | null;
  claimedByCandidate: boolean;
  /** Derived from `SkillEvidence` only. Never influenced by `selfRated`. */
  verified: boolean;
  evidenceScore: number;
  evidenceCount: number;
  lastEvidenceAt: Date | null;
};

export type LinkView = {
  id: string;
  type: CandidateLinkType;
  label: string | null;
  url: string;
  sortOrder: number;
};

export type PreferenceView = {
  openToWork: boolean;
  preferredRoles: string[];
  preferredLocations: string[];
  opportunityTypes: OpportunityType[];
  remotePreference: string | null;
  willingToRelocate: boolean;
  noticePeriodDays: number | null;
  availableFromMonth: number | null;
  availableFromYear: number | null;
};

export type CandidateDetail = {
  userId: string;
  fullName: string;
  headline: string | null;
  summary: string | null;
  /** Candidate-authored awards prose. Null when never written. */
  awards: string | null;
  gender: CandidateGender | null;
  primaryPersona: CandidatePersona;
  phone: string | null;
  phoneVerified: boolean;
  locationCity: string | null;
  locationRegion: string | null;
  countryCode: string | null;
  linkedinUrl: string | null;
  githubUsername: string | null;
  portfolioUrl: string | null;
  resumeUrl: string | null;
  /**
   * Explicit fresher skip for profile completion. Ignored for scoring when
   * any experience row exists — rows win.
   */
  hasNoWorkExperience: boolean;
  referralCode: string;
  isReadyForInterview: boolean;
  updatedAt: Date;
  education: EducationView[];
  experience: ExperienceView[];
  projects: ProjectView[];
  certifications: CertificationView[];
  skills: SkillClaimView[];
  links: LinkView[];
  preference: PreferenceView | null;
};

/* ─── Read ───────────────────────────────────────────────────────────────── */

export async function getCandidateDetail(
  userId: string,
): Promise<CandidateDetail | null> {
  const row = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      fullName: true,
      headline: true,
      summary: true,
      awards: true,
      gender: true,
      primaryPersona: true,
      phone: true,
      phoneVerified: true,
      locationCity: true,
      locationRegion: true,
      countryCode: true,
      linkedinUrl: true,
      githubUsername: true,
      portfolioUrl: true,
      resumeUrl: true,
      hasNoWorkExperience: true,
      referralCode: true,
      isReadyForInterview: true,
      updatedAt: true,
      education: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          institutionName: true,
          collegeId: true,
          degree: true,
          fieldOfStudy: true,
          startMonth: true,
          startYear: true,
          endMonth: true,
          graduationYear: true,
          isCurrent: true,
          gradeType: true,
          grade: true,
          description: true,
        },
      },
      experience: {
        orderBy: [{ isCurrent: "desc" }, { startedOn: "desc" }],
        select: {
          id: true,
          companyName: true,
          title: true,
          employmentType: true,
          locationCity: true,
          startedOn: true,
          endedOn: true,
          isCurrent: true,
          totalMonths: true,
          description: true,
        },
      },
      projects: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          techStack: true,
          repoUrl: true,
          liveUrl: true,
        },
      },
      certifications: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          issuer: true,
          issuedOn: true,
          expiresOn: true,
          credentialUrl: true,
        },
      },
      links: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          label: true,
          url: true,
          sortOrder: true,
        },
      },
      skills: {
        orderBy: [{ evidenceScore: "desc" }, { createdAt: "asc" }],
        select: {
          skillId: true,
          claimedByCandidate: true,
          verified: true,
          evidenceScore: true,
          evidenceCount: true,
          lastEvidenceAt: true,
          skill: {
            select: {
              name: true,
              slug: true,
              category: { select: { name: true } },
            },
          },
        },
      },
      preference: {
        select: {
          openToWork: true,
          preferredRoles: true,
          preferredLocations: true,
          opportunityTypes: true,
          remotePreference: true,
          willingToRelocate: true,
          noticePeriodDays: true,
          availableFrom: true,
        },
      },
    },
  });

  if (!row) return null;

  const available = splitMonthDate(row.preference?.availableFrom ?? null);

  return {
    userId: row.userId,
    fullName: row.fullName,
    headline: row.headline,
    summary: row.summary,
    awards: row.awards,
    gender: row.gender,
    primaryPersona: row.primaryPersona,
    phone: row.phone,
    phoneVerified: row.phoneVerified,
    locationCity: row.locationCity,
    locationRegion: row.locationRegion,
    countryCode: row.countryCode,
    linkedinUrl: row.linkedinUrl,
    githubUsername: row.githubUsername,
    portfolioUrl: row.portfolioUrl,
    resumeUrl: row.resumeUrl,
    hasNoWorkExperience: row.hasNoWorkExperience,
    referralCode: row.referralCode,
    isReadyForInterview: row.isReadyForInterview,
    updatedAt: row.updatedAt,
    education: row.education.map((e) => ({ ...e })),
    experience: row.experience.map((e) => {
      const start = splitMonthDate(e.startedOn);
      const end = splitMonthDate(e.endedOn);
      return {
        id: e.id,
        companyName: e.companyName,
        title: e.title,
        employmentType: e.employmentType,
        locationCity: e.locationCity,
        startMonth: start.month ?? 1,
        startYear: start.year ?? new Date().getUTCFullYear(),
        endMonth: end.month,
        endYear: end.year,
        isCurrent: e.isCurrent,
        totalMonths: e.totalMonths,
        description: e.description,
      };
    }),
    projects: row.projects.map((p) => ({ ...p })),
    certifications: row.certifications.map((c) => {
      const issued = splitMonthDate(c.issuedOn);
      const expires = splitMonthDate(c.expiresOn);
      return {
        id: c.id,
        name: c.name,
        issuer: c.issuer,
        issuedMonth: issued.month,
        issuedYear: issued.year,
        expiresMonth: expires.month,
        expiresYear: expires.year,
        credentialUrl: c.credentialUrl,
      };
    }),
    skills: row.skills.map((s) => ({
      skillId: s.skillId,
      name: s.skill.name,
      slug: s.skill.slug,
      categoryName: s.skill.category?.name ?? null,
      claimedByCandidate: s.claimedByCandidate,
      verified: s.verified,
      evidenceScore: s.evidenceScore,
      evidenceCount: s.evidenceCount,
      lastEvidenceAt: s.lastEvidenceAt,
    })),
    links: row.links.map((l) => ({ ...l })),
    preference: row.preference
      ? {
          openToWork: row.preference.openToWork,
          preferredRoles: row.preference.preferredRoles,
          preferredLocations: row.preference.preferredLocations,
          opportunityTypes: row.preference.opportunityTypes,
          remotePreference: row.preference.remotePreference,
          willingToRelocate: row.preference.willingToRelocate,
          noticePeriodDays: row.preference.noticePeriodDays,
          availableFromMonth: available.month,
          availableFromYear: available.year,
        }
      : null,
  };
}

/**
 * Recruiter-safe work history for the Scout inspector.
 *
 * Deliberately not `getCandidateDetail`: that select carries phone, LinkedIn,
 * GitHub and resume URL. This read returns only the skip flag and the job
 * rows the candidate typed or resume-merge wrote. Callers must still prove
 * the candidate is in the searchable pool before invoking it.
 */
export type PublicWorkHistory = {
  hasNoWorkExperience: boolean;
  rows: ExperienceView[];
};

export async function listPublicWorkHistory(
  userId: string,
): Promise<PublicWorkHistory> {
  const row = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      hasNoWorkExperience: true,
      experience: {
        orderBy: [{ isCurrent: "desc" }, { startedOn: "desc" }],
        select: {
          id: true,
          companyName: true,
          title: true,
          employmentType: true,
          locationCity: true,
          startedOn: true,
          endedOn: true,
          isCurrent: true,
          totalMonths: true,
          description: true,
        },
      },
    },
  });

  if (!row) {
    return { hasNoWorkExperience: false, rows: [] };
  }

  return {
    hasNoWorkExperience: row.hasNoWorkExperience,
    rows: row.experience.map((e) => {
      const start = splitMonthDate(e.startedOn);
      const end = splitMonthDate(e.endedOn);
      return {
        id: e.id,
        companyName: e.companyName,
        title: e.title,
        employmentType: e.employmentType,
        locationCity: e.locationCity,
        startMonth: start.month ?? 1,
        startYear: start.year ?? new Date().getUTCFullYear(),
        endMonth: end.month,
        endYear: end.year,
        isCurrent: e.isCurrent,
        totalMonths: e.totalMonths,
        description: e.description,
      };
    }),
  };
}

/* ─── Legacy compatibility mirrors ───────────────────────────────────────── */

/**
 * Mirror the primary education row into the legacy snapshot columns.
 *
 * One direction only: canonical → legacy. `StudentProfile` is still read by
 * flows that have not moved, so it must stay current, but nothing here treats
 * it as a source. A user with no `StudentProfile` (hire-only) is skipped.
 */
async function mirrorEducationToLegacy(tx: Tx, userId: string): Promise<void> {
  const rows = await tx.candidateEducation.findMany({
    where: { userId },
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
  });
  // An empty list clears the mirror rather than leaving it stale. A candidate
  // who deleted their education should not still have a college showing on
  // admin and recruiter surfaces that read the legacy row.
  const primary = pickPrimaryEducation(rows);

  await tx.studentProfile.updateMany({
    where: { userId },
    data: {
      college: primary?.institutionName ?? null,
      collegeId: primary?.collegeId ?? null,
      graduationYear: primary?.graduationYear ?? null,
    },
  });
}

/** Company/role come from the primary row; years come from the merged span. */
async function mirrorExperienceToLegacy(tx: Tx, userId: string): Promise<void> {
  const rows = await tx.candidateExperience.findMany({
    where: { userId },
    select: {
      companyName: true,
      title: true,
      startedOn: true,
      endedOn: true,
      isCurrent: true,
    },
  });

  const shaped = rows.map((r) => {
    const start = splitMonthDate(r.startedOn);
    const end = splitMonthDate(r.endedOn);
    return {
      companyName: r.companyName,
      title: r.title,
      startMonth: start.month ?? 1,
      startYear: start.year ?? 0,
      endMonth: end.month,
      endYear: end.year,
      isCurrent: r.isCurrent,
    };
  });

  // Cleared on an empty list, for the same reason as education.
  const primary = pickPrimaryExperience(shaped);

  await tx.studentProfile.updateMany({
    where: { userId },
    data: {
      organization: primary?.companyName ?? null,
      role: primary?.title ?? null,
      yearsExperience:
        shaped.length > 0
          ? Math.floor(totalExperienceMonths(shaped) / 12)
          : null,
    },
  });
}

/**
 * Mirror the candidate's live skill claims into the legacy string array.
 *
 * The array is a compatibility subset, never an authority: it is overwritten
 * from `CandidateSkill` and is not read back. Withdrawn claims drop out of it
 * while their rows and evidence stay put.
 */
async function mirrorSkillsToLegacy(tx: Tx, userId: string): Promise<void> {
  const claimed = await tx.candidateSkill.findMany({
    where: { userId, claimedByCandidate: true },
    orderBy: { createdAt: "asc" },
    select: { skill: { select: { name: true } } },
  });
  await tx.studentProfile.updateMany({
    where: { userId },
    data: { skills: claimed.map((c) => c.skill.name) },
  });
}

/* ─── Writes ─────────────────────────────────────────────────────────────── */

function runInTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return writeClient().$transaction(fn, { maxWait: 10000, timeout: 20000 });
}

export type BasicInfoWrite = {
  fullName: string;
  phone: string | null;
  headline: string | null;
  summary: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  countryCode: string | null;
  gender: CandidateGender | null;
  primaryPersona: CandidatePersona;
};

/**
 * Only the fields this section owns are written. Nothing here reads
 * `StudentProfile` first, so a richer canonical value (a LinkedIn URL migrated
 * from `ProgramMember` where the legacy row was null) is never cleared as a
 * side effect of editing a name.
 *
 * `phoneVerified` is untouched: verification is owned by the OTP flow.
 * `domain` is untouched: it is a challenge-track selector, not identity.
 */
export async function saveBasicInfo(
  userId: string,
  input: BasicInfoWrite,
): Promise<void> {
  await runInTransaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    await tx.candidateProfile.update({
      where: { userId },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        headline: input.headline,
        summary: input.summary,
        locationCity: input.locationCity,
        locationRegion: input.locationRegion,
        countryCode: input.countryCode,
        gender: input.gender,
        primaryPersona: input.primaryPersona,
      },
    });

    // Legacy mirror: only the columns StudentProfile actually has.
    await tx.studentProfile.updateMany({
      where: { userId },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        userType:
          input.primaryPersona === CandidatePersona.PROFESSIONAL
            ? UserType.PROFESSIONAL
            : UserType.STUDENT,
      },
    });
  });
}

export type EducationWrite = {
  institutionName: string;
  collegeId: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  graduationYear: number | null;
  isCurrent: boolean;
  gradeType: GradeType | null;
  grade: string | null;
  description: string | null;
};

/**
 * Full replace. The list is candidate-authored and nothing references an
 * education row's id, so replacing is simpler and safer than diffing — and it
 * is what finally clears the `edu_sp_*` compatibility row: once the candidate
 * owns real rows, the migration artifact is gone rather than competing.
 */
export async function saveEducation(
  userId: string,
  rows: readonly EducationWrite[],
): Promise<void> {
  await runInTransaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    await tx.candidateEducation.deleteMany({ where: { userId } });
    if (rows.length > 0) {
      await tx.candidateEducation.createMany({
        data: rows.map((r, i) => ({
          userId,
          institutionName: r.institutionName,
          collegeId: r.collegeId,
          degree: r.degree,
          fieldOfStudy: r.fieldOfStudy,
          startMonth: r.startMonth,
          startYear: r.startYear,
          endMonth: r.isCurrent ? null : r.endMonth,
          graduationYear: r.isCurrent ? null : r.graduationYear,
          isCurrent: r.isCurrent,
          gradeType: r.gradeType,
          grade: r.grade,
          description: r.description,
          sortOrder: i,
        })),
      });
    }
    await mirrorEducationToLegacy(tx, userId);
  });
}

export type ExperienceWrite = {
  companyName: string;
  title: string;
  employmentType: string | null;
  locationCity: string | null;
  /**
   * Nullable at the boundary because nothing in the profile is mandatory, but
   * `CandidateExperience.startedOn` is NOT NULL — so a row that reaches here
   * without a start year is dropped rather than written with a made-up date.
   * The Zod schema already refuses it with a message; this is the backstop.
   */
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  endYear: number | null;
  isCurrent: boolean;
  description: string | null;
};

export async function saveExperience(
  userId: string,
  rows: readonly ExperienceWrite[],
  hasNoWorkExperience = false,
): Promise<void> {
  const now = new Date();
  await runInTransaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    await tx.candidateExperience.deleteMany({ where: { userId } });
    const dated = rows.filter(
      (r): r is ExperienceWrite & { startYear: number } => r.startYear !== null,
    );
    if (dated.length > 0) {
      await tx.candidateExperience.createMany({
        data: dated.map((r) => ({
          userId,
          companyName: r.companyName,
          title: r.title,
          employmentType: r.employmentType,
          locationCity: r.locationCity,
          startedOn: toMonthDate(r.startYear, r.startMonth ?? 1),
          endedOn:
            r.isCurrent || r.endYear === null || r.endMonth === null
              ? null
              : toMonthDate(r.endYear, r.endMonth),
          isCurrent: r.isCurrent,
          // Per-row cache; the merged span is computed separately for legacy.
          totalMonths: totalExperienceMonths(
            [{ ...r, startMonth: r.startMonth ?? 1 }],
            now,
          ),
          description: r.description,
        })),
      });
    }
    await tx.candidateProfile.update({
      where: { userId },
      data: {
        // Rows win: a saved role clears the fresher skip.
        hasNoWorkExperience: hasNoWorkExperience && dated.length === 0,
      },
      select: { userId: true },
    });
    await mirrorExperienceToLegacy(tx, userId);
  });
}

export type ProjectWrite = {
  title: string;
  description: string | null;
  techStack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
};

export async function saveProjects(
  userId: string,
  rows: readonly ProjectWrite[],
): Promise<void> {
  await runInTransaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    await tx.candidateProjectEntry.deleteMany({ where: { userId } });
    if (rows.length > 0) {
      await tx.candidateProjectEntry.createMany({
        data: rows.map((r, i) => ({
          userId,
          title: r.title,
          description: r.description,
          techStack: r.techStack,
          repoUrl: r.repoUrl,
          liveUrl: r.liveUrl,
          sortOrder: i,
        })),
      });
    }
  });
}

export type CertificationWrite = {
  name: string;
  issuer: string;
  issuedMonth: number | null;
  issuedYear: number | null;
  expiresMonth: number | null;
  expiresYear: number | null;
  credentialUrl: string | null;
};

/**
 * The Accomplishments section: the external certification list and the awards
 * prose, written together because the section is one form with one Save.
 *
 * `awards: undefined` leaves the stored prose untouched.
 *
 * Verified Accomplishments are absent on purpose: they are derived in
 * features/profile/get-verified-accomplishments.ts and have no write path.
 */
export async function saveAccomplishments(
  userId: string,
  value: {
    rows: readonly CertificationWrite[];
    /** `undefined` leaves the stored awards text untouched. */
    awards?: string | null;
  },
): Promise<void> {
  const { rows, awards } = value;
  await runInTransaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    if (awards !== undefined) {
      await tx.candidateProfile.update({
        where: { userId },
        data: { awards },
        select: { userId: true },
      });
    }
    await tx.candidateCertification.deleteMany({ where: { userId } });
    if (rows.length > 0) {
      await tx.candidateCertification.createMany({
        data: rows.map((r) => ({
          userId,
          name: r.name,
          issuer: r.issuer,
          issuedOn:
            r.issuedYear === null
              ? null
              : toMonthDate(r.issuedYear, r.issuedMonth ?? 1),
          expiresOn:
            r.expiresYear === null
              ? null
              : toMonthDate(r.expiresYear, r.expiresMonth ?? 1),
          credentialUrl: r.credentialUrl,
        })),
      });
    }
  });
}

export type LinksWrite = {
  linkedinUrl: string | null;
  githubUsername: string | null;
  portfolioUrl: string | null;
  /** `undefined` leaves the stored resume link untouched. */
  resumeUrl?: string | null;
  extra: readonly {
    type: CandidateLinkType;
    label: string | null;
    url: string;
  }[];
};

export async function saveLinks(
  userId: string,
  input: LinksWrite,
): Promise<void> {
  await runInTransaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    await tx.candidateProfile.update({
      where: { userId },
      data: {
        linkedinUrl: input.linkedinUrl,
        githubUsername: input.githubUsername,
        portfolioUrl: input.portfolioUrl,
        // Spread, not a plain assignment: the resume moved to its own section
        // (plan 106), so the Links form no longer sends this field and writing
        // `undefined` as `null` would silently detach an uploaded resume.
        ...(input.resumeUrl === undefined ? {} : { resumeUrl: input.resumeUrl }),
      },
    });

    await tx.candidateLink.deleteMany({ where: { userId } });
    if (input.extra.length > 0) {
      await tx.candidateLink.createMany({
        data: input.extra.map((l, i) => ({
          userId,
          type: l.type,
          label: l.label,
          url: l.url,
          sortOrder: i,
        })),
      });
    }

    // StudentProfile has no portfolio column — only the three it knows about.
    await tx.studentProfile.updateMany({
      where: { userId },
      data: {
        linkedinUrl: input.linkedinUrl,
        githubUsername: input.githubUsername,
        ...(input.resumeUrl === undefined ? {} : { resumeUrl: input.resumeUrl }),
      },
    });
  });
}

export type PreferencesWrite = {
  openToWork: boolean;
  preferredRoles: string[];
  preferredLocations: string[];
  opportunityTypes: OpportunityType[];
  remotePreference: string | null;
  willingToRelocate: boolean;
  noticePeriodDays: number | null;
  availableFromMonth: number | null;
  availableFromYear: number | null;
};

/**
 * Employment preference only.
 *
 * `CandidateVisibility` is deliberately not touched here. Saying you are open
 * to work is not consent to be discovered by recruiters, and wiring the two
 * together would silently change who can find this candidate.
 */
export async function savePreferences(
  userId: string,
  input: PreferencesWrite,
): Promise<void> {
  const availableFrom =
    input.availableFromYear === null
      ? null
      : toMonthDate(input.availableFromYear, input.availableFromMonth ?? 1);

  const data = {
    openToWork: input.openToWork,
    preferredRoles: input.preferredRoles,
    preferredLocations: input.preferredLocations,
    opportunityTypes: input.opportunityTypes,
    remotePreference: input.remotePreference,
    willingToRelocate: input.willingToRelocate,
    noticePeriodDays: input.noticePeriodDays,
    availableFrom,
  };

  await runInTransaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);
    await tx.candidatePreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  });
}

/* ─── Skills ─────────────────────────────────────────────────────────────── */

export type SkillClaimWrite = {
  skillId: string;
};

/**
 * Set the candidate's skill claims. This is the authoritative write path for
 * `CandidateSkill`.
 *
 * Withdrawing a claim never deletes a row that carries evidence: `SkillEvidence`
 * cascades off `CandidateSkill`, so a delete would destroy a permanent record of
 * something the candidate actually demonstrated. Those rows are flipped to
 * `claimedByCandidate = false` and keep their evidence; only rows with no
 * evidence at all — where there is nothing to lose — are removed.
 */
export async function saveSkillClaims(
  userId: string,
  claims: readonly SkillClaimWrite[],
): Promise<void> {
  await runInTransaction(async (tx) => {
    await ensureCandidateProfile(tx, userId);

    const wanted = new Set(claims.map((c) => c.skillId));

    const valid = await tx.skill.findMany({
      where: { id: { in: [...wanted] }, isActive: true },
      select: { id: true },
    });
    const validIds = new Set(valid.map((s) => s.id));

    for (const skillId of wanted) {
      if (!validIds.has(skillId)) {
        // Unknown or deactivated: not written, and not withdrawn either.
        logger.warn("[profile] skill not in active catalog", { userId, skillId });
        continue;
      }
      await tx.candidateSkill.upsert({
        where: { userId_skillId: { userId, skillId } },
        create: { userId, skillId, claimedByCandidate: true },
        update: { claimedByCandidate: true },
      });
    }

    const existing = await tx.candidateSkill.findMany({
      where: { userId },
      select: {
        id: true,
        skillId: true,
        evidenceCount: true,
        _count: { select: { evidence: true } },
      },
    });

    // Withdrawal is decided by what the candidate SUBMITTED, not by what
    // passed catalog validation. Using `validIds` here would silently un-claim
    // a skill that was later deactivated in the catalog — the candidate would
    // resubmit it every save and watch it vanish every time.
    const withdrawn = existing.filter((row) => !wanted.has(row.skillId));
    const keepIds: string[] = [];
    const dropIds: string[] = [];
    for (const row of withdrawn) {
      if (row.evidenceCount > 0 || row._count.evidence > 0) {
        keepIds.push(row.id);
      } else {
        dropIds.push(row.id);
      }
    }

    if (keepIds.length > 0) {
      await tx.candidateSkill.updateMany({
        where: { id: { in: keepIds } },
        data: { claimedByCandidate: false },
      });
    }
    if (dropIds.length > 0) {
      await tx.candidateSkill.deleteMany({ where: { id: { in: dropIds } } });
    }

    await mirrorSkillsToLegacy(tx, userId);
  });
}
