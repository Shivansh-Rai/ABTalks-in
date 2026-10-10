// Generates src/features/coding-practice/content/arrays-strings/day-NN.json
// from arrays-strings.questions.mjs.
//
//   node scripts/coding-practice/generate-arrays-strings.mjs
//   node scripts/coding-practice/generate-arrays-strings.mjs --solutions <file.json>
//
// Every expected output is computed by the question's JavaScript reference
// solution. `--solutions` also writes every available solution (all four
// languages where present) to a file outside the repo, for checking the
// generated drivers against the real executor. The JSON files are the
// runtime source of truth; rerun this after editing a question.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DAYS } from "./arrays-strings.questions.mjs";
import { buildHarness, sortLists } from "./harness.mjs";

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/features/coding-practice/content/arrays-strings",
);
const MAX_IO_CHARS = 100_000;
const tooLarge = [];

function buildTest(q, args, sample) {
  // The reference must not see a caller's later mutations, and vice versa.
  const raw = q.ref(...structuredClone(args));
  const out = q.sortOutput ? sortLists(raw) : raw;
  const input = args.map((a) => JSON.stringify(a)).join("\n") + "\n";
  const expectedOutput = JSON.stringify(out) + "\n";
  if (input.length > MAX_IO_CHARS || expectedOutput.length > MAX_IO_CHARS) {
    tooLarge.push(
      `${q.title}: test is too large (input ${input.length}, output ${expectedOutput.length})`,
    );
  }
  if (/["\\]/.test(args.filter((a) => typeof a === "string").join(""))) {
    throw new Error(`${q.title}: a test string contains a quote or a backslash`);
  }
  if (!sample) return { input, expectedOutput, hidden: true };
  return {
    input,
    expectedOutput,
    hidden: false,
    display: {
      input: q.params.map((p, i) => `${p.name} = ${JSON.stringify(args[i])}`).join(", "),
      output: JSON.stringify(out),
    },
    explanation: sample.explanation,
  };
}

const solutionsPath = process.argv.includes("--solutions")
  ? process.argv[process.argv.indexOf("--solutions") + 1]
  : null;
const solutions = [];

mkdirSync(OUT_DIR, { recursive: true });
DAYS.forEach((pair, dayIndex) => {
  const day = dayIndex + 1;
  const questions = pair.map((q, slotIndex) => {
    if (q.ref.name !== q.fn) {
      throw new Error(`${q.title}: reference is ${q.ref.name}, expected ${q.fn}`);
    }
    if (q.samples.length !== 2 || q.hidden.length !== 2) {
      throw new Error(`${q.title}: needs exactly 2 sample and 2 hidden tests`);
    }
    const { starterCode, harness } = buildHarness(q);
    solutions.push({
      day,
      slot: slotIndex + 1,
      title: q.title,
      solutions: {
        python: q.py,
        javascript: q.ref.toString() + "\n",
        ...(q.java ? { java: q.java } : {}),
        ...(q.cpp ? { cpp: q.cpp } : {}),
      },
    });
    return {
      slot: slotIndex + 1,
      title: q.title,
      difficulty: q.difficulty,
      tags: q.tags,
      statementMd: q.statement,
      timeLimitSec: q.timeLimitSec ?? 2,
      starterCode,
      harness,
      tests: [
        ...q.samples.map((s) => buildTest(q, s.args, s)),
        ...q.hidden.map((args) => buildTest(q, args, null)),
      ],
      solution: { language: "python", code: q.py },
    };
  });
  const file = join(OUT_DIR, `day-${String(day).padStart(2, "0")}.json`);
  writeFileSync(file, JSON.stringify({ day, questions }, null, 2) + "\n");
  console.log(
    `day ${String(day).padStart(2, "0")}  ${questions.map((q) => q.title).join("  |  ")}`,
  );
});

if (tooLarge.length > 0) {
  console.error(tooLarge.join("\n"));
  process.exit(1);
}

if (solutionsPath) {
  writeFileSync(solutionsPath, JSON.stringify(solutions));
  console.log(`solutions -> ${solutionsPath}`);
}
