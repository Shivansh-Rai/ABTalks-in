/**
 * The canonical candidate, and who SHOULD be discoverable — derived from it
 * alone.
 *
 * This is the expected side of every recruiter-search check. It is written
 * from the documented rules (plan 117, plan 133, `searchableUserWhere`'s
 * contract, the track registry's descriptors) and deliberately does NOT call
 * the track loaders, the repository queries or the scorer. An oracle that
 * reuses the code under test agrees with every bug in it.
 *
 * Canonical means the 078 tables (CLAUDE.md: legacy tables are mirrors, not
 * read sources): `User`, `CandidateVisibility`, `CandidateProfile` and its
 * children, plus the track-membership tables.
 *
 * PURE.
 */

export type CanonicalSkill = {
  skillId: string;
  name: string;
  isActive: boolean;
  claimed: boolean;
  verified: boolean;
  evidenceScore: number;
  evidenceCount: number;
};

export type CanonicalEducation = {
  institutionName: string;
  collegeId: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  graduationYear: number | null;
  isCurrent: boolean;
};

export type CanonicalExperience = {
  companyName: string;
  title: string;
  totalMonths: number;
  startedOn: Date;
  endedOn: Date | null;
  isCurrent: boolean;
};

export type CanonicalPreference = {
  openToWork: boolean;
  noticePeriodDays: number | null;
  preferredLocations: string[];
  opportunityTypes: string[];
  willingToRelocate: boolean;
  remotePreference: string | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  /** Target roles. Read by the role dimension, never by a filter. */
  preferredRoles: string[];
};

export type CanonicalCandidate = {
  userId: string;
  role: string;
  /** Never the address. The domain is enough to spot a test account. */
  emailDomain: string | null;
  emailValid: boolean;
  /** Gmail dot/plus-folded local part, for duplicate detection only. Never printed. */
  emailAliasKey?: string | null;
  createdAt: Date;
  deleted: boolean;
  disabled: boolean;
  anonymized: boolean;
  visibility: { searchable: boolean; withdrawn: boolean } | null;
  profile: {
    fullName: string;
    headline: string | null;
    locationCity: string | null;
    linkedinUrl: string | null;
    githubUsername: string | null;
    portfolioUrl: string | null;
    hasResume: boolean;
  } | null;
  skills: CanonicalSkill[];
  education: CanonicalEducation[];
  experience: CanonicalExperience[];
  projects: { title: string; repoUrl: string | null; liveUrl: string | null }[];
  links: { type: string; url: string }[];
  preference: CanonicalPreference | null;
  memberships: {
    program: { memberId: string; cohortId: string; status: string }[];
    challenge: { domain: string; submissions: number }[];
    hackathonWithSubmission: boolean;
  };
  /** Legacy mirrors, read only to explain a stale document. */
  legacy?: {
    studentProfileSkills: string[] | null;
    studentProfileGradYear: number | null;
    programMemberSkills: string[] | null;
  };
};

export type TrackSlug = "PROGRAM" | "CLAUDE" | "CHALLENGE_60" | "HACKATHON" | "PROFILE";

/** Dedupe order, copied from the documented registry priorities (higher wins). */
export const TRACK_PRIORITY: Record<TrackSlug, number> = {
  PROGRAM: 100,
  CLAUDE: 50,
  CHALLENGE_60: 40,
  HACKATHON: 30,
  PROFILE: 10,
};

const CHALLENGE_DOMAINS: Record<"CLAUDE" | "CHALLENGE_60", string[]> = {
  CLAUDE: ["CLAUDE"],
  CHALLENGE_60: ["SE", "DS", "AI"],
};

/** The environment that decides which tracks exist. Eligibility is flag-dependent. */
export type SearchEnv = {
  newTalentRead: boolean;
  challengePool: { enabled: boolean; minDays: number };
  openCohortIds: string[] | "all" | null;
};

export type PoolCohort = { id: string; status: string; published: boolean };

export type NeverAppearReason =
  | "DELETED"
  | "DISABLED"
  | "ANONYMIZED"
  | "NO_VISIBILITY_ROW"
  | "NOT_SEARCHABLE"
  | "WITHDRAWN";

/**
 * The discovery gate as documented on `searchableUserWhere`: not deleted, not
 * disabled, a visibility row that is searchable and not withdrawn. A missing
 * row fails closed — see `noVisibilityRowIsProductDecision`.
 */
