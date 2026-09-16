/**
 * T-265 admin assessment attempt detail. Run with:
 *   npm run test:admin-attempt-detail
 *
 * No network, no database. What is pinned:
 *
 *  1. The attempt, its answers state, the result, the recorded activity and any
 *     failure all reach the admin, and the explanation on top accounts for the
 *     outcome — including the cases where the stored result cannot be taken at
 *     face value (no score written, a score that no longer matches the answers,
 *     an unanswerable question, an attempt the server closed).
 *  2. Per-question grading is the platform's own `gradeQuestion`, so the
 *     breakdown can never disagree with the score the candidate was given.
 *  3. The page is admin-gated and scoped to the candidate in the URL, and no
 *     copy on it claims anything about the person (`BANNED_CLAIM_PATTERN`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  explainAttemptOutcome,
  endReasonLine,
  isPenaltyReason,
  type AdminAttemptDetail,
  type AttemptGrading,
  type AttemptQuestionDetail,
} from "@/features/admin/attempt-outcome";
import { BANNED_CLAIM_PATTERN } from "@/features/assessment-attempts/activity";

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
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

const OUTCOME = "src/features/admin/attempt-outcome.ts";
const LOADER = "src/features/admin/get-admin-attempt-detail.ts";
const VIEW = "src/components/admin/candidate-attempt-detail.tsx";
const PAGE = "src/app/admin/students/[id]/assessments/[assignmentId]/page.tsx";
const CARD = "src/components/admin/candidate-career-sections.tsx";
const SERVICE = "src/features/assessment-attempts/service.ts";

const T0 = new Date("2026-09-16T04:00:00Z");
const T1 = new Date("2026-09-16T04:20:00Z");

function question(over: Partial<AttemptQuestionDetail> = {}): AttemptQuestionDetail {
  return {
    questionId: "q1",
    number: 1,
    type: "MULTIPLE_CHOICE",
    title: "Which runs in linear time?",
    helpText: null,
    isRequired: true,
    points: 2,
    earnedPoints: 2,
    outcome: "CORRECT",
    answered: true,
    savedAt: T0,
    options: [
      { id: "o1", body: "O(n)", isCorrect: true, selected: true },
      { id: "o2", body: "O(n log n)", isCorrect: false, selected: false },
    ],
    text: null,
    wordCount: null,
    maxWords: null,
    overWordLimit: false,
    fileUrl: null,
    uploadDestinationUrl: null,
    ...over,
  };
}

function grading(over: Partial<AttemptGrading> = {}): AttemptGrading {
  return {
    earnedPoints: 4,
    totalPoints: 6,
    recountedPercent: 67,
    autoGradedCount: 3,
    notAutoGradedCount: 1,
    noKeyCount: 0,
    correctCount: 2,
    incorrectCount: 1,
    unansweredCount: 0,
    unansweredRequiredCount: 0,
    overWordLimitCount: 0,
    matchesStoredScore: true,
    ...over,
  };
}

function attempt(over: Partial<AdminAttemptDetail> = {}): AdminAttemptDetail {
  return {
    assignmentId: "as1",
    candidate: { userId: "u1", name: "Asha Verma", email: "asha@example.com" },
    candidateRef: "CLAUDE:u1",
    assessment: {
      id: "a1",
      title: "General aptitude",
      subheading: null,
      instructions: null,
      status: "PUBLISHED",
      durationMinutes: 20,
      passMarkPercent: 60,
      strictMode: true,
      cameraRequired: false,
      organizationName: "Acme",
      createdByName: "Rita",
    },
    status: "SUBMITTED",
    assignedAt: T0,
    startedAt: T0,
    submittedAt: T1,
    endReason: "SUBMITTED",
    scorePercent: 67,
    passed: true,
    questions: [question()],
    grading: grading(),
    ...over,
  };
}

const all = (e: ReturnType<typeof explainAttemptOutcome>) =>
  [e.headline, ...e.lines, ...e.warnings].join("\n");

console.log("\nT-265 admin assessment attempt detail\n");

/* ── the outcome is explained ────────────────────────────────────────────── */

suite("a passed attempt states the score, the bar and the verdict", () => {
  const e = explainAttemptOutcome(attempt());
  assert(e.headline.includes("67%"), `no score in: ${e.headline}`);
  assert(e.headline.includes("60%"), `no pass mark in: ${e.headline}`);
  assert(e.headline.includes("passed"), `no verdict in: ${e.headline}`);
  assert(e.warnings.length === 0, "a clean attempt raises nothing");
  assert(
    all(e).includes("2 correct, 1 incorrect, 4 of 6 points"),
    `score is not accounted for: ${all(e)}`,
  );
  assert(all(e).includes("Took 20m 0s"), `duration missing: ${all(e)}`);
});

