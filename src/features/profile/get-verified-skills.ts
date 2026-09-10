import "server-only";
import { Domain, EnrollmentStatusV2 } from "@prisma/client";
import { prisma } from "@/lib/db";
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
  into: Map<string, VerifiedSkill>,
  rows: readonly ProgramSkillRow[],
  sourceLabel: string,
): void {
  for (const row of rows) {
    const existing = into.get(row.skillId);
    if (existing) {
      if (!existing.sources.includes(sourceLabel)) {
        existing.sources.push(sourceLabel);
      }
      continue;
    }
    into.set(row.skillId, {
      skillId: row.skillId,
      name: row.skill.name,
      sources: [sourceLabel],
    });
  }
}

export async function getVerifiedSkills(
  userId: string,
): Promise<VerifiedSkill[]> {
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

  const byId = new Map<string, VerifiedSkill>();

  /* ── Challenges: 50+ days completed ── */
  const qualified = (
    await Promise.all(
      enrollments.map(async (e) => {
        // Flag-aware: derives from attempts when the 078 progress read is on,
        // and falls back to the legacy Enrollment snapshot when it is not.
        const stats = await getChallengeProgressStats(e.id);
        return stats.daysCompleted >= CHALLENGE_ELIGIBLE_DAYS ? e.domain : null;
      }),
    )
  ).filter((d): d is Domain => d !== null);

  if (qualified.length > 0) {
    const slugs = [...new Set(qualified.map((d) => PROGRAM_SLUG_BY_DOMAIN[d]))];
    const programs = await prisma.learningProgram.findMany({
      where: { slug: { in: slugs } },
      select: {
        title: true,
        skills: {
          select: { skillId: true, skill: { select: { name: true } } },
        },
      },
    });
    for (const program of programs) {
      collect(byId, program.skills, program.title);
    }
  }

  /* ── Cohorts: the whole run finished ── */
  for (const row of completedCohorts) {
    const program = row.cohort.programVersion.program;
    collect(byId, program.skills, program.title);
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
