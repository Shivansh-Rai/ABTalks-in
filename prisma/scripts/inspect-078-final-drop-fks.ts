import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const host = process.env.DATABASE_URL ?? "";
  if (host.includes("ep-nameless-term-ams9a5e3") || host.includes("ep-young-shadow-amawetjy")) {
    throw new Error("Refusing production or unrelated host");
  }
  if (!host.includes("ep-dark-bar-amxz0fjv")) {
    throw new Error(`Unexpected host: ${host}`);
  }

  const fks = await prisma.$queryRaw<
    Array<{ from_table: string; to_table: string; conname: string; def: string }>
  >`
    SELECT c.conrelid::regclass::text AS from_table,
           c.confrelid::regclass::text AS to_table,
           c.conname,
           pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_class dst ON dst.oid = c.confrelid
    WHERE c.contype = 'f'
      AND (
        dst.relname IN (
          'ProgramMember','Enrollment','Submission','QuizAttempt',
          'ProgramMissionSubmission','Certificate','SynergyEvent','StudentProfile'
        )
        OR src.relname IN (
          'ProgramMember','Enrollment','Submission','QuizAttempt',
          'ProgramMissionSubmission','Certificate','SynergyEvent','StudentProfile'
        )
      )
    ORDER BY 2, 1
  `;
  console.log(JSON.stringify({ fks }, null, 2));

  const counts = await prisma.$queryRaw<Array<Record<string, bigint>>>`
    SELECT
      (SELECT count(*) FROM "ProgramMember") AS program_member,
      (SELECT count(*) FROM "Enrollment") AS enrollment,
      (SELECT count(*) FROM "Submission") AS submission,
      (SELECT count(*) FROM "QuizAttempt") AS quiz_attempt,
      (SELECT count(*) FROM "ProgramMissionSubmission") AS pms,
      (SELECT count(*) FROM "Certificate") AS certificate,
      (SELECT count(*) FROM "SynergyEvent") AS synergy_event,
      (SELECT count(*) FROM "StudentProfile") AS student_profile,
      (SELECT count(*) FROM "HistoricalQuizAttempt") AS h_quiz,
      (SELECT count(*) FROM "HistoricalCertificate") AS h_cert,
      (SELECT count(*) FROM "HistoricalStudentProfile") AS h_sp
  `;
  console.log(JSON.stringify({ counts }, (_, v) => (typeof v === "bigint" ? Number(v) : v), 2));

  const head = await prisma.$queryRaw<
    Array<{ migration_name: string; finished_at: Date | null }>
  >`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 8
  `;
  console.log(JSON.stringify({ schemaHead: head }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
