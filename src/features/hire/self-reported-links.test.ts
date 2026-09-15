/**
 * T-216 — declared GitHub / LeetCode / CodeChef links are SELF-REPORTED only.
 * Run: npx tsx src/features/hire/self-reported-links.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CandidateLinkType } from "@prisma/client";
import {
  assertCodingProfileHost,
  ensureHttpUrl,
  linksSectionSchema,
  mergeCodingProfileLinks,
} from "@/lib/validations/candidate-profile";
import { shapeSelfReportedExternalLinks } from "@/features/hire/self-reported-links";

function suite(name: string, fn: () => void) {
  console.log(`\n▸ ${name}`);
  fn();
}

suite("assertCodingProfileHost accepts real hosts", () => {
  assert.equal(
    assertCodingProfileHost("LEETCODE", "https://leetcode.com/u/alice"),
    null,
  );
  assert.equal(
    assertCodingProfileHost("LEETCODE", "https://www.leetcode.com/alice"),
    null,
  );
  assert.equal(
    assertCodingProfileHost(
      "CODECHEF",
      "https://www.codechef.com/users/alice",
    ),
    null,
  );
  assert.equal(
    assertCodingProfileHost("LEETCODE", "leetcode.com/u/alice"),
    null,
    "bare host is accepted after https normalize",
  );
});

suite("ensureHttpUrl prepends https for bare hosts", () => {
  assert.equal(ensureHttpUrl("leetcode.com/u/alice"), "https://leetcode.com/u/alice");
  assert.equal(
    ensureHttpUrl("https://codechef.com/users/alice"),
    "https://codechef.com/users/alice",
  );
  assert.equal(ensureHttpUrl(""), "");
});

suite("linksSectionSchema normalizes bare coding URLs", () => {
  const parsed = linksSectionSchema.safeParse({
    linkedinUrl: null,
    githubUsername: null,
    portfolioUrl: null,
    leetcodeUrl: "leetcode.com/u/alice",
    codechefUrl: "www.codechef.com/users/bob",
    extra: [],
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.leetcodeUrl, "https://leetcode.com/u/alice");
  assert.equal(parsed.data.codechefUrl, "https://www.codechef.com/users/bob");
});

suite("assertCodingProfileHost refuses nonsense hosts", () => {
  const badLc = assertCodingProfileHost(
    "LEETCODE",
    "https://example.com/alice",
  );
  assert.ok(badLc && /LeetCode/i.test(badLc));

  const badCc = assertCodingProfileHost(
    "CODECHEF",
    "https://github.com/alice",
  );
  assert.ok(badCc && /CodeChef/i.test(badCc));
});

suite("linksSectionSchema enforces LeetCode and CodeChef hosts", () => {
  const ok = linksSectionSchema.safeParse({
    linkedinUrl: null,
    githubUsername: "alice",
    portfolioUrl: null,
    leetcodeUrl: "https://leetcode.com/u/alice",
    codechefUrl: "https://codechef.com/users/alice",
    extra: [],
  });
  assert.equal(ok.success, true);

  const bad = linksSectionSchema.safeParse({
    linkedinUrl: null,
    githubUsername: null,
    portfolioUrl: null,
    leetcodeUrl: "https://not-leetcode.example/alice",
    codechefUrl: null,
    extra: [],
  });
  assert.equal(bad.success, false);
});

suite("mergeCodingProfileLinks folds fixed fields into CandidateLink rows", () => {
  const merged = mergeCodingProfileLinks({
    linkedinUrl: null,
    githubUsername: null,
    portfolioUrl: null,
    leetcodeUrl: "https://leetcode.com/u/alice",
    codechefUrl: "https://codechef.com/users/alice",
    extra: [
      {
        type: CandidateLinkType.LEETCODE,
        label: null,
        url: "https://leetcode.com/u/stale",
      },
      {
        type: CandidateLinkType.KAGGLE,
        label: null,
        url: "https://kaggle.com/alice",
      },
    ],
  });
  assert.deepEqual(
    merged.map((r) => [r.type, r.url]),
    [
      ["LEETCODE", "https://leetcode.com/u/alice"],
      ["CODECHEF", "https://codechef.com/users/alice"],
      ["KAGGLE", "https://kaggle.com/alice"],
    ],
  );
});

suite("shapeSelfReportedExternalLinks builds the three providers", () => {
  const links = shapeSelfReportedExternalLinks({
    githubUsername: "alice-dev",
    githubAllowedByPolicy: true,
    links: [
      {
        type: CandidateLinkType.LEETCODE,
        url: "https://leetcode.com/u/alice",
        label: null,
      },
      {
        type: CandidateLinkType.CODECHEF,
        url: "https://codechef.com/users/alice",
        label: null,
      },
      {
        type: CandidateLinkType.KAGGLE,
        url: "https://kaggle.com/alice",
        label: null,
      },
    ],
  });

  assert.deepEqual(
    links.map((l) => l.provider),
    ["GITHUB", "LEETCODE", "CODECHEF"],
  );
  assert.equal(links[0]?.url, "https://github.com/alice-dev");
  assert.ok(links.every((l) => l.url.startsWith("http")));
});

suite("shapeSelfReportedExternalLinks respects policy and blanks", () => {
  assert.deepEqual(
    shapeSelfReportedExternalLinks({
      githubUsername: "alice",
      githubAllowedByPolicy: false,
      links: [],
    }),
    [],
  );
  assert.deepEqual(
    shapeSelfReportedExternalLinks({
      githubUsername: "  ",
      githubAllowedByPolicy: true,
      links: [],
    }),
    [],
  );
});

suite("inspector action never selects protected contact fields", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/actions/hire-view-actions.ts"),
    "utf8",
  );
  const fnStart = src.indexOf("loadInspectorExternalLinksAction");
  assert.ok(fnStart > 0, "action exists");
  const fn = src.slice(fnStart, fnStart + 1200);
  for (const forbidden of [
    "linkedinUrl",
    "resumeUrl",
    "email",
    "phone",
  ]) {
    assert.equal(
      fn.includes(forbidden),
      false,
      `loadInspectorExternalLinksAction must not mention ${forbidden}`,
    );
  }
  assert.ok(fn.includes("listSelfReportedExternalLinks"));
  assert.ok(
    fn.includes("resolveInspectorCandidate"),
    "external links use inspector addressability (no challenge minDays)",
  );
});

suite("repository helper select stays contact-safe", () => {
  const src = readFileSync(
    join(process.cwd(), "src/repositories/candidate-detail.ts"),
    "utf8",
  );
  const fnStart = src.indexOf("listSelfReportedExternalLinks");
  assert.ok(fnStart > 0);
  const fn = src.slice(fnStart, fnStart + 900);
  for (const forbidden of [
    "linkedinUrl",
    "resumeUrl",
    "email",
    "phone",
  ]) {
    assert.equal(
      fn.includes(forbidden),
      false,
      `listSelfReportedExternalLinks must not select ${forbidden}`,
    );
  }
  assert.ok(fn.includes("githubUsername"));
  assert.ok(fn.includes("LEETCODE") && fn.includes("CODECHEF"));
});

console.log("\nAll self-reported link checks passed.");
