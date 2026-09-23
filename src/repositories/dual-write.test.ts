/**
 * Final 078 source guard: production runtime must not use retired Prisma
 * delegates. Historical* archive models remain allowed.
 *
 * Run: npm run test:legacy-source-guard
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  }
}

function walkSrc(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walkSrc(full, acc);
    } else if (
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

const FORBIDDEN = [
  "prisma.studentProfile",
  "prisma.enrollment",
  "prisma.programMember",
  "prisma.certificate",
  "prisma.submission",
  "prisma.quizAttempt",
  "prisma.programMissionSubmission",
  "prisma.synergyEvent",
  "tx.studentProfile",
  "tx.enrollment",
  "tx.programMember",
  "tx.certificate",
  "tx.submission",
  "tx.quizAttempt",
  "tx.programMissionSubmission",
  "tx.synergyEvent",
] as const;

const ALLOWED_SUBSTRINGS = [
  "prisma.enrollmentProgress",
  "tx.enrollmentProgress",
  "prisma.enrollmentDayActivity",
  "tx.enrollmentDayActivity",
  "historicalCertificate",
  "historicalSubmission",
  "historicalQuizAttempt",
  "historicalStudentProfile",
  "historicalSynergyEvent",
  "historicalProgramMission",
];

function isAllowedHit(text: string, index: number, needle: string): boolean {
  const window = text.slice(Math.max(0, index - 40), index + needle.length + 40);
  return ALLOWED_SUBSTRINGS.some((ok) => window.includes(ok));
}

function main() {
  console.log("\n078 retired-model source guard\n");

  suite("dual-write.ts is deleted", () => {
    assert(
      !existsSync(join(process.cwd(), "src/repositories/dual-write.ts")),
      "dual-write.ts must not exist",
    );
  });

  suite("legacy ProgramMember / StudentProfile shims are deleted", () => {
    assert(
      !existsSync(join(process.cwd(), "src/repositories/legacy/program-member.ts")),
      "legacy/program-member.ts must not exist",
    );
    assert(
      !existsSync(join(process.cwd(), "src/repositories/legacy/student-profile.ts")),
      "legacy/student-profile.ts must not exist",
    );
  });

  suite("runtime src has 0 retired Prisma delegates", () => {
    const files = walkSrc(join(process.cwd(), "src"));
    const hits: string[] = [];
    for (const file of files) {
      const rel = file.slice(process.cwd().length + 1);
      const text = readFileSync(file, "utf8");
      for (const needle of FORBIDDEN) {
        let from = 0;
        while (true) {
          const index = text.indexOf(needle, from);
          if (index === -1) break;
          if (!isAllowedHit(text, index, needle)) {
            hits.push(`${rel}: ${needle}`);
          }
          from = index + needle.length;
        }
      }
    }
    assert(hits.length === 0, hits.join("\n"));
  });

  suite("schema has Historical* archives and no original models", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    for (const name of [
      "HistoricalQuizAttempt",
      "HistoricalProgramMission",
      "HistoricalCertificate",
      "HistoricalSubmission",
      "HistoricalSynergyEvent",
      "HistoricalStudentProfile",
    ]) {
      assert(schema.includes(`model ${name} `) || schema.includes(`model ${name}{`), name);
    }
    for (const name of [
      "model StudentProfile ",
      "model Enrollment ",
      "model ProgramMember ",
      "model Certificate ",
      "model Submission ",
      "model QuizAttempt ",
      "model ProgramMissionSubmission ",
      "model SynergyEvent ",
    ]) {
      assert(!schema.includes(name), `retired ${name.trim()}`);
    }
    assert(!schema.includes("synergyPoints"), "User.synergyPoints retired");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
