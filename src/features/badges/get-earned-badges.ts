import "server-only";
import {
  CertificateStatus,
  CertificateType,
  Domain,
  EnrollmentStatusV2,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  formatDateIST,
  getIstDateKey,
  parseCalendarKeyToUtcDate,
} from "@/lib/date-utils";
import { listForUser } from "@/repositories/credentials";
import { listChallengePeRows } from "@/repositories/enrollment-state";
import {
  findChallengeDayMilestoneAt,
  getChallengeProgressStats,
  listHubSubmissionTimes,
} from "@/repositories/progress";
import {
  certificateDomainLabel,
  certificateTypeFromCredentialTitle,
} from "@/features/certificate/constants";
import {
  DATABRICKS_COHORT_SLUG,
  DATABRICKS_TOTAL_DAYS,
} from "@/features/databricks/constants";
import {
  DATABRICKS_AI_COHORT_SLUG,
  DATABRICKS_AI_TOTAL_DAYS,
} from "@/features/databricks-ai/constants";
import {
  SNOWFLAKE_COHORT_SLUG,
  SNOWFLAKE_TOTAL_DAYS,
} from "@/features/snowflake/constants";
import {
  LANGCHAIN_COHORT_SLUG,
  LANGCHAIN_TOTAL_DAYS,
} from "@/features/langchain/constants";
import {
  POWERBI_COHORT_SLUG,
  POWERBI_TOTAL_DAYS,
} from "@/features/powerbi/constants";
import {
  DS_ARCHITECT_COHORT_SLUG,
  DS_ARCHITECT_TOTAL_DAYS,
} from "@/features/ds-architect/constants";
import {
  PRACTICE_PROGRAM_SLUGS,
  cohortSlugFor,
} from "@/features/coding-practice/constants";
import { getPracticeChallenge } from "@/features/coding-practice/content";
import { PROGRAM_TOTAL_DAYS } from "@/features/program/constants";
import {
  CONSISTENCY_MILESTONES,
  consistencyMilestonesReached,
  type ConsistencyMilestone,
} from "./consistency";
import type { BadgeMark, BadgesState, EarnedBadge } from "./types";

/**
 * The 60-day AI / DS / SE challenges count as completed at 50 passed days —
 * the same rule profile Accomplishments uses (get-verified-accomplishments).
 */
const CHALLENGE_BADGE_DAYS = 50;

const CHALLENGE_MARK: Partial<Record<Domain, BadgeMark>> = {
  [Domain.AI]: "ai",
  [Domain.DS]: "ds",
  [Domain.SE]: "se",
};

/** Cohorts that award a "Cohort Completed" badge, by Cohort.slug. */
const COHORT_BADGES: Record<string, { mark: BadgeMark; days: number | null }> = {
  [DATABRICKS_COHORT_SLUG]: { mark: "databricks", days: DATABRICKS_TOTAL_DAYS },
  [DATABRICKS_AI_COHORT_SLUG]: { mark: "databricks", days: DATABRICKS_AI_TOTAL_DAYS },
  [SNOWFLAKE_COHORT_SLUG]: { mark: "snowflake", days: SNOWFLAKE_TOTAL_DAYS },
  [LANGCHAIN_COHORT_SLUG]: { mark: "langchain", days: LANGCHAIN_TOTAL_DAYS },
  [POWERBI_COHORT_SLUG]: { mark: "powerbi", days: POWERBI_TOTAL_DAYS },
  [DS_ARCHITECT_COHORT_SLUG]: { mark: "ds-architect", days: DS_ARCHITECT_TOTAL_DAYS },
  ...Object.fromEntries(
    PRACTICE_PROGRAM_SLUGS.map((slug) => [
      cohortSlugFor(slug),
      {
        mark: "coding-practice" as const,
        days: getPracticeChallenge(slug)?.days.length ?? null,
      },
    ]),
  ),
};

function stamp(date: Date): Pick<EarnedBadge, "awardedAt" | "awardedOn"> {
  return { awardedAt: date.toISOString(), awardedOn: formatDateIST(date) };
}

/* ── Badge builders: the one place that says what each badge is ──────────── */

function claudeBadge(at: Date): EarnedBadge {
  return {
    key: "challenge:claude",
    family: "challenge",
    mark: "claude",
    title: "Claude Challenge Completed",
    context: "60-Day Claude Challenge",
    description:
      "Finished the 60-day Claude challenge, shipping AI-assisted development work day after day.",
    criteria: "Earn the 60-Day Claude Challenge certificate.",
    figure: "60",
    tier: null,
    ...stamp(at),
  };
}

