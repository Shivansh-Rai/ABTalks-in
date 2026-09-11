/**
 * Profile performance events (plan 120).
 *
 * Pure viewerKey checks plus source assertions: only profile-events.ts writes
 * CandidateProfileEvent, and no recruiter surface reads the counts.
 *
 * Run: npx tsx src/features/profile/profile-events.test.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { viewerKeyFor } from "@/features/profile/profile-events";

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

const root = process.cwd();
const source = (rel: string) => readFileSync(join(root, rel), "utf8");

function code(rel: string): string {
  const raw = source(rel);
  return rel.endsWith(".sql")
    ? raw.replace(/--.*$/gm, "")
    : raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

console.log("\nprofile-events");

suite("viewerKeyFor is stable for the same signed-in user", () => {
  const a = viewerKeyFor({ kind: "user", userId: "user_abc" });
  const b = viewerKeyFor({ kind: "user", userId: "user_abc" });
  assert(a === "u:user_abc", `got ${a}`);
  assert(a === b, "same user → same key");
});

suite("viewerKeyFor is stable for the same guest twice on one day", () => {
  const input = {
    kind: "guest" as const,
    ip: "203.0.113.10",
    userAgent: "Mozilla/5.0 test",
    dayKey: "2026-09-10",
    salt: "test-salt",
  };
  const a = viewerKeyFor(input);
  const b = viewerKeyFor(input);
  assert(a === b, "same guest inputs → same key");
  assert(a.startsWith("g:"), `guest prefix: ${a}`);
  assert(a.length === 2 + 32, `expected g: + 32 hex, got ${a.length}`);
});

suite("two guest keys differ once the day salt changes", () => {
  const base = {
    kind: "guest" as const,
    ip: "203.0.113.10",
    userAgent: "Mozilla/5.0 test",
    salt: "test-salt",
  };
  const day1 = viewerKeyFor({ ...base, dayKey: "2026-09-10" });
  const day2 = viewerKeyFor({ ...base, dayKey: "2026-09-11" });
  assert(day1 !== day2, "day rotation must change the key");
});

suite("neither key contains a raw IP or user agent", () => {
  const ip = "203.0.113.10";
  const ua = "Mozilla/5.0 UniqueAgentString";
  const key = viewerKeyFor({
    kind: "guest",
    ip,
    userAgent: ua,
    dayKey: "2026-09-10",
    salt: "test-salt",
  });
  assert(!key.includes(ip), "raw IP must not appear");
  assert(!key.includes("203.0.113"), "IP fragment must not appear");
  assert(!key.includes(ua), "raw UA must not appear");
  assert(!key.includes("UniqueAgent"), "UA fragment must not appear");
});

suite("the recorder never throws when the write fails", () => {
  // Source contract: recordEvent wraps upsert in try/catch and logs.
  const src = code("src/features/profile/profile-events.ts");
  assert(src.includes("try {"), "try/catch present");
  assert(src.includes("logger.error"), "failures are logged");
  assert(
    /catch\s*\([^)]*\)\s*\{[\s\S]*logger\.error/.test(src),
    "catch logs rather than rethrowing",
  );
  assert(
    !/catch\s*\([^)]*\)\s*\{[\s\S]*throw/.test(src),
    "catch must not rethrow",
  );
});

suite("profile-events.ts is the only file writing candidateProfileEvent", () => {
  const writers = [
    "src/features/profile/profile-events.ts",
    "src/app/actions/hire-view-actions.ts",
    "src/app/actions/hire-request-actions.ts",
    "src/features/profile/get-profile-performance.ts",
    "src/features/hire/entitlements.ts",
    "src/components/hire/scout-chat.tsx",
    "src/components/profile/profile-card.tsx",
    "src/app/profile/page.tsx",
  ];
  for (const rel of writers) {
    const src = code(rel);
    const writes =
      /\.candidateProfileEvent\.(create|upsert|createMany|update|delete)/.test(
        src,
      );
    if (rel === "src/features/profile/profile-events.ts") {
      assert(writes, "profile-events.ts must write");
    } else {
      assert(!writes, `${rel} must not write candidateProfileEvent`);
    }
  }
});

suite("no recruiter surface reads CandidateProfileEvent counts", () => {
  const recruiterSurfaces = [
    "src/components/hire/scout-chat.tsx",
    "src/components/hire/match-card.tsx",
    "src/components/hire/candidate-inspector.tsx",
    "src/features/hire/to-public-match.ts",
    "src/app/hire/page.tsx",
  ];
  for (const rel of recruiterSurfaces) {
    const src = code(rel);
    assert(
      !src.includes("getProfilePerformance") &&
        !src.includes("candidateProfileEvent"),
      `${rel} must not read profile performance`,
    );
  }
  // The candidate profile page is allowed to read it.
  assert(
    code("src/app/profile/page.tsx").includes("getProfilePerformance"),
    "candidate /profile reads the counts",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
