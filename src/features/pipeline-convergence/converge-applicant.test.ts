/**
 * T-247 applicant → pipeline convergence — shape guarantees.
 *
 *   npm run test:t247-convergence
 *
 * A source-scan test in the same spirit as `talent-pipeline.test.ts`.
 * No network, no database. What it pins is the class of bug:
 *
 * - The convergence must call T-240's `addToPipeline` at `SOURCED`,
 *   using the Prisma enum (not a plain string that a future rename
 *   would silently break).
 * - The hook must skip admin-posted jobs (`Job.recruiterId === null`)
 *   cleanly, not warn on them.
 * - The helper must be fail-open: no `throw` in the body. The
 *   applicant's flow already succeeded upstream.
 * - The action must call the helper inside try/catch so an unexpected
 *   crash in the helper still doesn't fail the applicant.
 * - No file outside `src/repositories/talent-pipeline.ts` writes
 *   `prisma.talentListItem.*` — the T-240 "sole reader/writer" rule
 *   stays intact.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

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

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function readOr(path: string): string | null {
  try {
    return readFileSync(join(process.cwd(), path), "utf8");
  } catch {
    return null;
  }
}

function walk(dir: string, out: string[]): void {
  const abs = join(process.cwd(), dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(abs, name);
    const rel = join(dir, name).replace(/\\/g, "/");
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walk(rel, out);
    } else if (extname(name) === ".ts" || extname(name) === ".tsx") {
      out.push(rel);
    }
  }
}

const helper = readOr(
  "src/features/pipeline-convergence/converge-applicant.ts",
);
const action = readOr("src/app/actions/job-actions.ts");

console.log("\nT-247 applicant → pipeline convergence shape");

suite("helper file exists and exports convergeApplicantToPipeline", () => {
  assert(helper !== null, "helper file must exist");
  const code = stripComments(helper ?? "");
  assert(
    /export async function convergeApplicantToPipeline/.test(code),
    "convergeApplicantToPipeline must be an exported async function",
  );
});

suite("helper is server-only", () => {
  const code = stripComments(helper ?? "");
  assert(
    /import\s+"server-only"/.test(code),
    "helper must import \"server-only\" — it reads the DB and resolves recruiter workspaces",
  );
});

suite("helper calls addToPipeline at PipelineStage.SOURCED (enum, not a string)", () => {
  const code = stripComments(helper ?? "");
  assert(
    /addToPipeline\(/.test(code),
    "helper must call the T-240 addToPipeline repository function",
  );
  assert(
    /stage:\s*PipelineStage\.SOURCED/.test(code),
    "helper must pass stage: PipelineStage.SOURCED — the enum, not a plain string",
  );
});

suite("helper skips admin-posted jobs (Job.recruiterId === null) cleanly", () => {
  const code = stripComments(helper ?? "");
  assert(
    /recruiterUserId\s*=\s*application\.job\.recruiterId/.test(code),
    "helper must read job.recruiterId",
  );
  // The guard MUST be present. `logger.info` for the skip, not warn.
  assert(
    /if\s*\(\s*!recruiterUserId\s*\)/.test(code),
    "helper must short-circuit when recruiterId is null",
  );
  assert(
    /admin_job_skipped/.test(code),
    "the admin-skip must go through the expected log key so ops can filter it out",
  );
});

suite("helper is fail-open (no throw)", () => {
  const code = stripComments(helper ?? "");
  assert(
    !/\bthrow\b/.test(code),
    "helper must not throw — the applicant's flow already succeeded upstream",
  );
});

suite("action wires the helper after res.ok inside try/catch", () => {
  assert(action !== null, "job-actions.ts must exist");
  const code = stripComments(action ?? "");
  assert(
    /import\s*\{\s*convergeApplicantToPipeline\s*\}\s*from\s*"@\/features\/pipeline-convergence\/converge-applicant"/.test(
      code,
    ),
    "job-actions must import the converge helper",
  );
  assert(
    /try\s*\{[\s\S]{0,400}convergeApplicantToPipeline\(\s*\{\s*applicationId:\s*res\.data\.id/.test(
      code,
    ),
    "the converge call must be wrapped in try/catch and passed res.data.id",
  );
});

suite("no code outside the T-240 repo writes TalentListItem", () => {
  const files: string[] = [];
  walk("src", files);
  const allowed = new Set([
    "src/repositories/talent-pipeline.ts",
    "src/repositories/talent-pipeline.test.ts",
  ]);
  const violations: string[] = [];
  for (const file of files) {
    if (allowed.has(file)) continue;
    const body = stripComments(readOr(file) ?? "");
    if (/prisma\.talentListItem\./.test(body)) {
      violations.push(file);
    }
  }
  assert(
    violations.length === 0,
    `TalentListItem must only be touched inside the T-240 repository. Found in: ${violations.join(", ")}`,
  );
});

suite("no notification dispatch from this ticket (T-249 boundary)", () => {
  const code = stripComments(helper ?? "");
  assert(
    !/notification-service|dispatch\s*\(/.test(code),
    "T-247 must not fire notifications — that's T-249's ticket, separate branch",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
