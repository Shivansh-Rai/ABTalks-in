import "server-only";
import { Domain, EnrollmentStatusV2 } from "@prisma/client";
import { prisma } from "@/lib/db";
import { peIdForEnrollment } from "@/repositories/ids";
import { getChallengeProgressStats } from "@/repositories/progress";

/**
 * ABTalks Verified Skills — derived from curriculum + completion.
 *
 *   LearningProgram (curriculum)
 *     → ProgramSkill (which core skills it teaches)
 *       → the user's completion of a run of it
 *         → verified skills
 *
 * Nothing is stored per user and nothing is copied: the skills come from
 * `ProgramSkill`, seeded from prisma/content/curriculum-skills.json. Add a new
 * cohort with skills and anyone already past the bar picks them up on their
 * next profile load. There is no write path, so the user cannot edit these.
 *
 * The bar is completion, never enrolment:
 *   - 60-day challenge → at least 50 days completed
 *   - cohort           → the run is recorded COMPLETED
 *
 * Contrast `CandidateSkill`, which is what the candidate claims themselves.
 */

export type VerifiedSkill = {
  skillId: string;
  name: string;
  /** Every program that earned it, e.g. ["60-Day Claude Challenge"]. */
  sources: string[];
};

/**
 * Where one verified skill came from, as a real record with a real date.
 *
 * Admin-only on purpose: `getVerifiedSkills` keeps its old shape so the
 * candidate's own /profile payload does not start carrying enrolment ids.
 */
export type VerifiedSkillOrigin = {
  kind: "CHALLENGE" | "COHORT";
  programTitle: string;
  /** `Enrollment.id` for a challenge, `ProgramEnrollment.id` for a cohort. */
  enrollmentId: string;
  /**
   * When the bar was cleared: the submission that made the 50th completed day,
   * or the cohort run's `completedAt`. Null when the record does not carry it —
   * never a guessed date.
   */
  earnedAt: Date | null;
  basis: "50th completed day" | "cohort completed";
};

export type VerifiedSkillWithOrigins = VerifiedSkill & {
  origins: VerifiedSkillOrigin[];
};

/** Matches the certificate rule in features/certificate/issue-certificate.ts. */
const CHALLENGE_ELIGIBLE_DAYS = 50;

/**
 * LearningProgram slug per challenge domain, from the 078 content migration
 * (prisma/scripts/migrate-078-shared.ts PROGRAM_SLUG_BY_DOMAIN). A challenge's
 * curriculum lives on that program, so its skills hang off the same join table
 * the cohorts use.
 */
const PROGRAM_SLUG_BY_DOMAIN: Record<Domain, string> = {
  [Domain.SE]: "software-engineering-challenge",
  [Domain.DS]: "data-science-challenge",
  [Domain.AI]: "ai-engineering-challenge",
  [Domain.CLAUDE]: "claude-challenge",
};

/**
 * Challenge enrolments are ALSO mirrored into ProgramEnrollment against a
 * `legacy-<domain>` cohort (repositories/dual-write.ts). Those must not be read
 * as cohort completions: a challenge is governed by the 50-day rule below, and
 * counting the mirror too would let a challenge in under the wrong bar.
 *
 * `legacy-program-<id>` is NOT excluded — that is the real AI Cohort Program.
 */
const CHALLENGE_MIRROR_COHORT_SLUGS = Object.values(Domain).map(
  (d) => `legacy-${d.toLowerCase()}`,
);

type ProgramSkillRow = { skillId: string; skill: { name: string } };

function collect(
  into: Map<string, VerifiedSkillWithOrigins>,
  rows: readonly ProgramSkillRow[],
  origin: VerifiedSkillOrigin,
): void {
  for (const row of rows) {
    const existing = into.get(row.skillId);
    if (existing) {
      if (!existing.sources.includes(origin.programTitle)) {
        existing.sources.push(origin.programTitle);
      }
      existing.origins.push(origin);
      continue;
    }
    into.set(row.skillId, {
      skillId: row.skillId,
      name: row.skill.name,
      sources: [origin.programTitle],
      origins: [origin],
    });
  }
}

/**
 * The moment a challenge enrolment reached its 50th completed day, read from
 * the same rows `getChallengeProgressStats` counts under the same flag:
 * passed day-task attempts when the 078 progress read is on, `Submission` rows
 * when it is not. Null when fewer than 50 distinct days are found — the count
 * and the dated rows disagreeing is reported as "no date", not papered over.
 */