function challengeBadge(domain: Domain, mark: BadgeMark, at: Date): EarnedBadge {
  const label = certificateDomainLabel(domain);
  return {
    key: `challenge:${mark}`,
    family: "challenge",
    mark,
    title: `${label} Challenge Completed`,
    context: `60-Day ${label} Challenge`,
    description: `Completed the 60-day ${label} challenge with passing daily submissions.`,
    criteria: `Pass at least ${CHALLENGE_BADGE_DAYS} of the 60 challenge days.`,
    figure: "60",
    tier: null,
    ...stamp(at),
  };
}

function aiCohortBadge(slug: string, name: string, at: Date): EarnedBadge {
  return {
    key: `cohort:${slug}`,
    family: "cohort",
    mark: "ai-cohort",
    title: "AI Cohort Completed",
    context: name,
    description:
      "Completed the AI Cohort Program: daily missions, concepts and a shipped project.",
    criteria: `Finish every part of the ${PROGRAM_TOTAL_DAYS}-day AI Cohort Program.`,
    figure: String(PROGRAM_TOTAL_DAYS),
    tier: null,
    ...stamp(at),
  };
}

function cohortBadge(slug: string, name: string, at: Date): EarnedBadge | null {
  const config = COHORT_BADGES[slug];
  if (!config) return null;
  return {
    key: `cohort:${slug}`,
    family: "cohort",
    mark: config.mark,
    title: "Cohort Completed",
    context: name,
    description: config.days
      ? `Completed the ${config.days}-day ${name} cohort.`
      : `Completed the ${name} cohort.`,
    criteria: config.days
      ? `Finish all ${config.days} days of the cohort.`
      : "Finish every day of the cohort.",
    figure: config.days ? String(config.days) : "",
    tier: null,
    ...stamp(at),
  };
}

function consistencyBadge(milestone: ConsistencyMilestone, at: Date): EarnedBadge {
  return {
    key: `consistency:${milestone}`,
    family: "consistency",
    mark: "streak",
    title: `${milestone}-Day Consistency`,
    context: `${milestone} days in a row`,
    description: `Submitted work on the platform ${milestone} days in a row.`,
    criteria: `Submit work on any track on ${milestone} consecutive days (IST). Once earned, it stays even if the streak later breaks.`,
    figure: String(milestone),
    tier: milestone === 30 ? 1 : milestone === 60 ? 2 : 3,
    ...stamp(at),
  };
}

/* ── Earned from records ─────────────────────────────────────────────────── */

async function challengeBadges(userId: string): Promise<EarnedBadge[]> {
  const [credentials, enrollments] = await Promise.all([
    listForUser(userId),
    listChallengePeRows({ userId, domains: [Domain.AI, Domain.DS, Domain.SE] }),
  ]);
  const out: EarnedBadge[] = [];

  // Claude: the issued (not revoked) certificate is the proof of completion.
  const claude = credentials.find(
    (row) =>
      row.status !== CertificateStatus.REVOKED &&
      certificateTypeFromCredentialTitle(row.title) ===
        CertificateType.CLAUDE_CHALLENGE,
  );
  if (claude) out.push(claudeBadge(claude.issuedAt));

  for (const enrollment of enrollments) {
    const mark = CHALLENGE_MARK[enrollment.domain];
    if (!mark) continue;
    const stats = await getChallengeProgressStats(enrollment.id);
    if (stats.daysCompleted < CHALLENGE_BADGE_DAYS) continue;
    const reachedAt =
      (await findChallengeDayMilestoneAt(enrollment.id, CHALLENGE_BADGE_DAYS)) ??
      enrollment.completedAt;
    // Passed days say it is earned, but with no dated attempt there is no
    // honest award date. Skip rather than invent one.
    if (!reachedAt) continue;
    out.push(challengeBadge(enrollment.domain, mark, reachedAt));
  }
  return out;
}

async function cohortBadges(userId: string): Promise<EarnedBadge[]> {
  const rows = await prisma.programEnrollment.findMany({
    where: {
      userId,
      OR: [
        { status: EnrollmentStatusV2.COMPLETED },
        { completedAt: { not: null } },
      ],
    },
    select: {
      id: true,
      completedAt: true,
      updatedAt: true,
      cohort: { select: { slug: true, name: true } },
    },
  });

  const out: EarnedBadge[] = [];
  for (const row of rows) {
    const when = row.completedAt ?? row.updatedAt;
    // `pe_pm_` rows are the AI Cohort Program (one per cohort run joined).
    if (row.id.startsWith("pe_pm_")) {
      out.push(aiCohortBadge(row.cohort.slug, row.cohort.name, when));
      continue;
    }
    // Anything else completing a ProgramEnrollment (the 60-day challenge
    // mirrors, unknown cohorts) earns no cohort badge.
    const badge = cohortBadge(row.cohort.slug, row.cohort.name, when);
    if (badge) out.push(badge);
  }
  return out;
}

