/**
 * T-249 recruiter notifications — shape guarantees.
 *
 *   npm run test:t249-recruiter-notifications
 *
 * Source-scan test in the same spirit as `talent-pipeline.test.ts` and
 * `converge-applicant.test.ts`. No network, no database. Pins:
 *
 * - The two new event types are registered in the T-248 event registry.
 * - The aggregator wraps `dispatch()` in try/catch and never throws.
 * - The T-247 hook fires `application.received` AFTER `addToPipeline`
 *   succeeds, so the notification href never points at an empty board.
 * - The assessment attempt action fires `assessment.completed` AFTER
 *   `submitAttempt` succeeds, inside a try/catch.
 * - The admin actions are guarded by `requireAdmin` and Zod.
 * - The four T-249 event types (`application.received`,
 *   `assessment.completed`, `application.status_changed`,
 *   `system.notice`) are only dispatched through the aggregator —
 *   any other file that dispatches one of them fails the isolation
 *   check.
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

const eventTypes = readOr("src/features/notification/event-types.ts");
const aggregator = readOr(
  "src/features/recruiter-notifications/notify-recruiter.ts",
);
const assessmentHook = readOr(
  "src/features/recruiter-notifications/hook-assessment-completed.ts",
);
const convergeHelper = readOr(
  "src/features/pipeline-convergence/converge-applicant.ts",
);
const attemptAction = readOr(
  "src/app/actions/assessment-attempt-actions.ts",
);
const adminAction = readOr("src/app/actions/admin-notify-actions.ts");

console.log("\nT-249 recruiter notifications shape");

suite("new event types are registered", () => {
  const src = stripComments(eventTypes ?? "");
  assert(
    /"assessment\.completed":\s*\{/.test(src),
    "assessment.completed must be registered in EVENT_TYPE_REGISTRY",
  );
  assert(
    /"system\.notice":\s*\{/.test(src),
    "system.notice must be registered in EVENT_TYPE_REGISTRY",
  );
  // Sanity: application.received and application.status_changed were
  // already there — a regression that dropped them would break events
  // #1 and #4.
  assert(
    /"application\.received":\s*\{/.test(src),
    "application.received must remain registered",
  );
  assert(
    /"application\.status_changed":\s*\{/.test(src),
    "application.status_changed must remain registered",
  );
});

suite("aggregator is server-only and exports all four wrappers", () => {
  assert(aggregator !== null, "aggregator file must exist");
  const code = stripComments(aggregator ?? "");
  assert(
    /import\s+"server-only"/.test(code),
    "aggregator must import \"server-only\"",
  );
  for (const fn of [
    "notifyApplicationReceived",
    "notifyAssessmentCompleted",
    "notifyApplicationStatusChanged",
    "notifySystemNotice",
  ]) {
    assert(
      new RegExp(`export async function ${fn}`).test(code),
      `aggregator must export ${fn}`,
    );
  }
});

suite("aggregator wraps dispatch in try/catch and never throws", () => {
  const code = stripComments(aggregator ?? "");
  assert(
    /try\s*\{[\s\S]{0,600}await\s+dispatch\(/.test(code),
    "the fire helper must wrap dispatch in try/catch",
  );
  assert(
    !/\bthrow\b/.test(code),
    "aggregator must not throw — the caller's action already succeeded upstream",
  );
});

suite("T-247 hook fires application.received AFTER pipeline write succeeds", () => {
  assert(convergeHelper !== null, "converge helper must exist");
  const code = stripComments(convergeHelper ?? "");
  assert(
    /notifyApplicationReceived\(/.test(code),
    "converge helper must call notifyApplicationReceived",
  );
  // The dispatch call must come AFTER the ok-check on addToPipeline, so
  // the href never points at a missing pipeline row.
  const addIndex = code.indexOf("addToPipeline(");
  const notifyIndex = code.indexOf("notifyApplicationReceived(");
  assert(
    addIndex > 0 && notifyIndex > addIndex,
    "notifyApplicationReceived must be called AFTER addToPipeline in the file",
  );
});

suite("assessment attempt action fires assessment.completed inside try/catch", () => {
  assert(attemptAction !== null, "attempt action must exist");
  const code = stripComments(attemptAction ?? "");
  assert(
    /fireAssessmentCompletedNotification\(/.test(code),
    "attempt action must call fireAssessmentCompletedNotification",
  );
  assert(
    /try\s*\{[\s\S]{0,400}fireAssessmentCompletedNotification\(/.test(code),
    "the notify call must be wrapped in try/catch",
  );
  // Must come AFTER submitAttempt's ok-check.
  const okIndex = code.indexOf("if (!result.ok)");
  const notifyIndex = code.indexOf("fireAssessmentCompletedNotification(");
  assert(
    okIndex > 0 && notifyIndex > okIndex,
    "notification must be fired after submitAttempt's failure guard",
  );
});

suite("admin actions are guarded by requireAdmin + Zod", () => {
  assert(adminAction !== null, "admin action file must exist");
  const code = stripComments(adminAction ?? "");
  assert(
    /import\s*\{\s*requireAdmin\s*\}\s*from\s*"@\/lib\/admin-auth"/.test(code),
    "admin action must import requireAdmin",
  );
  const requireAdminCalls = code.match(/await\s+requireAdmin\(\)/g) ?? [];
  assert(
    requireAdminCalls.length >= 2,
    "both broadcastRecruiterSystemNoticeAction and sendRecruiterPipelineNudgeAction must call requireAdmin",
  );
  assert(
    /safeParse\(/.test(code),
    "admin actions must parse input with Zod safeParse",
  );
});

suite("no other file dispatches the four T-249 event types directly", () => {
  const files: string[] = [];
  walk("src", files);
  const allowedAggregators = new Set([
    "src/features/recruiter-notifications/notify-recruiter.ts",
    "src/features/recruiter-notifications/notify-recruiter.test.ts",
    // The registry, the service, and the notification's own tests are
    // allowed to reference the strings — they define/register them.
    "src/features/notification/event-types.ts",
    "src/features/notification/notification-service.ts",
    "src/features/notification/notification-service.test.ts",
    "src/features/notification/notification-acceptance.test.ts",
    "src/features/notification/email-delivery.test.ts",
    "src/features/notification/email-delivery.ts",
    "src/features/notification/email-templates.ts",
    "src/features/notification/email-templates.test.ts",
    "src/features/notification/subscribe.ts",
  ]);
  const t249Events = [
    "application.received",
    "assessment.completed",
    "application.status_changed",
    "system.notice",
  ];
  const violations: string[] = [];
  for (const file of files) {
    if (allowedAggregators.has(file)) continue;
    const body = readOr(file) ?? "";
    // Only flag a DISPATCH call that names one of the four event types,
    // not a reference (imports, type predicates, comments already stripped
    // in the aggregator source but not here for maximal signal).
    const stripped = stripComments(body);
    for (const eventType of t249Events) {
      const pattern = new RegExp(
        `dispatch\\s*\\(\\s*\\{[\\s\\S]{0,600}eventType:\\s*["'\`]${eventType.replace(".", "\\.")}["'\`]`,
      );
      if (pattern.test(stripped)) {
        violations.push(`${file} → ${eventType}`);
      }
    }
  }
  assert(
    violations.length === 0,
    `T-249 event types must only be dispatched through the aggregator. Violations: ${violations.join(", ")}`,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
