/**
 * Coding practice: day unlock rules and content validation. No database, no network.
 *   npm run test:coding-practice
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CODE_LANGUAGE_IDS } from "@/features/code-runner/languages";
import { PRACTICE_PROGRAM_SLUGS } from "@/features/coding-practice/constants";
import {
  buildPracticeSource,
  getPracticeChallenge,
  getPracticeDayIndex,
  getPracticeQuestion,
  getPracticeTests,
} from "@/features/coding-practice/content";
import {
  isDayComplete,
  practiceDayState,
  unlockKeyForDay,
  type PracticeDayActivities,
} from "@/features/coding-practice/progression";

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

// ── Unlock rules ────────────────────────────────────────────────────────────

const DAYS: PracticeDayActivities[] = [
  { day: 1, activityIds: ["d1q1", "d1q2"] },
  { day: 2, activityIds: ["d2q1", "d2q2"] },
  { day: 3, activityIds: ["d3q1", "d3q2"] },
  { day: 4, activityIds: ["d4q1", "d4q2"] },
  { day: 5, activityIds: ["d5q1", "d5q2"] },
];

/** Enrolled 8 Oct 2026 at 14:00 IST. */
const STARTED = new Date("2026-10-08T14:00:00+05:30");

function state(day: number, solved: string[], now: string, bypassLocks = false) {
  return practiceDayState({
    day,
    startedAt: STARTED,
    solved: new Set(solved),
    days: DAYS,
    now: new Date(now),
    bypassLocks,
  });
}

suite("Day 1 is open the moment the learner enrols", () => {
  assert(state(1, [], "2026-10-08T14:00:00+05:30") === "OPEN", "Day 1 open");
});

suite("a day is complete only when both questions are solved", () => {
  assert(!isDayComplete(1, new Set(["d1q1"]), DAYS), "one of two is not complete");
  assert(isDayComplete(1, new Set(["d1q1", "d1q2"]), DAYS), "two of two is complete");
  assert(state(1, ["d1q1"], "2026-10-08T15:00:00+05:30") === "OPEN", "still open");
  assert(
    state(1, ["d1q1", "d1q2"], "2026-10-08T15:00:00+05:30") === "COMPLETE",
    "complete",
  );
});

suite("Day 2 waits for 00:00 UTC (05:30 IST) even when Day 1 is complete", () => {
  const solved = ["d1q1", "d1q2"];
  assert(unlockKeyForDay(STARTED, 2) === "2026-10-09", "Day 2 date");
  assert(
    state(2, solved, "2026-10-09T05:29:59+05:30") === "LOCKED_DATE",
    "locked one second before 05:30 IST",
  );
  assert(
    state(2, solved, "2026-10-08T23:59:59Z") === "LOCKED_DATE",
    "locked one second before 00:00 UTC",
  );
  assert(state(2, solved, "2026-10-09T05:30:00+05:30") === "OPEN", "opens at 05:30 IST");
  assert(state(2, solved, "2026-10-09T00:00:00Z") === "OPEN", "opens at 00:00 UTC");
});

suite("Day 2 stays shut after its date when Day 1 is not complete", () => {
  assert(
    state(2, ["d1q1"], "2026-10-09T10:00:00Z") === "LOCKED_PREVIOUS",
    "one question of Day 1 is not enough",
  );
  assert(state(2, [], "2026-10-12T10:00:00Z") === "LOCKED_PREVIOUS", "nor is none");
});

suite("a learner who falls behind can catch up, but not get ahead", () => {
  const now = "2026-10-11T10:00:00Z"; // Day 4's date
  const day1 = ["d1q1", "d1q2"];
  assert(state(2, day1, now) === "OPEN", "Day 2 opens at once, its date has passed");
  assert(state(3, day1, now) === "LOCKED_PREVIOUS", "Day 3 waits for Day 2");
  const day2 = [...day1, "d2q1", "d2q2"];
  assert(state(3, day2, now) === "OPEN", "Day 3 opens as soon as Day 2 is complete");
  const day4 = [...day2, "d3q1", "d3q2", "d4q1", "d4q2"];
  assert(state(4, day4, now) === "COMPLETE", "Day 4 done on its own date");
  assert(state(5, day4, now) === "LOCKED_DATE", "Day 5 cannot open before its date");
});

suite("enrolling at 23:50 UTC puts Day 2's date ten minutes later", () => {
  const startedAt = new Date("2026-10-08T23:50:00Z");
  const base = { startedAt, solved: new Set(["d1q1", "d1q2"]), days: DAYS, bypassLocks: false };
  assert(
    practiceDayState({ ...base, day: 2, now: new Date("2026-10-08T23:59:00Z") }) ===
      "LOCKED_DATE",
    "locked before midnight UTC",
  );
  assert(
    practiceDayState({ ...base, day: 2, now: new Date("2026-10-09T00:00:00Z") }) === "OPEN",
    "open at midnight UTC",
  );
});

