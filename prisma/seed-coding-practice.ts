/**
 * Seed the catalog rows for coding practice (plan 186).
 *
 * Question content (statements, starter code, harnesses, test cases) is NOT in
 * the database: it is JSON under src/features/coding-practice/content and is
 * read from there at runtime. This seed writes only the rows a submission has
 * to reference: LearningProgram -> ProgramVersion -> Module -> one Activity per
 * question, plus the open Cohort learners enrol in.
 *
 * Idempotent. Refuses the production Neon host. Never deletes an Activity.
 *
 * Run: npm run db:seed:coding-practice
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  ActivityType,
  ActivityUnlockRule,
  CohortStartMode,
  CohortStatus,
  PrismaClient,
  ProgramFormat,
  ProgramVersionStatus,
} from "@prisma/client";
import {
  PRACTICE_PROGRAM_SLUGS,
  PRACTICE_QUESTIONS_PER_DAY,
  PRACTICE_TZ,
  cohortSlugFor,
} from "../src/features/coding-practice/constants";
import {
  getPracticeChallenge,
  getPracticeDayIndex,
} from "../src/features/coding-practice/content";

const PRODUCTION_NEON_HOST_ID = "ep-nameless-term-ams9a5e3";
const CATEGORY_SLUG = "dsa";
const CATEGORY_NAME = "DSA";
const SORT_ORDER = 80;

function assertNotProduction(): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (process.env.SEED_ALLOW_PRODUCTION === "true") {
    console.warn("SEED_ALLOW_PRODUCTION=true: production guard bypassed");
    return;
  }
  if (dbUrl.toLowerCase().includes(PRODUCTION_NEON_HOST_ID)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL points at production (${PRODUCTION_NEON_HOST_ID}).`,
    );
  }
  const host = dbUrl.split("@")[1]?.split("/")[0] ?? "(unknown)";
  console.log(`[coding-practice-seed] targeting host: ${host}`);
}

async function seedProgram(prisma: PrismaClient, slug: string): Promise<void> {
  // Parses and validates every content file; throws on a bad one.
  const challenge = getPracticeChallenge(slug);
  if (!challenge) {
    throw new Error(`[coding-practice-seed] no content for "${slug}"`);
  }
  const days = getPracticeDayIndex(slug);
  const questionCount = days.reduce((n, d) => n + d.questions.length, 0);

  const category = await prisma.programCategory.upsert({
    where: { slug: CATEGORY_SLUG },
    create: {
      slug: CATEGORY_SLUG,
      name: CATEGORY_NAME,
      description: "Data structures and algorithms practice",
      colorToken: CATEGORY_SLUG,
      sortOrder: SORT_ORDER,
      isActive: true,
    },
    update: { name: CATEGORY_NAME, isActive: true },
    select: { id: true },
  });

  const program = await prisma.learningProgram.upsert({
    where: { slug },
    create: {
      slug,
      title: challenge.title,
      subtitle: challenge.subtitle,
      description: challenge.description,
      categoryId: category.id,
      format: ProgramFormat.CHALLENGE,
      isPublished: true,
      sortOrder: SORT_ORDER,
    },
    update: {
      title: challenge.title,
      subtitle: challenge.subtitle,
      description: challenge.description,
      isPublished: true,
    },
    select: { id: true },
  });

  const version = await prisma.programVersion.upsert({
    where: {
      programId_versionNumber: { programId: program.id, versionNumber: 1 },
    },
    create: {
      programId: program.id,
      versionNumber: 1,
      status: ProgramVersionStatus.PUBLISHED,
      plannedDurationDays: challenge.totalDays,
      requiredActivityCount: questionCount,
      publishedAt: new Date(),
    },
    update: {
      status: ProgramVersionStatus.PUBLISHED,
      plannedDurationDays: challenge.totalDays,
      requiredActivityCount: questionCount,
    },
    select: { id: true },
  });

  const moduleRow = await prisma.module.upsert({
    where: {
      programVersionId_position: { programVersionId: version.id, position: 1 },
    },
    create: {
      programVersionId: version.id,
      position: 1,
      title: challenge.title,
      startDay: 1,
      endDay: challenge.totalDays,
    },
    update: {
      title: challenge.title,
      startDay: 1,
      endDay: challenge.totalDays,
    },
    select: { id: true },
  });

  const seededIds = new Set<string>();
  for (const day of days) {
    for (const question of day.questions) {
      const data = {
        moduleId: moduleRow.id,
        position: (day.day - 1) * PRACTICE_QUESTIONS_PER_DAY + question.slot,
        type: ActivityType.CODING,
        title: question.title,
        dayNumber: day.day,
        difficulty: question.difficulty,
        tags: question.tags,
        points: 0,
        isRequired: true,
        unlockRule: ActivityUnlockRule.SCHEDULED,
      };
      await prisma.activity.upsert({
        where: { id: question.activityId },
        create: { id: question.activityId, ...data },
        update: data,
        select: { id: true },
      });
      seededIds.add(question.activityId);
    }
  }

  // An Activity that left the JSON is reported, never deleted: accepted
  // submissions reference it (ActivityAttempt.activity is onDelete: Restrict).
  const existing = await prisma.activity.findMany({
    where: { moduleId: moduleRow.id },
    select: { id: true },
  });
  for (const { id } of existing) {
    if (!seededIds.has(id)) {
      console.warn(
        `[coding-practice-seed] ${id} is in the database but not in the content. Left in place.`,
      );
    }
  }

  const cohortSlug = cohortSlugFor(slug);
  const cohort = {
    programVersionId: version.id,
    name: challenge.title,
    startMode: CohortStartMode.ROLLING,
    startsAt: null,
    endsAt: null,
    timezone: PRACTICE_TZ,
    status: CohortStatus.ACTIVE,
    capacity: null,
    requiresJoinCode: false,
    joinCode: null,
  };
  await prisma.cohort.upsert({
    where: { slug: cohortSlug },
    create: { slug: cohortSlug, ...cohort },
    update: cohort,
    select: { id: true },
  });

  console.log(
    `[coding-practice-seed] upserted program=${slug} days=${days.length} activities=${questionCount} cohort=${cohortSlug}`,
  );
}

async function main(): Promise<void> {
  assertNotProduction();
  const prisma = new PrismaClient();
  try {
    for (const slug of PRACTICE_PROGRAM_SLUGS) {
      await seedProgram(prisma, slug);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
