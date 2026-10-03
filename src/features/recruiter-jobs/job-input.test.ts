/**
 * Paste-tolerant job input schema.
 *   npx tsx src/features/recruiter-jobs/job-input.test.ts
 */
import assert from "node:assert/strict";
import {
  coerceMinExperience,
  createJobInputSchema,
  jobInputErrorMessage,
  normalizeApplyUrl,
} from "./job-input";
import { JOB_SKILL_MAX_COUNT, JOB_SKILL_MAX_LEN } from "./lifecycle";

let passed = 0;
let failed = 0;

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

const base = {
  title: "Backend Engineer",
  description: "Build APIs and own delivery.",
  workMode: "REMOTE" as const,
  opportunityType: "FULL_TIME" as const,
};

function run() {
  console.log("\njob-input\n");

  suite("normalizeApplyUrl prepends https://", () => {
    assert.equal(
      normalizeApplyUrl("careers.acme.com/jobs/1"),
      "https://careers.acme.com/jobs/1",
    );
    assert.equal(normalizeApplyUrl("https://acme.com"), "https://acme.com");
    assert.equal(normalizeApplyUrl(""), "");
    assert.equal(normalizeApplyUrl("  "), "");
  });

  suite("coerceMinExperience accepts pasted year phrases", () => {
    assert.equal(coerceMinExperience(""), null);
    assert.equal(coerceMinExperience("2"), 2);
    assert.equal(coerceMinExperience("2 years"), 2);
    assert.equal(coerceMinExperience(3), 3);
    assert.equal(coerceMinExperience(null), null);
    assert.ok(Number.isNaN(coerceMinExperience("abc") as number));
  });

  suite("accepts URL without scheme after normalize", () => {
    const parsed = createJobInputSchema.safeParse({
      ...base,
      applyExternalUrl: "www.acme.com/careers",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.applyExternalUrl, "https://www.acme.com/careers");
    }
  });

  suite("truncates overlong skills instead of failing", () => {
    const long = "x".repeat(JOB_SKILL_MAX_LEN + 40);
    const parsed = createJobInputSchema.safeParse({
      ...base,
      skills: [long, "React"],
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.skills[0]?.length, JOB_SKILL_MAX_LEN);
      assert.equal(parsed.data.skills[1], "React");
    }
  });

  suite("caps skill count instead of failing", () => {
    const many = Array.from(
      { length: JOB_SKILL_MAX_COUNT + 10 },
      (_, i) => `s${i}`,
    );
    const parsed = createJobInputSchema.safeParse({ ...base, skills: many });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.skills.length, JOB_SKILL_MAX_COUNT);
    }
  });

  suite("coerces minExperience from string", () => {
    const parsed = createJobInputSchema.safeParse({
      ...base,
      minExperience: "5 years",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.minExperience, 5);
  });

  suite("returns field-level error messages", () => {
    const parsed = createJobInputSchema.safeParse({
      ...base,
      title: "",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(jobInputErrorMessage(parsed.error), "Add a job title.");
    }
  });

  suite("rejects nonsense apply URLs with a clear message", () => {
    const parsed = createJobInputSchema.safeParse({
      ...base,
      applyExternalUrl: "not a url !!!",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.match(jobInputErrorMessage(parsed.error), /valid apply URL/i);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
