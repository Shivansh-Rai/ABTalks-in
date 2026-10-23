/**
 * Achievement badges. Every badge is DERIVED on read from records the platform
 * already keeps (certificates, cohort completions, submission days). Nothing
 * is stored, so a badge cannot be awarded twice and cannot be faked from the
 * browser. Only earned badges exist as values of this type.
 *
 * Plain serialisable data: it crosses the Server → Client boundary as-is.
 */

export type BadgeFamily = "challenge" | "cohort" | "consistency";

/** Which artwork the medallion draws. */
export type BadgeMark =
  | "claude"
  | "ai"
  | "ds"
  | "se"
  | "ai-cohort"
  | "databricks"
  | "snowflake"
  | "langchain"
  | "powerbi"
  | "ds-architect"
  | "coding-practice"
  | "streak";

export type EarnedBadge = {
  /** Unique per user: "challenge:claude", "cohort:databricks-open", "consistency:30". */
  key: string;
  family: BadgeFamily;
  mark: BadgeMark;
  /** "Claude Challenge Completed", "Cohort Completed", "30-Day Consistency". */
  title: string;
  /** The challenge or cohort it is for, e.g. "60-Day Claude Challenge". */
  context: string;
  description: string;
  /** How it is earned, in one sentence. */
  criteria: string;
  /** Short figure printed on the medallion: "60", "31", "100". */
  figure: string;
  /** Consistency only: 1 = 30 days, 2 = 60, 3 = 100. */
  tier: 1 | 2 | 3 | null;
  /** ISO timestamp, for ordering. */
  awardedAt: string;
  /** Display date in IST, e.g. "30 Jul 2026". */
  awardedOn: string;
};

/** What a page hands its badge UI: the list, or an honest "could not load". */
export type BadgesState =
  | { ok: true; badges: EarnedBadge[] }
  | { ok: false };

export const BADGE_FAMILY_LABEL: Record<BadgeFamily, string> = {
  challenge: "Challenge",
  cohort: "Cohort",
  consistency: "Consistency",
};