suite("a failed attempt says failed", () => {
  const e = explainAttemptOutcome(
    attempt({ scorePercent: 33, passed: false, grading: grading({ recountedPercent: 33 }) }),
  );
  assert(e.headline.includes("failed"), `no verdict in: ${e.headline}`);
});

suite("never started", () => {
  const e = explainAttemptOutcome(
    attempt({
      status: "ASSIGNED",
      startedAt: null,
      submittedAt: null,
      endReason: null,
      scorePercent: null,
      passed: null,
    }),
  );
  assert(e.headline.includes("never started"), e.headline);
  assert(all(e).includes("no answers"), `must say there is nothing to read: ${all(e)}`);
});

suite("started and still open", () => {
  const e = explainAttemptOutcome(
    attempt({ status: "STARTED", submittedAt: null, endReason: null, scorePercent: null, passed: null }),
  );
  assert(e.headline.includes("still open"), e.headline);
  assert(all(e).includes("never submitted"), all(e));
});

/* ── the failures are named ──────────────────────────────────────────────── */

suite("every end reason has a line, and the penalties are marked", () => {
  for (const reason of [
    "SUBMITTED",
    "ENDED_EARLY",
    "TIME_UP",
    "TAB_SWITCH_LIMIT",
    "FULLSCREEN_LIMIT",
    "LEFT_PAGE",
  ] as const) {
    const line = endReasonLine(reason);
    assert(line.length > 10, `no line for ${reason}`);
    assert(!BANNED_CLAIM_PATTERN.test(line), `${reason} claims something: ${line}`);
  }
  assert(endReasonLine(null).includes("not recorded"), "null is honest about itself");
  assert(isPenaltyReason("TAB_SWITCH_LIMIT"), "tab-switch limit is a penalty");
  assert(isPenaltyReason("FULLSCREEN_LIMIT"), "fullscreen limit is a penalty");
  assert(!isPenaltyReason("TIME_UP"), "running out of time is not a penalty");
  assert(!isPenaltyReason("SUBMITTED"), "a normal submit is not a penalty");
});

suite("an attempt cut short by a strict-mode limit says the score is partial", () => {
  const e = explainAttemptOutcome(
    attempt({ endReason: "TAB_SWITCH_LIMIT", scorePercent: 20, passed: false }),
  );
  assert(all(e).includes("Auto-ended"), `end reason missing: ${all(e)}`);
  assert(
    e.warnings.some((w) => w.includes("cut short")),
    "a partial score must not read as a finished attempt",
  );
});

suite("time running out is reported as what it is", () => {
  const e = explainAttemptOutcome(attempt({ endReason: "TIME_UP" }));
  assert(all(e).includes("Time ran out"), all(e));
});

/* ── the result cannot be taken at face value ────────────────────────────── */

suite("a missing score is a warning, not a silent zero", () => {
  const e = explainAttemptOutcome(attempt({ scorePercent: null, passed: null }));
  assert(e.headline.includes("no score was recorded"), e.headline);
  assert(
    e.warnings.some((w) => w.includes("carries no score")),
    "the missing result must be called out",
  );
});

suite("a stored score that no longer matches the answers is flagged as a mismatch", () => {
  const e = explainAttemptOutcome(
    attempt({ scorePercent: 40, grading: grading({ matchesStoredScore: false, recountedPercent: 67 }) }),
  );
  assert(
    e.warnings.some((w) => w.includes("40%") && w.includes("67%")),
    `both numbers must be shown: ${e.warnings.join(" | ")}`,
  );
});

suite("a question with no correct option marked is named as the cap it is", () => {
  const e = explainAttemptOutcome(attempt({ grading: grading({ noKeyCount: 1 }) }));
  assert(
    e.warnings.some((w) => w.includes("no correct option marked")),
    "an unanswerable question must be surfaced",
  );
});

suite("unanswered required questions point at a server-closed attempt", () => {
  const e = explainAttemptOutcome(
    attempt({
      endReason: "TIME_UP",
      grading: grading({ unansweredCount: 2, unansweredRequiredCount: 1 }),
    }),
  );
  assert(all(e).includes("2 questions were left with no answer"), all(e));
  assert(
    e.warnings.some((w) => w.includes("not finished by the candidate")),
    "an intentional Submit refuses this, which is the point",
  );
});

suite("over-limit paragraphs point the same way", () => {
  const e = explainAttemptOutcome(
    attempt({ endReason: "LEFT_PAGE", grading: grading({ overWordLimitCount: 1 }) }),
  );
  assert(
    e.warnings.some((w) => w.includes("over the word limit")),
    e.warnings.join(" | "),
  );
});

suite("an assessment with nothing auto-gradeable says the 0% means nothing", () => {
  const e = explainAttemptOutcome(
    attempt({
      scorePercent: 0,
      passed: false,
      grading: grading({
        earnedPoints: 0,
        totalPoints: 0,
        recountedPercent: 0,
        autoGradedCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        notAutoGradedCount: 3,
      }),
    }),
  );
  assert(
    all(e).includes("Nothing on this assessment is auto-gradeable"),
    `a 0% must not read as a wrong answer: ${all(e)}`,
  );
});

