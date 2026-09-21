/**
 * W7-B pre-freeze catch-up: the one Enrollment missing pe_enr_<id>.
 * Insert-only. Rerun is a no-op. Does not remirror streaks on an existing PE.
 *
 * Dry run default. --apply writes. Production: PHASE2_ALLOW_PRODUCTION=1.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { EnrollmentStatus, EnrollmentStatusV2, PrismaClient } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import { cohortSlugForDomain, peIdForEnrollment } from "../../src/repositories/ids";

const TARGET_ENROLLMENT_ID = "cmubeavy70002vfe9l90dz2vg";

const prisma = new PrismaClient();

function mapChallengeStatus(status: EnrollmentStatus): EnrollmentStatusV2 {
  if (status === EnrollmentStatus.COMPLETED) return EnrollmentStatusV2.COMPLETED;
  if (status === EnrollmentStatus.ABANDONED) return EnrollmentStatusV2.DROPPED;
  return EnrollmentStatusV2.ACTIVE;
}

async function diagnose() {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: TARGET_ENROLLMENT_ID },
    select: {
      id: true,
      userId: true,
      domain: true,
      status: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      currentStreak: true,
      longestStreak: true,
      daysCompleted: true,
      lastSubmittedDay: true,
      challengeId: true,
      user: { select: { id: true, email: true, deletedAt: true } },
      challenge: { select: { id: true, domain: true } },
    },
  });

  const peId = peIdForEnrollment(TARGET_ENROLLMENT_ID);
  const existingPe = await prisma.programEnrollment.findUnique({
    where: { id: peId },
    select: {
      id: true,
      userId: true,
      cohortId: true,
      status: true,
      trackCurrentStreak: true,
      trackLongestStreak: true,
    },
  });

  const cohortSlug = enrollment
    ? cohortSlugForDomain(enrollment.domain)
    : null;
    const cohort = cohortSlug
    ? await prisma.cohort.findUnique({
        where: { slug: cohortSlug },
        select: { id: true, slug: true },
      })
    : null;

  const alternatePe =
    enrollment && cohort
      ? await prisma.programEnrollment.findFirst({
          where: {
            userId: enrollment.userId,
            cohortId: cohort.id,
            NOT: { id: peId },
          },
          select: { id: true, status: true },
        })
      : null;

  const mapping = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::bigint AS n FROM "Enrollment" e
    WHERE NOT EXISTS (
      SELECT 1 FROM "ProgramEnrollment" pe WHERE pe.id = 'pe_enr_' || e.id
    )
  `;

  return {
    enrollment,
    peId,
    existingPe,
    cohort,
    alternatePe,
    enrollmentMissingPe: Number(mapping[0]?.n ?? -1),
  };
}

async function main() {
  assertChildBranch();
  const apply = process.argv.includes("--apply");
  const diagnosis = await diagnose();
  console.log(JSON.stringify({ apply, diagnosis }, null, 2));

  const { enrollment, existingPe, cohort, alternatePe, peId } =
    diagnosis;

  if (!enrollment) {
    throw new Error(`Enrollment ${TARGET_ENROLLMENT_ID} does not exist`);
  }
  if (!enrollment.user) {
    throw new Error("User missing");
  }
  if (!enrollment.challenge) {
    throw new Error("Challenge missing");
  }
  if (!cohort) {
    throw new Error(`Missing canonical cohort ${cohortSlugForDomain(enrollment.domain)}`);
  }
  if (alternatePe) {
    throw new Error(
      `Alternate ProgramEnrollment ${alternatePe.id} already represents user+cohort; refusing to insert ${peId}`,
    );
  }

  if (existingPe) {
    console.log(
      JSON.stringify({
        action: "noop",
        reason: "canonical ProgramEnrollment already exists",
        peId: existingPe.id,
        enrollmentMissingPe: diagnosis.enrollmentMissingPe,
      }),
    );
    return;
  }

  if (!apply) {
    console.log("Dry run. Pass --apply to insert pe_enr_<Enrollment.id>.");
    return;
  }

  await prisma.programEnrollment.create({
    data: {
      id: peId,
      userId: enrollment.userId,
      cohortId: cohort.id,
      status: mapChallengeStatus(enrollment.status),
      startedAt: enrollment.startedAt,
      enrolledAt: enrollment.startedAt,
      completedAt: enrollment.completedAt,
      createdAt: enrollment.createdAt,
      trackCurrentStreak: enrollment.currentStreak,
      trackLongestStreak: enrollment.longestStreak,
    },
  });

  const after = await diagnose();
  if (!after.existingPe) {
    throw new Error("Insert did not create ProgramEnrollment");
  }
  if (after.enrollmentMissingPe !== 0) {
    throw new Error(
      `Mapping still missing ${after.enrollmentMissingPe} ProgramEnrollment rows`,
    );
  }
  console.log(
    JSON.stringify({
      action: "inserted",
      peId,
      enrollmentMissingPe: after.enrollmentMissingPe,
      trackCurrentStreak: after.existingPe.trackCurrentStreak,
      trackLongestStreak: after.existingPe.trackLongestStreak,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