export function gateReasons(c: CanonicalCandidate): NeverAppearReason[] {
  const reasons: NeverAppearReason[] = [];
  if (c.deleted) reasons.push("DELETED");
  if (c.disabled) reasons.push("DISABLED");
  if (c.anonymized) reasons.push("ANONYMIZED");
  if (!c.visibility) reasons.push("NO_VISIBILITY_ROW");
  else {
    if (!c.visibility.searchable) reasons.push("NOT_SEARCHABLE");
    if (c.visibility.withdrawn) reasons.push("WITHDRAWN");
  }
  return reasons;
}

/**
 * Plan 117 promised "a registered candidate with a usable profile is searchable
 * with no toggle", but `CandidateVisibility` rows are only created by challenge
 * and cohort enrolment. A usable profile with no row is therefore invisible.
 * Failing closed is the privacy-safe reading, so the oracle agrees with the code
 * — and the audit reports the population as a product decision.
 */
export function noVisibilityRowIsProductDecision(c: CanonicalCandidate): boolean {
  return (
    !c.visibility &&
    !c.deleted &&
    !c.disabled &&
    hasUsableProfile(c)
  );
}

/** Plan 117 §5.1: a non-blank name and at least one skill the candidate claimed. */
export function hasUsableProfile(c: CanonicalCandidate): boolean {
  return Boolean(
    c.profile && c.profile.fullName.trim() !== "" && c.skills.some((s) => s.claimed),
  );
}

export function cohortIsOpen(cohort: PoolCohort | undefined, env: SearchEnv): boolean {
  if (!cohort) return false;
  if (cohort.published) return true;
  if (env.openCohortIds === "all") {
    return cohort.status === "ENROLLING" || cohort.status === "ACTIVE";
  }
  return Array.isArray(env.openCohortIds) && env.openCohortIds.includes(cohort.id);
}

/**
 * Every track this candidate belongs to, before dedupe and before the gate.
 * `minEvidenceDays` is a recruiter-stated floor; it only means anything on the
 * day-scale tracks (registry `supportsEvidenceDays`).
 */
export function expectedTracks(
  c: CanonicalCandidate,
  env: SearchEnv,
  cohorts: ReadonlyMap<string, PoolCohort>,
  opts: { minEvidenceDays?: number } = {},
): TrackSlug[] {
  const out: TrackSlug[] = [];
  if (
    c.memberships.program.some(
      (m) =>
        (m.status === "ENROLLED" || m.status === "COMPLETED") &&
        cohortIsOpen(cohorts.get(m.cohortId), env),
    )
  ) {
    out.push("PROGRAM");
  }
  if (env.challengePool.enabled) {
    const floor = Math.max(env.challengePool.minDays, opts.minEvidenceDays ?? 0, 1);
    for (const slug of ["CLAUDE", "CHALLENGE_60"] as const) {
      if (
        c.memberships.challenge.some(
          (e) => CHALLENGE_DOMAINS[slug].includes(e.domain) && e.submissions >= floor,
        )
      ) {
        out.push(slug);
      }
    }
  }
  if (c.memberships.hackathonWithSubmission) out.push("HACKATHON");
  if (hasUsableProfile(c)) out.push("PROFILE");
  return out;
}

export type EligibilityDecision = {
  eligible: boolean;
  gate: NeverAppearReason[];
  tracks: TrackSlug[];
  /** The one card this person should show as, among the tracks searched. */
  winner: TrackSlug | null;
};

export function eligibility(
  c: CanonicalCandidate,
  env: SearchEnv,
  cohorts: ReadonlyMap<string, PoolCohort>,
  opts: { minEvidenceDays?: number; tracks?: readonly string[] } = {},
): EligibilityDecision {
  const gate = gateReasons(c);
  const all = expectedTracks(c, env, cohorts, opts);
  const tracks = opts.tracks && opts.tracks.length > 0
    ? all.filter((t) => opts.tracks!.includes(t))
    : all;
  const winner = [...tracks].sort((a, b) => TRACK_PRIORITY[b] - TRACK_PRIORITY[a])[0] ?? null;
  return { eligible: gate.length === 0 && tracks.length > 0, gate, tracks, winner };
}

/** Claimed skill names — what the candidate says they know, and the oracle's skill truth. */
export function claimedSkillNames(c: CanonicalCandidate): string[] {
  return c.skills.filter((s) => s.claimed).map((s) => s.name);
}

/** Months across experience rows, as the profile stores them (overlaps included). */
export function declaredExperienceMonths(c: CanonicalCandidate): number {
  return c.experience.reduce((n, e) => n + Math.max(0, e.totalMonths), 0);
}

/** The most recent graduation year the candidate actually entered. */
export function latestGraduationYear(c: CanonicalCandidate): number | null {
  const years = c.education
    .map((e) => e.graduationYear)
    .filter((y): y is number => typeof y === "number");
  return years.length ? Math.max(...years) : null;
}