suite("a day after one with no content never opens", () => {
  assert(state(7, [], "2026-12-01T00:00:00Z") === "LOCKED_PREVIOUS", "Day 6 has no content");
  assert(!isDayComplete(6, new Set(), DAYS), "a day with no content is never complete");
});

suite("the dev bypass opens every day and keeps completed days complete", () => {
  assert(state(5, [], "2026-10-08T10:00:00Z", true) === "OPEN", "Day 5 open");
  assert(
    state(1, ["d1q1", "d1q2"], "2026-10-08T10:00:00Z", true) === "COMPLETE",
    "Day 1 complete",
  );
});

// ── Content ─────────────────────────────────────────────────────────────────

suite("an unknown challenge is not found", () => {
  assert(getPracticeChallenge("nope") === null, "challenge");
  assert(getPracticeDayIndex("nope").length === 0, "day index");
  assert(getPracticeQuestion("nope", 1, 1) === null, "question");
  assert(getPracticeTests("nope", 1, 1) === null, "tests");
  assert(buildPracticeSource("nope", 1, 1, "python", "x") === null, "source");
});

for (const slug of PRACTICE_PROGRAM_SLUGS) {
  suite(`${slug}: every content file validates`, () => {
    const challenge = getPracticeChallenge(slug);
    assert(challenge !== null, "challenge loads");
    assert((challenge?.days.length ?? 0) > 0, "at least one day has content");
    assert(
      getPracticeDayIndex(slug).length === challenge?.days.length,
      "day index covers every day",
    );
  });

  suite(`${slug}: activity ids are unique and well formed`, () => {
    const ids = getPracticeDayIndex(slug).flatMap((d) =>
      d.questions.map((q) => q.activityId),
    );
    assert(new Set(ids).size === ids.length, "duplicate activity id");
    assert(
      ids.every((id) => /^act_dsa_[a-z0-9]+_d\d{2}_q[12]$/.test(id)),
      `unexpected id in ${ids.join(", ")}`,
    );
  });

  suite(`${slug}: questions are client-safe and tests stay on the server`, () => {
    for (const day of getPracticeDayIndex(slug)) {
      for (const { slot } of day.questions) {
        const where = `day ${day.day} question ${slot}`;
        const question = getPracticeQuestion(slug, day.day, slot);
        const run = getPracticeTests(slug, day.day, slot);
        assert(question !== null && run !== null, `${where}: loads`);
        if (!question || !run) continue;

        assert(question.examples.length === 2, `${where}: two examples`);
        assert(run.tests.length === 4, `${where}: four tests`);
        assert(
          run.tests.slice(0, 2).every((t) => !t.hidden) &&
            run.tests.slice(2).every((t) => t.hidden),
          `${where}: sample tests come first`,
        );

        const sent = JSON.stringify(question);
        for (const key of ["harness", "solution", "tests", "expectedOutput"]) {
          assert(!sent.includes(`"${key}"`), `${where}: "${key}" reached the client shape`);
        }
        for (const test of run.tests.filter((t) => t.hidden)) {
          assert(test.displayInput === undefined, `${where}: hidden test has display text`);
        }

        for (const language of question.languages) {
          assert(
            (question.starterCode[language] ?? "").length > 0,
            `${where}: starter code for ${language}`,
          );
          const marker = "LEARNER_CODE_MARKER";
          const source = buildPracticeSource(slug, day.day, slot, language, marker);
          assert(source !== null, `${where}: harness for ${language}`);
          assert(
            source !== null && source.includes(marker) && source.length > marker.length + 20,
            `${where}: ${language} source wraps the learner code in a driver`,
          );
        }
        for (const language of CODE_LANGUAGE_IDS) {
          if (question.languages.includes(language)) continue;
          assert(
            buildPracticeSource(slug, day.day, slot, language, "x") === null,
            `${where}: ${language} is not offered but has a harness`,
          );
        }
      }
    }
  });
}

// ── The Run path never touches the database ─────────────────────────────────

suite("the Run route and the code runner import no database code", () => {
  const files = [
    "src/app/api/practice/run/route.ts",
    ...readdirSync(join(process.cwd(), "src/features/code-runner"))
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => `src/features/code-runner/${f}`),
  ];
  for (const file of files) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    for (const banned of [
      "@/lib/db",
      "@/repositories",
      "@prisma/client",
      "prisma.",
      "writeClient",
      "assertRateLimit(",
    ]) {
      assert(!src.includes(banned), `${file} must not reference ${banned}`);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
