/**
 * Server-side feature flags (read from process.env).
 * For client components, pass boolean props from a Server Component parent.
 */
export function isClaudeEnabled(): boolean {
  return process.env.ENABLE_CLAUDE_CHALLENGE === "true";
}

export function isDayLockBypassEnabled(): boolean {
  return process.env.BYPASS_DAY_LOCKS === "true";
}

export function isProgramEnabled(): boolean {
  return true;
}

/**
 * Databricks cohort at /program/databricks.
 * Unset/false 404s the route and hides the Prep Kit card.
 * Set to true in Vercel to launch.
 */
export function isDatabricksEnabled(): boolean {
  return process.env.ENABLE_DATABRICKS === "true";
}

/**
 * Data Solutions Architect cohort at /program/ds-architect.
 * Unset/false 404s the route and hides the Prep Kit card.
 * Set to true in Vercel to launch.
 */
export function isDsArchitectEnabled(): boolean {
  return process.env.ENABLE_DS_ARCHITECT === "true";
}

/**
 * Power BI & Analytics cohort at /program/powerbi.
 * Unset/false 404s the route and hides the Prep Kit card.
 * Set to true in Vercel to launch.
 */
export function isPowerBiEnabled(): boolean {
  return process.env.ENABLE_POWERBI === "true";
}

/**
 * Snowflake Data & AI Engineering cohort at /program/snowflake.
 * Unset/false 404s the route and hides the Prep Kit card.
 * Set to true in Vercel to launch.
 */
export function isSnowflakeEnabled(): boolean {
  return process.env.ENABLE_SNOWFLAKE === "true";
}

/**
 * Entry assessment quiz is removed from the program cohort product surface.
 * Apply enrolls/waitlists directly. Kept as a always-on flag for call sites.
 */
export function isProgramEntryBypassEnabled(): boolean {
  return true;
}

/**
 * Local/dev bypass for phone OTP verification.
 * When `OTP_DEV_BYPASS=true`, the MSG91 widget is skipped: no SMS is sent and the
 * fixed dev code (see `otpDevCode`) verifies. For developers/CI only — never enable
 * in production.
 */
export function isOtpDevBypassEnabled(): boolean {
  return process.env.OTP_DEV_BYPASS === "true";
}

/** Fixed OTP accepted in dev-bypass mode. Defaults to "1234" (4 digits). */
export function otpDevCode(): string {
  return process.env.OTP_DEV_CODE ?? "1234";
}

/**
 * Whether phone OTP verification is required.
 * Under `next dev` (`NODE_ENV=development`) OTP is skipped so local registration
 * and profile testing need no code. Production / production-mode builds keep
 * MSG91 enforcement intact.
 */
export function isOtpVerificationRequired(): boolean {
  return process.env.NODE_ENV !== "development";
}

/**
 * Local preview of the hackathon submission window before kickoff.
 * `HACKATHON_PREVIEW=true` in .env.local unlocks /hackathon/submission early for the
 * developer only. It does NOT bypass the submission deadline, and it must never be
 * set in the Vercel project env.
 */
export function isHackathonPreviewEnabled(): boolean {
  return process.env.HACKATHON_PREVIEW === "true";
}

export function isChatbotEnabled(): boolean {
  return process.env.ENABLE_CHATBOT === "true";
}

/**
 * Recruiter email OTP sign-in and registration.
 *
 * Off unless `ENABLE_RECRUITER_AUTH=true`. The hire desk stays public; this
 * only closes /talent/login, /talent/register, the hire auth dialog, and the
 * recruiter-otp authorize path.
 */
export function isRecruiterAuthEnabled(): boolean {
  return process.env.ENABLE_RECRUITER_AUTH === "true";
}

/** Plan 078 Phase 6 switches. Phase 3 keeps all of these false (legacy reads). */
export function isNewCandidateRepoEnabled(): boolean {
  return process.env.ENABLE_NEW_CANDIDATE === "true";
}

