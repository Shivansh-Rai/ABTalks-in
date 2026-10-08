/**
 * Code runner: Judge0 result mapping and the in-memory cooldown. No network.
 *   npm run test:code-runner
 */
import { toTestRunResult, type Judge0Row } from "@/features/code-runner/judge0";
import type { RunTestCase } from "@/features/code-runner/languages";
import { allowHit } from "@/features/code-runner/throttle";

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

const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

const TESTS: RunTestCase[] = [
  {
    input: "[1,2,3]\n",
    expectedOutput: "6\n",
    hidden: false,
    displayInput: "arr = [1,2,3]",
    displayOutput: "6",
  },
  { input: "[-5]\n", expectedOutput: "-5\n", hidden: false },
  { input: "[9,9]\n", expectedOutput: "18\n", hidden: true },
  { input: "[0]\n", expectedOutput: "0\n", hidden: true },
];

function row(statusId: number, extra: Partial<Judge0Row> = {}): Judge0Row {
  return { status_id: statusId, stdout: b64("6\n"), ...extra };
}

suite("all accepted", () => {
  const result = toTestRunResult(TESTS, [row(3), row(3), row(3), row(3)]);
  assert(result.verdict === "accepted", `verdict ${result.verdict}`);
  assert(result.passedCount === 4 && result.total === 4, "counts");
  assert(result.compileOutput === null, "no compile output");
});

suite("one wrong answer sets the verdict and the count", () => {
  const result = toTestRunResult(TESTS, [
    row(3),
    row(4, { stdout: b64("7\n") }),
    row(3),
    row(3),
  ]);
  assert(result.verdict === "wrong_answer", `verdict ${result.verdict}`);
  assert(result.passedCount === 3, `passed ${result.passedCount}`);
  assert(result.cases[1]?.actualOutput === "7\n", "actual output decoded");
});

suite("the verdict is the lowest-index failure", () => {
  const result = toTestRunResult(TESTS, [row(3), row(5), row(11), row(4)]);
  assert(result.verdict === "timeout", `verdict ${result.verdict}`);
  assert(result.cases[2]?.status === "runtime_error", "NZEC is runtime_error");
});

suite("runtime error statuses 7 to 12", () => {
  for (const id of [7, 8, 9, 10, 11, 12]) {
    const result = toTestRunResult(TESTS, [row(id), row(3), row(3), row(3)]);
    assert(result.verdict === "runtime_error", `status ${id}`);
  }
});

suite("compile error reports compiler output and runs nothing", () => {
  const rows = TESTS.map(() =>
    row(6, { stdout: null, compile_output: b64("main.cpp:3: error") }),
  );
  const result = toTestRunResult(TESTS, rows);
  assert(result.verdict === "compile_error", `verdict ${result.verdict}`);
  assert(result.compileOutput === "main.cpp:3: error", "compile output");
  assert(
    result.cases.every((c) => c.status === "not_run"),
    "every case not_run",
  );
});

suite("internal error, pending or missing rows are unavailable", () => {
  for (const rows of [
    [row(13), row(3), row(3), row(3)],
    [row(14), row(3), row(3), row(3)],
    [row(2), row(3), row(3), row(3)],
    [row(3), null, row(3), row(3)],
    [row(3), row(3), row(3)],
  ]) {
    const result = toTestRunResult(TESTS, rows);
    assert(result.verdict === "unavailable", `verdict ${result.verdict}`);
    assert(result.passedCount === 0, "nothing counted as passed");
  }
});

suite("hidden cases carry no test data", () => {
  const result = toTestRunResult(TESTS, [
    row(3),
    row(3),
    row(4, { stdout: b64("secret"), stderr: b64("trace") }),
    row(7, { stderr: b64("trace") }),
  ]);
  for (const c of result.cases.filter((x) => x.hidden)) {
    assert(
      Object.keys(c).sort().join(",") === "hidden,index,status",
      `hidden case leaked keys: ${Object.keys(c).join(",")}`,
    );
  }
  assert(
    !JSON.stringify(result).includes("secret") &&
      !JSON.stringify(result).includes("[9,9]"),
    "hidden input or output appeared in the result",
  );
});

suite("visible cases show the display text when present", () => {
  const result = toTestRunResult(TESTS, [row(3), row(3), row(3), row(3)]);
  assert(result.cases[0]?.input === "arr = [1,2,3]", "display input");
  assert(result.cases[0]?.expectedOutput === "6", "display output");
  assert(result.cases[1]?.input === "[-5]\n", "falls back to raw stdin");
});

suite("long output is truncated", () => {
  const result = toTestRunResult(TESTS, [
    row(4, { stdout: b64("x".repeat(20_000)) }),
    row(3),
    row(3),
    row(3),
  ]);
  assert(result.cases[0]?.actualOutput?.length === 8_000, "8000 char cap");
});

suite("cooldown refuses inside the window and allows after it", () => {
  const key = `test:${Math.random()}`;
  assert(allowHit(key, 3_000, 1_000) === true, "first hit allowed");
  assert(allowHit(key, 3_000, 2_000) === false, "second hit refused");
  assert(allowHit(key, 3_000, 3_999) === false, "still inside the window");
  assert(allowHit(key, 3_000, 4_000) === true, "allowed after the window");
});

suite("cooldown is per key", () => {
  const a = `test:${Math.random()}`;
  const b = `test:${Math.random()}`;
  assert(allowHit(a, 3_000, 1_000) === true, "a allowed");
  assert(allowHit(b, 3_000, 1_000) === true, "b is independent of a");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
