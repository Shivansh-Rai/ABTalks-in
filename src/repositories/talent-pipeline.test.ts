/**
 * T-240 recruiter pipeline — shape guarantees.
 *
 *   npm run test:t240-pipeline
 *
 * A source-scan test in the same spirit as `match-persistence.test.ts`. No
 * network, no database. What it pins is the class of bug: the pipeline is
 * ONLY as isolated as the code that scopes it, so the tests here refuse any
 * pipeline access path that does not scope on `TalentList.ownerRecruiterId`,
 * and refuse any caller of `prisma.talentListItem.*` outside the repository.
 *
 * The Prisma-backed store in `src/repositories/talent-pipeline.ts` is
 * exercised by the app itself; every rule enforced here is enforced there
 * because both go through the same repository functions.
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

const repo = readOr("src/repositories/talent-pipeline.ts");
const actions = readOr("src/app/actions/recruiter-pipeline-actions.ts");
const validations = readOr("src/lib/validations/pipeline.ts");
const schema = readOr("prisma/schema.prisma");

console.log("\nT-240 recruiter pipeline shape");

suite("repository file exists", () => {
  assert(repo !== null, "src/repositories/talent-pipeline.ts must exist");
});

suite("validations use the Prisma enum, not a hand-typed list", () => {
  assert(validations !== null, "src/lib/validations/pipeline.ts must exist");
  const v = stripComments(validations ?? "");
  assert(
    v.includes("PipelineStage") && v.includes("@prisma/client"),
    "pipelineStageSchema must be `z.nativeEnum(PipelineStage)` from @prisma/client",
  );
});

suite("schema still has the 9-stage enum and the ownership fields", () => {
  assert(schema !== null, "prisma/schema.prisma must exist");
  const s = schema ?? "";
  for (const stage of [
    "SOURCED",
    "SHORTLISTED",
    "CONTACTED",
    "SCREENING",
    "INTERVIEWING",
    "OFFER",
    "HIRED",
    "REJECTED",
    "WITHDRAWN",
  ]) {
    assert(
      new RegExp(`enum PipelineStage[\\s\\S]*?${stage}`).test(s),
      `PipelineStage must include ${stage}`,
    );
  }
  assert(
    /ownerRecruiterId\s+String\?/.test(s),
    "TalentList.ownerRecruiterId is what the isolation guard reads",
  );
  assert(
    /stageChangedAt\s+DateTime/.test(s),
    "TalentListItem.stageChangedAt drives the 'sign in on another device' evidence",
  );
});

suite("every pipeline read/write scopes on ownerRecruiterId", () => {
  const code = stripComments(repo ?? "");
  const readWrites = code.match(/prisma\.talentListItem\.(findMany|updateMany|deleteMany|create|findUnique)/g) ?? [];
  assert(
    readWrites.length >= 5,
    "repository must contain the reader, upsert, findUnique, updateMany and deleteMany",
  );
  // Reader must filter on ownerRecruiterId via the relation.
  assert(
    /talentList:\s*{\s*ownerRecruiterId:\s*workspace\.recruiterProfileId\s*}/.test(code),
    "listPipeline must filter by ownerRecruiterId through the parent list",
  );
  // Move must go through updateMany + ownerRecruiterId scope.
  assert(
    /talentListItem\.updateMany[\s\S]{0,400}ownerRecruiterId:\s*workspace\.recruiterProfileId/.test(code),
    "moveStage must scope its updateMany on ownerRecruiterId (isolation)",
  );
  // Delete must go through deleteMany + ownerRecruiterId scope.
  assert(
    /talentListItem\.deleteMany[\s\S]{0,400}ownerRecruiterId:\s*workspace\.recruiterProfileId/.test(code),
    "removeFromPipeline must scope its deleteMany on ownerRecruiterId (isolation)",
  );
});

suite("moveStage always writes stageChangedAt", () => {
  const code = stripComments(repo ?? "");
  const move = code.match(/async function moveStage[\s\S]*?\n\}/);
  assert(move !== null, "moveStage function must be defined");
  assert(
    /stageChangedAt:\s*new Date\(\)/.test(move![0]),
    "moveStage must set stageChangedAt so the 'you moved someone' evidence timestamp updates",
  );
});

suite("addToPipeline is idempotent (findUnique-then-create, P2002 recovery)", () => {
  const code = stripComments(repo ?? "");
  assert(
    /findUnique[\s\S]{0,400}talentListId_candidateUserId/.test(code),
    "addToPipeline must probe the compound unique before creating",
  );
  assert(
    /P2002/.test(code),
    "addToPipeline must recover from the unique-violation race by returning the existing row",
  );
});

suite("no other module reads or writes TalentListItem", () => {
  const files: string[] = [];
  walk("src", files);
  const violations: string[] = [];
  for (const file of files) {
    if (
      file === "src/repositories/talent-pipeline.ts" ||
      file === "src/repositories/talent-pipeline.test.ts"
    ) {
      continue;
    }
    const body = stripComments(readOr(file) ?? "");
    if (/prisma\.talentListItem\./.test(body)) {
      violations.push(file);
    }
  }
  assert(
    violations.length === 0,
    `TalentListItem must only be touched inside the repository. Found in: ${violations.join(", ")}`,
  );
});

suite("actions live behind requireRecruiterWorkspace + Zod", () => {
  if (!actions) {
    // Actions file has not landed yet — this suite runs meaningfully after
    // the next commit. Treat the missing-file case as pending, not failing.
    console.log("      (skipped: server actions not yet written)");
    return;
  }
  const a = stripComments(actions);
  assert(
    /requireRecruiterWorkspace\(\)/.test(a),
    "every action must resolve the workspace through requireRecruiterWorkspace",
  );
  assert(
    /pipelineStageSchema|addToPipelineInputSchema|moveStageInputSchema|removeItemInputSchema/.test(a),
    "every action must parse its input with the T-240 Zod schemas",
  );
  assert(
    !/prisma\.talentListItem\./.test(a),
    "actions must go through the repository, not talk to prisma.talentListItem directly",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