/**
 * W4-A write authority for candidate identity/profile/referral.
 * Separate from ENABLE_NEW_CANDIDATE (reads). Off unless explicitly `"true"`.
 *
 * When off (dark deploy): StudentProfile is still written first, then
 * dualWriteCandidateIdentity copies CandidateProfile.
 * When on: CandidateProfile + structured tables commit first; StudentProfile
 * identity/referral fields are a compatibility mirror while
 * ENABLE_LEGACY_STUDENT_PROFILE_MIRROR is not `"false"`.
 * Dual-write stays on either way. Do not enable without ENABLE_NEW_CANDIDATE
 * already on. W4-B sets ENABLE_LEGACY_STUDENT_PROFILE_MIRROR=false to freeze
 * StudentProfile identity/referral fields only.
 */
export function isNewCandidateWritesEnabled(): boolean {
  return process.env.ENABLE_NEW_CANDIDATE_WRITES === "true";
}

/**
 * W4 StudentProfile identity/referral compatibility mirror.
 * Default ON so a dark deploy (flag unset) keeps current mirroring.
 * Off only when explicitly `"false"` (W4-B): canonical candidate still writes;
 * StudentProfile identity/referral/profile fields freeze. Ambassador, domain,
 * and other later-family columns on the same table are not gated here.
 */
export function isLegacyStudentProfileMirrorEnabled(): boolean {
  return process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR !== "false";
}

/**
 * W5-A write authority for Campus Ambassador candidacy. Separate from
 * ENABLE_NEW_CANDIDATE / ENABLE_NEW_CANDIDATE_WRITES. Off unless explicitly
 * `"true"`.
 *
 * When off (dark deploy): StudentProfile ambassador columns are still written
 * first, then CampusAmbassadorApplication is dual-written.
 * When on: CampusAmbassadorApplication commits first; StudentProfile
 * ambassador columns are a compatibility mirror while
 * ENABLE_LEGACY_AMBASSADOR_MIRROR is not `"false"`.
 * Dual-write stays on either way. Do not freeze those SP columns in W5-A.
 */
export function isNewAmbassadorWritesEnabled(): boolean {
  return process.env.ENABLE_NEW_AMBASSADOR_WRITES === "true";
}

/**
 * W5-A StudentProfile ambassador compatibility mirror.
 * Default ON so a dark deploy (flag unset) keeps current mirroring.
 * Off only when explicitly `"false"` (W5-B): canonical ambassador still writes;
 * StudentProfile ambassador columns freeze except the anonymize/wipe compliance
 * scrub. Identity, points, and domain on the same table are not gated here.
 */
export function isLegacyAmbassadorMirrorEnabled(): boolean {
  return process.env.ENABLE_LEGACY_AMBASSADOR_MIRROR !== "false";
}

export function isNewLearningRepoEnabled(): boolean {
  return process.env.ENABLE_NEW_LEARNING === "true";
}
export function isNewProgressRepoEnabled(): boolean {
  return process.env.ENABLE_NEW_PROGRESS === "true";
}

/**
 * W6-A write authority for challenge/quiz/AI-cohort activity attempts.
 * Separate from ENABLE_NEW_PROGRESS (reads). Off unless explicitly `"true"`.
 *
 * When off (dark deploy): Submission / QuizAttempt / ProgramMissionSubmission
 * still write first, then ActivityAttempt + ActivityEvaluation are dual-written.
 * When on: attempt + evaluation commit first; legacy rows are compatibility
 * mirrors while ENABLE_LEGACY_PROGRESS_MIRROR is not `"false"`.
 * Dual-write stays on either way.
 * Do not take Enrollment / ProgramEnrollment / StudentProfile.domain authority.
 */
export function isNewProgressWritesEnabled(): boolean {
  return process.env.ENABLE_NEW_PROGRESS_WRITES === "true";
}

/**
 * W6-A compatibility mirror onto Submission / QuizAttempt /
 * ProgramMissionSubmission. Independent of ENABLE_DUAL_WRITE.
 *
 * Default ON so a dark deploy (flag unset) keeps current mirroring.
 * Off only when explicitly `"false"` (W6-B): canonical attempts still write;
 * legacy progress rows freeze. After W6-B they are historical snapshots.
 */
export function isLegacyProgressMirrorEnabled(): boolean {
  return process.env.ENABLE_LEGACY_PROGRESS_MIRROR !== "false";
}

/**
 * W7-A canonical enrollment denorm current-state reads.
 * Off unless explicitly `"true"`. Dark deploy keeps Enrollment /
 * StudentProfile.domain as the live read source.
 * Dual-write stays on. W7-B sets ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR=false.
 * Do not overload ENABLE_NEW_PROGRESS / ENABLE_NEW_LEARNING.
 */
