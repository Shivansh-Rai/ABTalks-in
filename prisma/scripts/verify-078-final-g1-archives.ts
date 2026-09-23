/**
 * Gate 1 historical archive backfill verification.
 * Additive copy only. Refuses production unless PHASE2_ALLOW_PRODUCTION=1.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { PrismaClient } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";

const prisma = new PrismaClient();

function n(v: bigint | number | undefined): number {
  return Number(v ?? 0);
}

async function main() {
  assertChildBranch();
  const rows = await prisma.$queryRaw<
    Array<{
      qa: bigint;
      hqa: bigint;
      qa_unmapped: bigint;
      qa_json_changed: bigint;
      pms: bigint;
      hpm: bigint;
      pms_unmapped: bigint;
      cert: bigint;
      hcert: bigint;
      cert_unmapped: bigint;
      sub: bigint;
      hsub: bigint;
      sub_unmapped: bigint;
      se: bigint;
      hse: bigint;
      se_unmapped: bigint;
      sp: bigint;
      hsp: bigint;
      sp_unmapped: bigint;
    }>
  >`
    SELECT
      (SELECT count(*)::bigint FROM "QuizAttempt") AS qa,
      (SELECT count(*)::bigint FROM "HistoricalQuizAttempt") AS hqa,
      (SELECT count(*)::bigint FROM "QuizAttempt" q
        WHERE NOT EXISTS (
          SELECT 1 FROM "HistoricalQuizAttempt" h WHERE h."legacyId" = q.id
        )) AS qa_unmapped,
      (SELECT count(*)::bigint FROM "QuizAttempt" q
        JOIN "HistoricalQuizAttempt" h ON h."legacyId" = q.id
        WHERE q.answers IS DISTINCT FROM h.answers
           OR q.score IS DISTINCT FROM h.score
           OR q."userId" IS DISTINCT FROM h."userId"
           OR q."quizId" IS DISTINCT FROM h."quizId"
        ) AS qa_json_changed,
      (SELECT count(*)::bigint FROM "ProgramMissionSubmission") AS pms,
      (SELECT count(*)::bigint FROM "HistoricalProgramMission") AS hpm,
      (SELECT count(*)::bigint FROM "ProgramMissionSubmission" s
        WHERE NOT EXISTS (
          SELECT 1 FROM "HistoricalProgramMission" h WHERE h."legacyId" = s.id
        )) AS pms_unmapped,
      (SELECT count(*)::bigint FROM "Certificate") AS cert,
      (SELECT count(*)::bigint FROM "HistoricalCertificate") AS hcert,
      (SELECT count(*)::bigint FROM "Certificate" c
        WHERE NOT EXISTS (
          SELECT 1 FROM "HistoricalCertificate" h WHERE h."legacyId" = c.id
        )) AS cert_unmapped,
      (SELECT count(*)::bigint FROM "Submission") AS sub,
      (SELECT count(*)::bigint FROM "HistoricalSubmission") AS hsub,
      (SELECT count(*)::bigint FROM "Submission" s
        WHERE NOT EXISTS (
          SELECT 1 FROM "HistoricalSubmission" h WHERE h."legacyId" = s.id
        )) AS sub_unmapped,
      (SELECT count(*)::bigint FROM "SynergyEvent") AS se,
      (SELECT count(*)::bigint FROM "HistoricalSynergyEvent") AS hse,
      (SELECT count(*)::bigint FROM "SynergyEvent" e
        WHERE NOT EXISTS (
          SELECT 1 FROM "HistoricalSynergyEvent" h WHERE h."legacyId" = e.id
        )) AS se_unmapped,
      (SELECT count(*)::bigint FROM "StudentProfile") AS sp,
      (SELECT count(*)::bigint FROM "HistoricalStudentProfile") AS hsp,
      (SELECT count(*)::bigint FROM "StudentProfile" p
        WHERE NOT EXISTS (
          SELECT 1 FROM "HistoricalStudentProfile" h WHERE h."legacyId" = p.id
        )) AS sp_unmapped
  `;
  const r = rows[0]!;
  const report = {
    quiz: { source: n(r.qa), archive: n(r.hqa), unmapped: n(r.qa_unmapped), rawChanged: n(r.qa_json_changed) },
    mission: { source: n(r.pms), archive: n(r.hpm), unmapped: n(r.pms_unmapped) },
    certificate: { source: n(r.cert), archive: n(r.hcert), unmapped: n(r.cert_unmapped) },
    submission: { source: n(r.sub), archive: n(r.hsub), unmapped: n(r.sub_unmapped) },
    synergy: { source: n(r.se), archive: n(r.hse), unmapped: n(r.se_unmapped) },
    studentProfile: { source: n(r.sp), archive: n(r.hsp), unmapped: n(r.sp_unmapped) },
  };
  console.log(JSON.stringify(report, null, 2));
  const blockers = [
    report.quiz.unmapped,
    report.quiz.rawChanged,
    report.mission.unmapped,
    report.certificate.unmapped,
    report.submission.unmapped,
    report.synergy.unmapped,
    report.studentProfile.unmapped,
    report.quiz.source !== report.quiz.archive ? 1 : 0,
    report.mission.source !== report.mission.archive ? 1 : 0,
    report.certificate.source !== report.certificate.archive ? 1 : 0,
    report.submission.source !== report.submission.archive ? 1 : 0,
    report.synergy.source !== report.synergy.archive ? 1 : 0,
    report.studentProfile.source !== report.studentProfile.archive ? 1 : 0,
  ].filter((x) => x > 0);
  if (blockers.length > 0) {
    throw new Error("Gate 1 archive parity failed");
  }
  console.log("Gate 1 archive parity OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
