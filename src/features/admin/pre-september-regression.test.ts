/**
 * T-282 seven pre-September journeys.
 *   npm run test:pre-september
 */
import { existsSync, readFileSync } from "node:fs";
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
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function exists(rel: string): boolean {
  return existsSync(join(process.cwd(), rel));
}

console.log("\nT-282 pre-September journeys");

suite("1 candidate sign-in", () => {
  const auth = read("src/auth.ts");
  assert(auth.includes("export const { handlers, auth, signIn, signOut }"), "auth exports");
  assert(exists("src/app/login/page.tsx"), "login page");
});

suite("2 60-day challenge submit", () => {
  const src = read("src/app/actions/submission-actions.ts");
  assert(src.length > 0, "submission-actions exists");
  assert(/submission/i.test(src), "writes a Submission path");
});

suite("3 weekly quiz", () => {
  const src = read("src/app/actions/quiz-actions.ts");
  assert(src.includes("export async function submitQuizAction"), "submitQuizAction");
});

suite("4 program / AI cohort dashboard", () => {
  assert(exists("src/app/program/ai-cohort/page.tsx"), "ai-cohort page");
});

suite("5 hackathon dashboard", () => {
  assert(
    exists("src/app/hackathon/(app)/dashboard/page.tsx"),
    "hackathon dashboard",
  );
});

suite("6 public certificate verify", () => {
  const src = read("src/app/verify/[certificateId]/page.tsx");
  assert(!src.includes("requireAdmin"), "verify is not admin-gated");
});

suite("7 mock interview catalogue + start", () => {
  const actions = read("src/app/actions/mock-interview-actions.ts");
  const page = read("src/app/mock-interviews/page.tsx");
  assert(actions.includes("startMockInterviewAction"), "start action");
  assert(page.includes("signedIn"), "readable signed-out");
});

suite("middleware stays edge-safe", () => {
  const mw = read("middleware.ts");
  assert(!mw.includes('from "@/lib/'), "middleware has no @/lib/ import");
  const cfg = read("src/auth.config.ts");
  assert(!cfg.includes("@prisma/client"), "auth.config has no Prisma");
  assert(!cfg.includes('from "@/lib/'), "auth.config has no @/lib/");
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