export function isNewEnrollmentStateEnabled(): boolean {
  return process.env.ENABLE_NEW_ENROLLMENT_STATE === "true";
}

/**
 * W7 Enrollment denorm compatibility mirror onto Enrollment.daysCompleted /
 * lastSubmittedDay / currentStreak / longestStreak and StudentProfile.domain.
 * Default ON. Set `"false"` at W7-B to freeze those fields only.
 * Does not gate Enrollment.status / startedAt / completedAt or other SP families.
 */
export function isLegacyEnrollmentDenormMirrorEnabled(): boolean {
  return process.env.ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR !== "false";
}
export function isNewTalentRepoEnabled(): boolean {
  return process.env.ENABLE_NEW_TALENT === "true";
}
export function isNewPointsRepoEnabled(): boolean {
  return process.env.ENABLE_NEW_POINTS === "true";
}

/**
 * W1-A write authority for the points wallet. Separate from
 * `ENABLE_NEW_POINTS` (reads). Off unless explicitly `"true"`.
 *
 * When on: PointsAccount + PointsTransaction are authoritative;
 * User.synergyPoints and SynergyEvent are compatibility mirrors while
 * ENABLE_LEGACY_POINTS_MIRROR is not `"false"`.
 * Do not enable without ENABLE_NEW_POINTS already on. Dual-write stays on.
 */
export function isNewPointsWritesEnabled(): boolean {
  return process.env.ENABLE_NEW_POINTS_WRITES === "true";
}

/**
 * W1-B compatibility mirror onto User.synergyPoints / StudentProfile.synergyPoints
 * / SynergyEvent. Independent of ENABLE_DUAL_WRITE.
 *
 * Default ON so a dark deploy (flag unset) keeps current W1-A behaviour.
 * Off only when explicitly `"false"`: authoritative PointsAccount +
 * PointsTransaction still write; legacy columns/tables freeze.
 */
export function isLegacyPointsMirrorEnabled(): boolean {
  return process.env.ENABLE_LEGACY_POINTS_MIRROR !== "false";
}

/**
 * W2 write authority for recruiter discovery. Separate from ENABLE_NEW_TALENT
 * (reads). Off unless explicitly `"true"`.
 *
 * When off (dark deploy): CandidateVisibility still writes inside the 078
 * dual-write savepoint, matching today's enrolment path.
 * When on: CandidateVisibility commits in the outer transaction first.
 * Dual-write stays on either way. Do not use this as a candidate opt-in.
 */
export function isNewVisibilityWritesEnabled(): boolean {
  return process.env.ENABLE_NEW_VISIBILITY_WRITES === "true";
}

/**
 * W2 compatibility handling of ProgramMember.recruiterVisibilityConsentAt.
 * Independent of ENABLE_DUAL_WRITE.
 *
 * Default ON so a dark deploy (flag unset) keeps current labelling behaviour
 * (read the historical timestamp; never invent a consent that was not asked).
 * Off only when explicitly `"false"`: still do not stamp the column, and skip
 * the labelled-from-legacy-consent path.
 */
export function isLegacyVisibilityMirrorEnabled(): boolean {
  return process.env.ENABLE_LEGACY_VISIBILITY_MIRROR !== "false";
}
export function isNewCredentialRepoEnabled(): boolean {
  return process.env.ENABLE_NEW_CREDENTIAL === "true";
}

/**
 * W3-A write authority for certificate/credential issuance. Separate from
 * `ENABLE_NEW_CREDENTIAL` (reads). Off unless explicitly `"true"`.
 *
 * When off (dark deploy): Certificate is still minted first, then
 * `dualWriteCredential` mirrors Credential.
 * When on: Credential commits first; Certificate is a compatibility mirror
 * while ENABLE_LEGACY_CERTIFICATE_MIRROR is not `"false"`.
 * Dual-write stays on either way. Do not enable without ENABLE_NEW_CREDENTIAL
 * already on.
 */
export function isNewCredentialWritesEnabled(): boolean {
  return process.env.ENABLE_NEW_CREDENTIAL_WRITES === "true";
}

