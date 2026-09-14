/**
 * Career guidance (T-224) — recommendation shapes.
 *
 * Pure data. No Prisma, no server-only. `evaluateRules` consumes these and
 * returns cards the hub can render without a second interpretation pass.
 */

export type GuidanceKind =
  | "cohort"
  | "hackathon"
  | "challenge"
  | "opportunity"
  | "mock";

export type GuidanceItem = {
  id: string;
  kind: GuidanceKind;
  title: string;
  /** One sentence naming a fact on this candidate. Never a statistic. */
  because: string;
  href: string;
  cta: string;
};

export type ChallengeDomain = "AI" | "DS" | "SE" | "CLAUDE";

export type ChallengeStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";

export type TrackStatus = "ACTIVE" | "COMPLETED";

export type ChallengeFact = {
  domain: ChallengeDomain;
  status: ChallengeStatus;
};

export type SkillFact = {
  name: string;
  categoryName: string | null;
};

export type JobFact = {
  id: string;
  title: string;
  company: string;
  skills: string[];
  type: string;
};

export type MockFact = {
  slug: string;
  label: string;
  /** Remaining attempts. `null` means uncapped. */
  attemptsLeft: number | null;
};

export type GuidanceFlags = {
  program: boolean;
  databricks: boolean;
  dsArchitect: boolean;
  powerBi: boolean;
  claude: boolean;
};

export type CandidateFacts = {
  challenges: ChallengeFact[];
  /** Null when they have no AI-cohort membership we treat as occupied. */
  aiCohortStatus: TrackStatus | null;
  databricksStatus: TrackStatus | null;
  dsArchitectStatus: TrackStatus | null;
  powerBiStatus: TrackStatus | null;
  hackathonRegistered: boolean;
  hackathonRegistrationOpen: boolean;
  skills: SkillFact[];
  preferredRoles: string[];
  opportunityTypes: string[];
  flags: GuidanceFlags;
  mocks: MockFact[];
  jobs: JobFact[];
  appliedJobIds: string[];
};

export const GUIDANCE_CAP = 6;
export const DAILY_CAP = 4;
export const MAX_JOB_CARDS = 2;

/** Hub daily mix card — profile rec or catalog check-in/quote. */
export type DailyCardKind = GuidanceKind | "checkin" | "quote";

export type DailyCard = {
  id: string;
  source: "profile" | "catalog";
  kind: DailyCardKind;
  title: string;
  body: string;
  ctaLabel: string | null;
  href: string | null;
};

export type GuidanceMemory = {
  istDay: string;
  /** Frozen ids for this IST day. Null until the pack is first built. */
  packIds: string[] | null;
  dismissedIds: string[];
  onceSeen: string[];
  weeklySeen: Record<string, string>;
};
