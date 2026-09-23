/**
 * Gate F: prove the model-free Prisma client against a schema where original
 * legacy tables are already dropped. Refuses production host.
 */
import { PrismaClient } from "@prisma/client";

const PRODUCTION_HOST = "ep-nameless-term-ams9a5e3";
const EXPECTED_CHILD_HOST = "ep-dark-bar-amxz0fjv";

const DROPPED = [
  "StudentProfile",
  "Enrollment",
  "ProgramMember",
  "Certificate",
  "Submission",
  "QuizAttempt",
  "ProgramMissionSubmission",
  "SynergyEvent",
];

type CountRow = { n: bigint | number };

function asCount(rows: CountRow[]): number {
  return Number(rows[0]?.n ?? 0);
}

function hostOf(url: string): string {
  try {
    return new URL(url.replace(/^postgresql:/, "http:")).hostname;
  } catch {
    return "";
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = hostOf(url);
  if (!url) throw new Error("DATABASE_URL required");
  if (host.includes(PRODUCTION_HOST)) {
    throw new Error(`refusing production host ${host}`);
  }
  if (!host.includes(EXPECTED_CHILD_HOST) && process.env.ALLOW_OTHER_CHILD !== "1") {
    throw new Error(`expected child host ${EXPECTED_CHILD_HOST}, got ${host}`);
  }
  console.log(`[gate-f] host=${host}`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const leftover = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'StudentProfile',
          'Enrollment',
          'ProgramMember',
          'Certificate',
          'Submission',
          'QuizAttempt',
          'ProgramMissionSubmission',
          'SynergyEvent'
        )
    `;
    if (leftover.length > 0) {
      throw new Error(`legacy tables still present: ${leftover.map((r) => r.tablename).join(",")}`);
    }
    console.log("[gate-f] original legacy tables = 0");

    const synergyCol = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'User'
        AND column_name = 'synergyPoints'
    `;
    if (synergyCol.length > 0) {
      throw new Error("User.synergyPoints still present");
    }
    console.log("[gate-f] User.synergyPoints column = 0");

    const [
      hqa,
      hpm,
      hcert,
      hsub,
      hse,
      hsp,
      pe,
      aa,
      cp,
      pa,
    ] = await Promise.all([
      prisma.historicalQuizAttempt.count(),
      prisma.historicalProgramMission.count(),
      prisma.historicalCertificate.count(),
      prisma.historicalSubmission.count(),
      prisma.historicalSynergyEvent.count(),
      prisma.historicalStudentProfile.count(),
      prisma.programEnrollment.count(),
      prisma.activityAttempt.count(),
      prisma.candidateProfile.count(),
      prisma.pointsAccount.count(),
    ]);

    console.log("[gate-f] archives", {
      HistoricalQuizAttempt: hqa,
      HistoricalProgramMission: hpm,
      HistoricalCertificate: hcert,
      HistoricalSubmission: hsub,
      HistoricalSynergyEvent: hse,
      HistoricalStudentProfile: hsp,
    });
    console.log("[gate-f] canonical", {
      ProgramEnrollment: pe,
      ActivityAttempt: aa,
      CandidateProfile: cp,
      PointsAccount: pa,
    });

    if (hqa < 1 || hsub < 1 || hsp < 1) {
      throw new Error("archives unexpectedly empty on dropped child");
    }

    const quiz = await prisma.historicalQuizAttempt.findFirst({
      select: { id: true, answers: true, score: true },
    });
    if (!quiz) throw new Error("no HistoricalQuizAttempt row");
    console.log("[gate-f] historical quiz sample", { id: quiz.id, score: quiz.score });

    const sampleCp = await prisma.candidateProfile.findFirst({
      select: { userId: true, fullName: true, referralCode: true },
    });
    if (!sampleCp) throw new Error("no CandidateProfile");
    const samplePe = await prisma.programEnrollment.findFirst({
      select: { id: true, userId: true, status: true },
    });
    if (!samplePe) throw new Error("no ProgramEnrollment");
    const sampleAa = await prisma.activityAttempt.findFirst({
      select: { id: true, enrollmentId: true, passed: true },
    });
    console.log("[gate-f] sample identity/progress", {
      candidateUserId: sampleCp.userId,
      peId: samplePe.id,
      aaId: sampleAa?.id ?? null,
    });

    const email = `gatef.dropped.${Date.now()}@abtalks.dev`;
    const created = await prisma.user.create({
      data: {
        email,
        name: "Gate F Dropped Schema",
        password: "test",
        candidateProfile: {
          create: {
            fullName: "Gate F Dropped Schema",
            referralCode: `GF${Date.now().toString(36).slice(-6).toUpperCase()}`,
          },
        },
        pointsAccount: {
          create: { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
        },
      },
      select: { id: true },
    });
    await prisma.pointsTransaction.create({
      data: {
        userId: created.id,
        amount: 5,
        sourceType: "ADMIN_GRANT",
        idempotencyKey: `gatef:${created.id}:grant`,
        reason: "dropped-schema rehearsal",
      },
    });
    await prisma.pointsAccount.update({
      where: { userId: created.id },
      data: { balance: { increment: 5 }, lifetimeEarned: { increment: 5 } },
    });
    const after = await prisma.pointsAccount.findUnique({
      where: { userId: created.id },
      select: { balance: true },
    });
    if (after?.balance !== 5) throw new Error("points grant failed");

    await prisma.candidateProfile.update({
      where: { userId: created.id },
      data: { fullName: "Gate F Updated" },
    });
    await prisma.user.delete({ where: { id: created.id } });
    console.log("[gate-f] throwaway candidate/points write+cleanup ok");

    console.log("FINAL_APP_ON_DROPPED_SCHEMA_OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[gate-f] FAILED", err instanceof Error ? err.message : err);
  process.exit(1);
});