async function challengeQualifiedAt(enrollmentId: string): Promise<Date | null> {
  const days: { dayNumber: number; at: Date }[] = [];
const attempts = await prisma.activityAttempt.findMany({
  where: {
    enrollmentId: peIdForEnrollment(enrollmentId),
    id: { startsWith: "aa_sub_" },
    activityId: { startsWith: "act_dt_" },
  },
  select: {
    passed: true,
    submittedAt: true,
    createdAt: true,
    activity: { select: { dayNumber: true } },
    evaluations: {
      where: { isAuthoritative: true },
      select: { passed: true },
      take: 1,
    },
  },
});
for (const row of attempts) {
  const dayNumber = row.activity.dayNumber;
  if (dayNumber == null) continue;
  if (!(row.evaluations[0]?.passed ?? row.passed)) continue;
  days.push({ dayNumber, at: row.submittedAt ?? row.createdAt });
}

  days.sort((a, b) => a.at.getTime() - b.at.getTime());
  const seen = new Set<number>();
  for (const d of days) {
    seen.add(d.dayNumber);
    if (seen.size === CHALLENGE_ELIGIBLE_DAYS) return d.at;
  }
  return null;
}

async function loadVerifiedSkills(
  userId: string,
  withDates: boolean,
): Promise<VerifiedSkillWithOrigins[]> {
  const [enrollments, completedCohorts] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      select: { id: true, domain: true },
    }),
    prisma.programEnrollment.findMany({
      where: {
        userId,
        OR: [
          { status: EnrollmentStatusV2.COMPLETED },
          { completedAt: { not: null } },
        ],
        cohort: { slug: { notIn: CHALLENGE_MIRROR_COHORT_SLUGS } },
      },
      select: {
        id: true,
        completedAt: true,
        cohort: {
          select: {
            programVersion: {
              select: {
                program: {
                  select: {
                    title: true,
                    skills: {
                      select: { skillId: true, skill: { select: { name: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const byId = new Map<string, VerifiedSkillWithOrigins>();

  /* ── Challenges: 50+ days completed ── */
  const qualified = (
    await Promise.all(
      enrollments.map(async (e) => {
        // Flag-aware: derives from attempts when the 078 progress read is on,
        // and falls back to the legacy Enrollment snapshot when it is not.
        const stats = await getChallengeProgressStats(e.id);
        const qualifies = stats.daysCompleted >= CHALLENGE_ELIGIBLE_DAYS;
        if (!qualifies) return null;
        return {
          enrollmentId: e.id,
          domain: e.domain,
          earnedAt: withDates ? await challengeQualifiedAt(e.id) : null,
        };
      }),
    )
  ).filter((q): q is { enrollmentId: string; domain: Domain; earnedAt: Date | null } => q !== null);

  if (qualified.length > 0) {
    const slugs = [...new Set(qualified.map((q) => PROGRAM_SLUG_BY_DOMAIN[q.domain]))];
    const programs = await prisma.learningProgram.findMany({
      where: { slug: { in: slugs } },
      select: {
        slug: true,
        title: true,
        skills: {
          select: { skillId: true, skill: { select: { name: true } } },
        },
      },
    });
    for (const q of qualified) {
      const program = programs.find((p) => p.slug === PROGRAM_SLUG_BY_DOMAIN[q.domain]);
      if (!program) continue;
      collect(byId, program.skills, {
        kind: "CHALLENGE",
        programTitle: program.title,
        enrollmentId: q.enrollmentId,
        earnedAt: q.earnedAt,
        basis: "50th completed day",
      });
    }
  }

  /* ── Cohorts: the whole run finished ── */
  for (const row of completedCohorts) {
    const program = row.cohort.programVersion.program;
    collect(byId, program.skills, {
      kind: "COHORT",
      programTitle: program.title,
      enrollmentId: row.id,
      earnedAt: row.completedAt,
      basis: "cohort completed",
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getVerifiedSkills(
  userId: string,
): Promise<VerifiedSkill[]> {
  const rows = await loadVerifiedSkills(userId, false);
  return rows.map(({ skillId, name, sources }) => ({ skillId, name, sources }));
}

/** Admin: the same skills, each with the enrolment that earned it and when. */
export async function getVerifiedSkillsWithOrigins(
  userId: string,
): Promise<VerifiedSkillWithOrigins[]> {
  return loadVerifiedSkills(userId, true);
}
