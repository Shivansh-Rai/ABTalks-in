/**
 * Plan 128 — assessment preset validity tests.
 *   npm run test:assessment-presets
 *
 * Every shipped preset must parse cleanly through the same Zod schema a
 * recruiter's own assessment goes through, so a malformed template can never
 * reach production.
 */
import { assessmentDraftSchema } from "@/lib/validations/assessment";
import {
  listAssessmentPresets,
  getAssessmentPreset,
  buildContentFromPresets,
} from "./presets";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
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

function run() {
  console.log("\nPlan 128 assessment preset validity tests\n");

  const presets = listAssessmentPresets();

  suite("at least one preset ships", () => {
    assert(presets.length > 0, "expected presets");
  });

  suite("preset ids are unique", () => {
    const ids = presets.map((p) => p.id);
    assert(new Set(ids).size === ids.length, `duplicate id in ${ids.join(", ")}`);
  });

  for (const preset of presets) {
    suite(`preset "${preset.id}" is a valid draft`, () => {
      const parsed = assessmentDraftSchema.safeParse({
        ...preset.content,
        shortlistRefs: [],
      });
      assert(
        parsed.success,
        parsed.success
          ? ""
          : parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
      );
    });

    suite(`preset "${preset.id}" has display metadata`, () => {
      assert(preset.name.trim().length > 0, "name required");
      assert(preset.tagline.trim().length > 0, "tagline required");
      assert(preset.tags.length > 0, "at least one tag");
    });
  }

  suite("getAssessmentPreset finds a known id and rejects unknown", () => {
    const first = presets[0];
    assert(getAssessmentPreset(first.id)?.id === first.id, "known id found");
    assert(getAssessmentPreset("does-not-exist") === null, "unknown id is null");
  });

  suite("buildContentFromPresets merges questions and stays valid", () => {
    const ids = presets.map((p) => p.id);
    const merged = buildContentFromPresets(ids);
    assert(merged !== null, "merge returns content");
    if (!merged) return;
    const totalQuestions = presets.reduce(
      (sum, p) => sum + p.content.questions.length,
      0,
    );
    assert(
      merged.questions.length === totalQuestions,
      "all questions concatenated",
    );
    const parsed = assessmentDraftSchema.safeParse({
      ...merged,
      shortlistRefs: [],
    });
    assert(
      parsed.success,
      parsed.success
        ? ""
        : parsed.error.issues.map((i) => i.message).join("; "),
    );
  });

  suite("buildContentFromPresets ignores unknown ids and returns null for none", () => {
    const one = buildContentFromPresets([presets[0].id, "nope"]);
    assert(one !== null && one.questions.length > 0, "known id still used");
    assert(buildContentFromPresets(["nope", "nada"]) === null, "all-unknown → null");
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
