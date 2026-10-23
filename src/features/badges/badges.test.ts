/**
 * Achievement badges.
 *
 * Pure checks on the consistency milestones, plus source assertions on the
 * data-integrity rules: badges are derived on the server from verifying
 * records, never written, never awarded from the browser, and never doubled.
 *
 * Run: npm run test:badges
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addCalendarDaysToKey } from "@/lib/date-utils";
import {
  CONSISTENCY_MILESTONES,
  consistencyMilestonesReached,
} from "@/features/badges/consistency";

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
/** Source with comments stripped, so prose cannot satisfy an assertion. */
function code(rel: string): string {
  return source(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** `n` consecutive IST day keys starting at `start`. */
function run(start: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addCalendarDaysToKey(start, i));
}

const TODAY = "2026-10-23";

/* ─── Consistency milestones ─────────────────────────────────────────────── */

suite("milestones are 30, 60 and 100 days", () => {
  assert(
    CONSISTENCY_MILESTONES.join(",") === "30,60,100",
    `got ${CONSISTENCY_MILESTONES.join(",")}`,
  );
});

suite("29 consecutive days earn nothing", () => {
  const got = consistencyMilestonesReached(run("2026-01-01", 29), TODAY);
  assert(got.length === 0, `expected none, got ${JSON.stringify(got)}`);
});

suite("exactly 30 days earns 30, dated on the 30th day", () => {
  const days = run("2026-01-01", 30);
  const got = consistencyMilestonesReached(days, TODAY);
  assert(got.length === 1, `expected one, got ${got.length}`);
  assert(got[0]!.milestone === 30, "the 30-day milestone");
  assert(got[0]!.reachedOn === days[29], `dated ${got[0]!.reachedOn}`);
});

suite("a gap resets the run", () => {
  const first = run("2026-01-01", 20);
  // 2026-01-21 is skipped, then 20 more days.
  const second = run("2026-01-22", 20);
  const got = consistencyMilestonesReached([...first, ...second], TODAY);
  assert(got.length === 0, "two 20-day runs are not a 30-day run");
});

suite("100 days earns all three, each on its own day", () => {
  const days = run("2026-03-01", 100);
  const got = consistencyMilestonesReached(days, TODAY);
  assert(got.length === 3, `expected three, got ${got.length}`);
  assert(got[0]!.reachedOn === days[29], "30 on day 30");
  assert(got[1]!.reachedOn === days[59], "60 on day 60");
  assert(got[2]!.reachedOn === days[99], "100 on day 100");
});

suite("an earned milestone stays after the streak breaks", () => {
  const earlier = run("2026-01-01", 35);
  const later = run("2026-03-01", 5);
  const got = consistencyMilestonesReached([...earlier, ...later], TODAY);
  assert(got.length === 1 && got[0]!.milestone === 30, "30 is kept");
});

suite("several submissions on one day count once", () => {
  const days = run("2026-01-01", 29);
  const doubled = [...days, ...days, ...days];
  const got = consistencyMilestonesReached(doubled, TODAY);
  assert(got.length === 0, "duplicates must not stretch a 29-day run");
});

suite("future days never count", () => {
  const days = run("2026-10-01", 40); // runs past TODAY
  const got = consistencyMilestonesReached(days, TODAY);
  // 2026-10-01 .. 2026-10-23 is 23 days.
  assert(got.length === 0, "only days up to today are counted");
});

suite("unsorted input gives the same answer", () => {
  const days = run("2026-01-01", 30);
  const shuffled = [...days].reverse();
  const got = consistencyMilestonesReached(shuffled, TODAY);
  assert(got.length === 1 && got[0]!.reachedOn === days[29], "order-independent");
});

/* ─── Data integrity (source assertions) ─────────────────────────────────── */

const derive = code("src/features/badges/get-earned-badges.ts");

suite("badges are derived server-side and never written", () => {
  assert(derive.includes('import "server-only"'), "server-only module");
  for (const write of [".create(", ".createMany(", ".update(", ".upsert(", ".delete("]) {
    assert(!derive.includes(write), `must not call ${write}`);
  }
  assert(
    !derive.includes("ensureClaudeCertificate"),
    "reading badges must not issue a certificate",
  );
});

suite("each badge can appear only once per user", () => {
  assert(derive.includes("new Map<string, EarnedBadge>()"), "deduped by key");
  assert(derive.includes("unique.has(badge.key)"), "first one wins");
  assert(derive.includes("key: `cohort:${row.cohort.slug}`"), "cohort keys are per cohort");
  assert(derive.includes("key: `consistency:${milestone}`"), "consistency keys are per milestone");
});

suite("Claude is earned only through a live certificate", () => {
  assert(derive.includes("CertificateStatus.REVOKED"), "revoked certificates are excluded");
  assert(derive.includes("CertificateType.CLAUDE_CHALLENGE"), "matched by certificate type");
});

suite("AI / DS / SE need 50 passed days and a real award date", () => {
  assert(derive.includes("CHALLENGE_BADGE_DAYS = 50"), "the 50-day bar");
  assert(derive.includes("if (!reachedAt) continue;"), "no date, no badge");
});

suite("cohorts are earned only on a recorded completion", () => {
  assert(derive.includes("EnrollmentStatusV2.COMPLETED"), "COMPLETED status");
  assert(derive.includes("completedAt: { not: null }"), "or a completedAt");
  assert(derive.includes("if (!config) continue;"), "unknown cohorts earn nothing");
});

suite("consistency reads the same activity as the dashboard streak", () => {
  assert(derive.includes("listHubSubmissionTimes(userId)"), "hub submission times");
});

suite("a failed read says so instead of showing no badges", () => {
  assert(derive.includes("return { ok: false };"), "error envelope");
  const box = code("src/components/profile/profile-badges.tsx");
  assert(box.includes("couldn&apos;t load"), "the UI has an error state");
  assert(box.includes("No badges yet"), "and a separate empty state");
});

suite("nothing in the browser can award a badge", () => {
  for (const rel of [
    "src/components/badges/badge-trigger.tsx",
    "src/components/badges/badge-medallion.tsx",
    "src/components/profile/profile-badges.tsx",
  ]) {
    const src = code(rel);
    assert(!src.includes("get-earned-badges"), `${rel} must not import the derivation`);
    assert(!src.includes("fetch("), `${rel} must not call out`);
  }
});

/* ─── Rendering ──────────────────────────────────────────────────────────── */

suite("every medallion owns its gradient ids", () => {
  // Shared ids let a copy inside a display:none container (Quick Links below
  // 1024px) own the gradients, and every visible copy then painted blank.
  const art = code("src/components/badges/badge-medallion.tsx");
  assert(art.includes("useId()"), "ids come from useId");
  assert(!art.includes("gid(badge.key"), "never from the badge key");
});

suite("tiny medallions drop the small print", () => {
  const art = code("src/components/badges/badge-medallion.tsx");
  assert(art.includes("const COMPACT_BELOW = 48"), "a compact threshold exists");
  assert(art.includes("compact: size < COMPACT_BELOW"), "and is applied by size");
});

/* ─── Display sync ───────────────────────────────────────────────────────── */

suite("Quick Links and the profile card share one badge list", () => {
  const page = code("src/app/profile/page.tsx");
  assert(page.includes("getEarnedBadges(userId)"), "loaded once on the server");
  assert(page.includes("badges={badges}"), "and passed to the wizard");
  const wizard = code("src/components/profile/profile-wizard.tsx");
  assert(
    wizard.split("badges={badges}").length === 3,
    "the wizard hands the same list to Quick Links and the review",
  );
  const card = code("src/components/profile/profile-card.tsx");
  assert(card.includes("<QuickLinksBadges badges={badges} />"), "Quick Links box");
  const review = code("src/components/profile/profile-review.tsx");
  assert(review.includes("<ProfileBadgesCard badges={badges} />"), "profile section");
});

suite("/achievements reads badges after it may issue the Claude certificate", () => {
  const page = code("src/app/achievements/page.tsx");
  const issue = page.indexOf("getAchievements(userId)");
  const read = page.indexOf("getEarnedBadges(userId)");
  assert(issue !== -1 && read !== -1 && issue < read, "ordered");
  assert(page.includes('id="badges"'), "the #badges anchor exists");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