async function consistencyBadges(userId: string): Promise<EarnedBadge[]> {
  const times = await listHubSubmissionTimes(userId);
  const keys = times.map((t) => getIstDateKey(t));
  const reached = consistencyMilestonesReached(keys, getIstDateKey());
  return reached.map(({ milestone, reachedOn }) =>
    consistencyBadge(milestone, parseCalendarKeyToUtcDate(reachedOn)),
  );
}

/* ── Showcase accounts ───────────────────────────────────────────────────── */

/**
 * Accounts shown EVERY badge, earned or not: a deliberate, reviewed exception
 * to "only verified badges", requested for the platform's own accounts so the
 * full set can be seen in the product. Badges are candidate-only (no recruiter
 * surface reads them), so this changes display and nothing else. Any badge
 * these accounts really earned keeps its real award date.
 *
 * Lower-case; compared against the account email lower-cased.
 */
export const BADGE_SHOWCASE_EMAILS: ReadonlySet<string> = new Set([
  "shivanshrai2316@gmail.com",
  "sksohail.swaraj@gmail.com",
  "contactsuyashgupta@gmail.com",
  "sarthakgupta.ksj@gmail.com",
]);

/** Names for cohort badges whose cohort row does not exist in this database. */
const SHOWCASE_COHORT_FALLBACK_NAMES: Record<string, string> = {
  [DATABRICKS_COHORT_SLUG]: "Databricks",
  [DATABRICKS_AI_COHORT_SLUG]: "Databricks Data & AI Engineering",
  [SNOWFLAKE_COHORT_SLUG]: "Snowflake",
  [LANGCHAIN_COHORT_SLUG]: "LangChain",
  [POWERBI_COHORT_SLUG]: "Power BI",
  [DS_ARCHITECT_COHORT_SLUG]: "DS Architect",
};

async function isShowcaseAccount(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return Boolean(user && BADGE_SHOWCASE_EMAILS.has(user.email.toLowerCase()));
}

/** The full badge set, dated `at`, with real cohort names where they exist. */
async function allBadges(at: Date): Promise<EarnedBadge[]> {
  const slugs = Object.keys(COHORT_BADGES);
  const [cohorts, aiCohort] = await Promise.all([
    prisma.cohort.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, name: true },
    }),
    prisma.cohort.findFirst({
      where: { slug: { startsWith: "legacy-program-" } },
      orderBy: { createdAt: "desc" },
      select: { slug: true, name: true },
    }),
  ]);
  const nameBySlug = new Map(cohorts.map((c) => [c.slug, c.name]));

  const out: EarnedBadge[] = [claudeBadge(at)];
  for (const domain of [Domain.AI, Domain.DS, Domain.SE]) {
    const mark = CHALLENGE_MARK[domain];
    if (mark) out.push(challengeBadge(domain, mark, at));
  }
  out.push(
    aiCohortBadge(
      aiCohort?.slug ?? "ai-cohort-program",
      aiCohort?.name ?? "AI Cohort Program",
      at,
    ),
  );
  for (const slug of slugs) {
    const name =
      nameBySlug.get(slug) ??
      SHOWCASE_COHORT_FALLBACK_NAMES[slug] ??
      "Coding Practice";
    const badge = cohortBadge(slug, name, at);
    if (badge) out.push(badge);
  }
  for (const milestone of CONSISTENCY_MILESTONES) {
    out.push(consistencyBadge(milestone, at));
  }
  return out;
}

/**
 * Every badge this user has earned, newest first. Server-side only: each one
 * is re-derived from the verifying record on every call, so the browser can
 * never award one and a repeated event can never duplicate one (the key is
 * unique per user by construction). Showcase accounts additionally see the
 * full set (see BADGE_SHOWCASE_EMAILS).
 *
 * All sources or nothing: a partial list would read as "not earned".
 */
export async function getEarnedBadges(userId: string): Promise<BadgesState> {
  try {
    const [groups, showcase] = await Promise.all([
      Promise.all([
        challengeBadges(userId),
        cohortBadges(userId),
        consistencyBadges(userId),
      ]),
      isShowcaseAccount(userId),
    ]);
    const unique = new Map<string, EarnedBadge>();
    // Real awards first, so their dates win over the showcase fill-in.
    for (const badge of groups.flat()) {
      if (!unique.has(badge.key)) unique.set(badge.key, badge);
    }
    if (showcase) {
      for (const badge of await allBadges(new Date())) {
        if (!unique.has(badge.key)) unique.set(badge.key, badge);
      }
    }
    const badges = [...unique.values()].sort((a, b) =>
      b.awardedAt.localeCompare(a.awardedAt),
    );
    return { ok: true, badges };
  } catch (error) {
    logger.error("[badges] getEarnedBadges failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}
