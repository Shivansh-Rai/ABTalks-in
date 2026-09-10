/**
 * Talent project persistence — run with:
 *   npm run test:project-state
 *
 * No network, no database. Guards the shape of the writers: updateMany scoped
 * by recruiterUserId, viewed write-once, decision not in hire-actions.ts.
 */
import { readFileSync } from "node:fs";
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

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const root = process.cwd();
const writers = readFileSync(
  join(root, "src/app/actions/talent-project-actions.ts"),
  "utf8",
);
const writersCode = stripComments(writers);
const hireActions = stripComments(
  readFileSync(join(root, "src/app/actions/hire-actions.ts"), "utf8"),
);
const deskCard = readFileSync(
  join(root, "src/components/hire/desk-match-card.tsx"),
  "utf8",
);
const matchResults = readFileSync(
  join(root, "src/components/hire/match-results.tsx"),
  "utf8",
);

console.log("\nproject state");

suite("a writer exists for name", () => {
  assert(
    writersCode.includes("renameTalentProjectAction") &&
      writersCode.includes("name: parsed.data.name"),
    "renameTalentProjectAction must write name",
  );
});

suite("a writer exists for lastViewedAt", () => {
  assert(
    writersCode.includes("markProjectOpenedAction") &&
      writersCode.includes("lastViewedAt"),
    "markProjectOpenedAction must write lastViewedAt",
  );
});

suite("a writer exists for viewedAt", () => {
  assert(
    writersCode.includes("markMatchViewedAction") &&
      writersCode.includes("viewedAt"),
    "markMatchViewedAction must write viewedAt",
  );
});

suite("a writer exists for decision", () => {
  assert(
    writersCode.includes("setMatchDecisionAction") &&
      writersCode.includes("decision"),
    "setMatchDecisionAction must write decision",
  );
});

suite("every write is updateMany with a recruiterUserId predicate", () => {
  assert(
    !writersCode.includes("talentRequest.update({") &&
      !writersCode.includes("talentRequestMatch.update({"),
    "bare prisma.update({ where: { id } }) is not allowed",
  );
  const count = (writersCode.match(/\.updateMany\(/g) ?? []).length;
  assert(count >= 4, `expected at least 4 updateMany, got ${count}`);
  const recruiter = (writersCode.match(/recruiterUserId/g) ?? []).length;
  assert(
    recruiter >= 4,
    "each writer must scope by recruiterUserId",
  );
});

suite("the viewed write is guarded by viewedAt: null", () => {
  assert(
    writersCode.includes("viewedAt: null"),
    "markMatchViewedAction must be write-once",
  );
});

suite("decision is persisted in talent-project-actions, not hire-actions", () => {
  assert(
    writersCode.includes("setMatchDecisionAction"),
    "decision writer belongs in talent-project-actions.ts",
  );
  assert(
    !hireActions.includes("viewedAt:") &&
      !hireActions.includes("decision:") &&
      !hireActions.includes("firstSeenAt:"),
    "runMatchAction must not assign state columns",
  );
});

suite("desk card reads decision/viewed from props", () => {
  assert(
    deskCard.includes("match.decision") && deskCard.includes("match.viewedAt"),
    "desk-match-card must read decision and viewedAt from props",
  );
});

suite("triage UI does not import desk-shortlist / guest-cart / guest-matches-store", () => {
  assert(
    !matchResults.includes("desk-shortlist") &&
      !matchResults.includes("guest-cart") &&
      !matchResults.includes("guest-matches-store"),
    "match-results must not import localStorage stores",
  );
  const deskCode = stripComments(deskCard);
  assert(
    !deskCode.includes("guest-cart") &&
      !deskCode.includes("guest-matches-store"),
    "desk-match-card triage must not import guest cart stores",
  );
  assert(
    !/decision\s*=\s*[^\n]*desk-shortlist/.test(deskCode) &&
      !deskCode.includes("toggleDeskShortlist") &&
      !deskCode.includes("readDeskShortlist"),
    "project decision/viewed must not be read from desk-shortlist",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
