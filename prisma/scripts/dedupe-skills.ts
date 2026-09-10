/**
 * Fold duplicate `Skill` rows onto their canonical spelling.
 *
 * The catalog was seeded from free-text `StudentProfile.skills`, so one
 * technology can exist several times — "Tailwind css", "Tailwind CSS",
 * "TailwindCSS". The profile pickers already read the curated list in
 * src/lib/skill-catalog.ts, so this is about the DATA: claims, evidence and
 * curriculum links that point at a duplicate row should point at one row.
 *
 * What it does, per canonical name:
 *   1. Find every Skill whose name or slug folds onto it.
 *   2. Keep the best row — the one already spelled canonically, else the one
 *      with the most claims — and rename it to the canonical spelling.
 *   3. Repoint CandidateSkill / ActivitySkill / ProgramSkill / JobSkill /
 *      AssessmentScore at the keeper, merging rather than duplicating.
 *   4. Absorb the losers' names into the keeper's `aliases`, then delete them.
 *
 * SkillEvidence is never touched directly: it hangs off CandidateSkill, and a
 * merged claim keeps its rows.
 *
 * Idempotent. Refuses the production Neon host. DRY RUN BY DEFAULT — pass
 * `--apply` to write.
 *
 *   npx tsx prisma/scripts/dedupe-skills.ts          # report only
 *   npx tsx prisma/scripts/dedupe-skills.ts --apply  # perform the merge
 */
import { PrismaClient } from "@prisma/client";
import { CANONICAL_SKILLS, canonicalSkillName } from "../../src/lib/skill-catalog";

const PRODUCTION_NEON_HOST_ID = "ep-nameless-term-ams9a5e3";
const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient();

function assertNotProduction(): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (process.env.SEED_ALLOW_PRODUCTION === "true") {
    console.warn("SEED_ALLOW_PRODUCTION=true — production guard bypassed");
    return;
  }
  if (dbUrl.toLowerCase().includes(PRODUCTION_NEON_HOST_ID)) {
    throw new Error(
      `Refusing to run: DATABASE_URL points at production (${PRODUCTION_NEON_HOST_ID}).`,
    );
  }
}

async function main(): Promise<void> {
  assertNotProduction();

  const all = await prisma.skill.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      aliases: true,
      _count: { select: { candidateSkills: true } },
    },
  });

  // canonical name → the rows that fold onto it
  const groups = new Map<string, typeof all>();
  for (const row of all) {
    const canonical = canonicalSkillName(row.name);
    // Only fold names the curated catalog actually recognises. Anything else is
    // a real skill we simply have not catalogued, and must be left alone.
    const known = CANONICAL_SKILLS.some((c) => c.name === canonical);
    if (!known) continue;
    const bucket = groups.get(canonical) ?? [];
    bucket.push(row);
    groups.set(canonical, bucket);
  }

  let merged = 0;
  let renamed = 0;

  for (const [canonical, rows] of groups) {
    const exact = rows.filter((r) => r.name === canonical);
    const sorted = [...rows].sort(
      (a, b) => b._count.candidateSkills - a._count.candidateSkills,
    );
    const keeper = exact[0] ?? sorted[0];
    if (!keeper) continue;
    const losers = rows.filter((r) => r.id !== keeper.id);

    if (keeper.name !== canonical) {
      console.log(`  rename "${keeper.name}" → "${canonical}"`);
      renamed += 1;
      if (APPLY) {
        await prisma.skill.update({
          where: { id: keeper.id },
          data: { name: canonical },
        });
      }
    }

    if (losers.length === 0) continue;
    console.log(
      `  ${canonical}: absorbing ${losers.map((l) => `"${l.name}"`).join(", ")}`,
    );
    merged += losers.length;
    if (!APPLY) continue;

    for (const loser of losers) {
      await prisma.$transaction(async (tx) => {
        // A candidate who claimed both spellings must end with one claim.
        const existing = await tx.candidateSkill.findMany({
          where: { skillId: keeper.id },
          select: { userId: true },
        });
        const already = new Set(existing.map((r) => r.userId));
        const dupes = await tx.candidateSkill.findMany({
          where: { skillId: loser.id },
          select: { id: true, userId: true },
        });
        const collide = dupes.filter((d) => already.has(d.userId));
        const movable = dupes.filter((d) => !already.has(d.userId));

        if (movable.length > 0) {
          await tx.candidateSkill.updateMany({
            where: { id: { in: movable.map((d) => d.id) } },
            data: { skillId: keeper.id },
          });
        }
        // Colliding claims: the keeper's row already carries the claim, and
        // SkillEvidence cascades off these rows, so re-point the evidence first.
        for (const dupe of collide) {
          const target = await tx.candidateSkill.findFirst({
            where: { skillId: keeper.id, userId: dupe.userId },
            select: { id: true },
          });
          if (target) {
            await tx.skillEvidence.updateMany({
              where: { candidateSkillId: dupe.id },
              data: { candidateSkillId: target.id },
            });
          }
          await tx.candidateSkill.delete({ where: { id: dupe.id } });
        }

        // Curriculum / job / assessment links: move what does not collide,
        // drop what does (the unique pair already exists on the keeper).
        await tx.activitySkill.deleteMany({
          where: {
            skillId: loser.id,
            activity: { skills: { some: { skillId: keeper.id } } },
          },
        });
        await tx.activitySkill.updateMany({
          where: { skillId: loser.id },
          data: { skillId: keeper.id },
        });

        await tx.programSkill.deleteMany({
          where: {
            skillId: loser.id,
            program: { skills: { some: { skillId: keeper.id } } },
          },
        });
        await tx.programSkill.updateMany({
          where: { skillId: loser.id },
          data: { skillId: keeper.id },
        });

        await tx.jobSkill.deleteMany({
          where: {
            skillId: loser.id,
            job: { skills: { some: { skillId: keeper.id } } },
          },
        });
        await tx.jobSkill.updateMany({
          where: { skillId: loser.id },
          data: { skillId: keeper.id },
        });

        await tx.assessmentScore.updateMany({
          where: { skillId: loser.id },
          data: { skillId: keeper.id },
        });

        const aliases = new Set([
          ...keeper.aliases,
          loser.name.toLowerCase(),
          loser.slug,
        ]);
        aliases.delete(canonical.toLowerCase());
        await tx.skill.update({
          where: { id: keeper.id },
          data: { aliases: [...aliases] },
        });
        await tx.skill.delete({ where: { id: loser.id } });
      });
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Dry run"} — ${merged} duplicate rows folded, ${renamed} renamed.`,
  );
  if (!APPLY && (merged > 0 || renamed > 0)) {
    console.log("Re-run with --apply to write these changes.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