/**
 * W3-A compatibility mirror onto legacy Certificate. Independent of
 * ENABLE_DUAL_WRITE.
 *
 * Default ON so a dark deploy (flag unset) keeps current W3-A behaviour.
 * Off only when explicitly `"false"` (W3-B): authoritative Credential
 * still writes; Certificate rows freeze.
 */
export function isLegacyCertificateMirrorEnabled(): boolean {
  return process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR !== "false";
}

/** Plan 078 Phase 4. Off = skip new-table writes; legacy stays authoritative. */
export function isDualWriteEnabled(): boolean {
  return process.env.ENABLE_DUAL_WRITE === "true";
}

/**
 * Cohorts whose consenting members `/hire` may match, before their results are
 * published.
 *
 * `/talent` shows a finished, ranked cohort and rightly waits for
 * `resultsPublishedAt`. `/hire` ranks on evidence-so-far, which exists from the
 * first passed mission — but a running cohort must not become visible by
 * accident, so it is opt-in and set deliberately per cohort.
 *
 * Comma-separated cohort ids, or the literal `all` for every running cohort.
 * Unset (the default) means `/hire` behaves exactly as it does today: published
 * cohorts only.
 */
export function hireOpenCohortIds(): string[] | "all" | null {
  const raw = process.env.HIRE_OPEN_COHORT_IDS?.trim();
  if (!raw) return null;
  if (raw.toLowerCase() === "all") return "all";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

/**
 * Whether `/hire` may also search the Claude challenge track, and from how many
 * verified days.
 *
 * The AI Cohort is one running cohort of a few dozen people. The challenge is
 * 2,708 enrolments, 682 of whom have submitted at least one day of work against
 * the platform's own checks. Keeping it out of the pool did not protect anyone
 * — nothing about a challenge participant is shown that a program member's card
 * does not also show, and neither carries a name — it just meant the product
 * ranked 1.5% of the evidence it holds.
 *
 * The floor is the interesting half. Below roughly ten submitted days there is
 * no track record to rank, and a recruiter's first screen filling with people
 * who tried the challenge for a weekend is worse for the business than a short
 * list. Ten is the default; the value tunes it.
 *
 * `HIRE_CHALLENGE_POOL=10` (or any integer), `=true` for the default floor.
 * Unset — the default — means `/hire` behaves exactly as it does today.
 */
export function hireChallengePool(): { enabled: boolean; minDays: number } {
  const raw = process.env.HIRE_CHALLENGE_POOL?.trim();
  if (!raw || raw.toLowerCase() === "false") {
    return { enabled: false, minDays: 10 };
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return { enabled: true, minDays: parsed };
  }
  return { enabled: raw.toLowerCase() === "true", minDays: 10 };
}

/**
 * Blurred, fabricated "Pro" preview cards on an empty `/hire` search.
 *
 * Presentational only. There is no plan column, no entitlement and no billing —
 * every locked field is locked for everybody, and the values behind the blur are
 * generated, not real candidates (see features/hire/locked-preview.ts).
 *
 * Off by default: with the searchable pool still small, a desk that fills with
 * example profiles on every empty search is a claim about inventory, and that
 * claim should be switched on deliberately rather than by shipping.
 *
 * Read on the server and passed to the client as a prop — the desk is a client
 * component and cannot read process.env.
 */
export function isHireProPreviewEnabled(): boolean {
  return process.env.HIRE_PRO_PREVIEW === "true";
}

/**
 * Virtual candidates: an empty search offers to source the requirement rather
 * than reporting nothing.
 *
 * Off by default, and deliberately so on two counts.
 *
 * The mechanical one: the feature needs the VirtualCandidate tables, and
 * `docs/project-context.md` records that `prisma migrate deploy` cannot be used
 * on this production database — a leftover `20260813000000_general_interview`
 * folder makes it fail, so migrations are applied with `prisma db execute` plus
 * `prisma migrate resolve --applied`. That is a deliberate act by a person, not
 * something a deploy does on its way past, so the code has to be able to ship
 * before the tables exist. With this off it does: nothing queries them.
 *
 * The product one: offering to source someone is a promise. It should be turned
 * on when the team is ready to answer, not when the code happens to land.
 *
 * Read on the server and passed to the client as a prop — the desk is a client
 * component and cannot read process.env.
 */
export function isVirtualCandidatesEnabled(): boolean {
  return process.env.HIRE_VIRTUAL_CANDIDATES === "true";
}