suite("paragraph and file answers are sent to the reader, not scored away", () => {
  const e = explainAttemptOutcome(attempt());
  assert(
    all(e).includes("not auto-graded"),
    `the ungraded half must be called out: ${all(e)}`,
  );
});

/* ── no claim about the person, anywhere ─────────────────────────────────── */

suite("no explanation string claims anything about the candidate", () => {
  const cases: AdminAttemptDetail[] = [
    attempt(),
    attempt({ status: "ASSIGNED", startedAt: null, submittedAt: null, endReason: null, scorePercent: null, passed: null }),
    attempt({ status: "STARTED", submittedAt: null, endReason: null, scorePercent: null, passed: null }),
    attempt({ endReason: "TAB_SWITCH_LIMIT", scorePercent: 20, passed: false }),
    attempt({ endReason: "FULLSCREEN_LIMIT", scorePercent: 0, passed: false }),
    attempt({ scorePercent: null, passed: null }),
    attempt({ grading: grading({ matchesStoredScore: false, noKeyCount: 2, overWordLimitCount: 1, unansweredRequiredCount: 1, unansweredCount: 3 }) }),
    attempt({ assessment: { ...attempt().assessment, durationMinutes: null } }),
  ];
  for (const c of cases) {
    const e = explainAttemptOutcome(c);
    for (const s of [e.headline, ...e.lines, ...e.warnings]) {
      assert(!BANNED_CLAIM_PATTERN.test(s), `claim in: ${s}`);
    }
  }
});

suite("the view, the page and the outcome module make no claims either", () => {
  for (const rel of [OUTCOME, VIEW, PAGE]) {
    const src = read(rel);
    const hit = src.match(BANNED_CLAIM_PATTERN);
    assert(hit === null, `${rel} says "${hit?.[0]}"`);
  }
});

suite("the recruiter's own activity copy is reused, not rewritten", () => {
  const src = code(VIEW);
  for (const token of ["ACTIVITY_DISCLAIMER", "SUMMARY_COPY", "formatDuration"]) {
    assert(src.includes(token), `the view must reuse ${token}`);
  }
  assert(
    src.includes("CAMERA_DISCLAIMER"),
    "a camera-required attempt must carry the camera disclaimer",
  );
});

/* ── grading is the platform's own, and the page is gated ────────────────── */

suite("the breakdown grades with gradeQuestion, and scoring has one home", () => {
  const loader = code(LOADER);
  assert(loader.includes("gradeQuestion"), "per-question outcome must come from the service");
  assert(loader.includes("scoreAnswers"), "the recount must come from the service");
  const service = code(SERVICE);
  assert(
    service.includes("export function gradeQuestion"),
    "gradeQuestion must live with the scoring rule",
  );
  // Both finish paths must go through the shared counter, or the admin recount
  // and the candidate's stored score can drift apart.
  const finishes = service.split("export function finishAttempt");
  assert(finishes.length === 3, "both finishAttempt and finishAttemptForced exist");
  for (const body of finishes.slice(1)) {
    assert(
      body.slice(0, body.indexOf("\n}")).includes("scoreAnswers("),
      "a finish path scores without the shared counter",
    );
  }
});

suite("the attempt read is scoped to the candidate in the URL", () => {
  const loader = code(LOADER);
  assert(
    /where:\s*\{\s*id:\s*assignmentId,\s*candidateUserId\s*\}/.test(loader),
    "the candidate id must be in the WHERE, not checked afterwards",
  );
  const page = code(PAGE);
  assert(page.includes("requireAdmin"), "the page must call requireAdmin");
  assert(page.includes("notFound()"), "an attempt that is not this candidate's must 404");
  assert(
    page.includes("getAdminAttemptDetail(id, assignmentId)"),
    "the page must pass the URL candidate id into the read",
  );
});

suite("the attempt view is a read-only Server Component", () => {
  const src = code(VIEW);
  assert(!src.includes('"use client"'), "the view must stay a Server Component");
  assert(!src.includes("@/app/actions"), "no Server Actions on a read-only surface");
  assert(!/<(button|form)\b/.test(src), "no control that could change a result");
});

suite("the assessments card links every row to its attempt", () => {
  const card = code(CARD);
  assert(card.includes("View details"), "the card must offer the drill-down");
  assert(
    card.includes("/assessments/${row.assignmentId}"),
    "the link must carry the assignment id",
  );
  assert(
    card.includes("buttonVariants({ variant: \"outline\", size: \"sm\" })"),
    "buttons are buttonVariants on a Link (CLAUDE.md)",
  );
  assert(!card.includes("scorePercent"), "the card itself still shows no score (T-264)");
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
