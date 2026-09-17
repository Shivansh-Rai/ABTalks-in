/**
 * Admin "why isn't this candidate showing up?" panel. Run with:
 *   npm run test:candidate-discoverability
 *
 * No network, no database. Two things are pinned here:
 *
 *  1. Every genuinely non-appearing candidate gets the REAL blocker named —
 *     incomplete profile, no skills, suspended, moderated, deleted, no discovery
 *     record, trimmed by the pool cap.
 *  2. The panel never explains a blocker as something the candidate chose. There
 *     is no consent flag, no per-candidate switch and no opt-out anywhere in the
 *     recruiter-search path, so that wording would describe a platform that does
 *     not exist.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GROUP_ORDER,
  evaluateDiscoverability,
  type DiscoverabilityFacts,
} from "@/features/admin/candidate-discoverability";

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
const code = (rel: string) => stripComments(readFileSync(join(root, rel), "utf8"));

const EVALUATOR = "src/features/admin/candidate-discoverability.ts";
const LOADER = "src/features/admin/get-candidate-discoverability.ts";
const PANEL = "src/components/admin/candidate-discoverability-panel.tsx";
const PAGE = "src/app/admin/students/[id]/page.tsx";
const HIRE_REPO = "src/repositories/hire.ts";

const D = (iso: string) => new Date(iso);

/** A candidate with nothing wrong: usable profile, one track, gate clear. */
function healthy(): DiscoverabilityFacts {
  return {
    deletedAt: null,
    anonymizedAt: null,
    disabledAt: null,
    disabledReason: null,
    sessionInvalidatedAt: null,
    gate: { exists: true, searchableByRecruiters: true, withdrawnAt: null },
    passesSearchGate: true,
    profile: {
      exists: true,
      fullName: "Asha Verma",
      headline: "Backend engineer",
      locationCity: "Pune",
      countryCode: "IN",
      educationCount: 1,
      experienceCount: 1,
      hasNoWorkExperience: false,
    },
    skills: { claimed: 6, withEvidence: 2 },
    inProfilePool: true,
    profilePoolAhead: 12,
    profilePoolCap: 600,
    tracks: {
      challengeWithSubmissions: 1,
      programMemberships: 0,
      hackathonWithSubmission: 0,
    },
  };
}

/** Nothing but a profile — no challenge, no cohort, no hackathon. */
function profileOnly(): DiscoverabilityFacts {
  return {
    ...healthy(),
    tracks: {
      challengeWithSubmissions: 0,
      programMemberships: 0,
      hackathonWithSubmission: 0,
    },
  };
}

console.log("\nAdmin candidate discoverability panel\n");

/* ── the real blocker is named ───────────────────────────────────────────── */

suite("incomplete profile: no profile record at all", () => {
  const f = profileOnly();
  f.profile = {
    exists: false,
    fullName: "",
    headline: null,
    locationCity: null,
    countryCode: null,
    educationCount: 0,
    experienceCount: 0,
    hasNoWorkExperience: false,
  };
  f.skills = { claimed: 0, withEvidence: 0 };
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "a candidate with no profile and no track must not appear");
  assert(r.blocker?.id === "profile-record", `blocker was ${r.blocker?.id}`);
  assert(
    r.verdict.includes("there is no candidate profile"),
    `verdict must name the blocker, got: ${r.verdict}`,
  );
});

suite("incomplete profile: profile row with no name", () => {
  const f = profileOnly();
  f.profile.fullName = "   ";
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "an unnamed profile is not in the profile pool");
  assert(r.blocker?.id === "profile-name", `blocker was ${r.blocker?.id}`);
  assert(
    r.verdict.includes("the profile has no name"),
    `verdict must name the blocker, got: ${r.verdict}`,
  );
});

suite("no skills", () => {
  const f = profileOnly();
  f.skills = { claimed: 0, withEvidence: 0 };
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "the profile pool requires at least one skill");
  assert(r.blocker?.id === "skills-claimed", `blocker was ${r.blocker?.id}`);
  assert(
    r.verdict.includes("the profile has no skills"),
    `verdict must name the blocker, got: ${r.verdict}`,
  );
});

suite("suspended account", () => {
  const f = healthy();
  f.disabledAt = D("2026-09-01T10:00:00Z");
  f.disabledReason = "Spam submissions";
  f.passesSearchGate = false;
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "a suspended account is dropped by the gate");
  assert(r.blocker?.id === "account-suspended", `blocker was ${r.blocker?.id}`);
  assert(
    r.verdict.includes("the account is suspended"),
    `verdict must name the blocker, got: ${r.verdict}`,
  );
  assert(
    r.blocker!.detail.includes("Spam submissions"),
    "the reason on file must be shown",
  );
});

suite("moderated candidate", () => {
  const f = healthy();
  f.gate = { exists: true, searchableByRecruiters: false, withdrawnAt: null };
  f.passesSearchGate = false;
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "a moderation stop removes the candidate platform-wide");
  assert(r.blocker?.id === "moderation-stop", `blocker was ${r.blocker?.id}`);
  assert(
    r.verdict.includes("an admin moderation stop is in force"),
    `verdict must name the blocker, got: ${r.verdict}`,
  );
});

suite("durable moderation stop is reported on its own", () => {
  const f = healthy();
  f.gate = {
    exists: true,
    searchableByRecruiters: true,
    withdrawnAt: D("2026-08-20T08:00:00Z"),
  };
  f.passesSearchGate = false;
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "the gate requires the durable stop to be clear");
  assert(
    r.blocker?.id === "moderation-durable-stop",
    `blocker was ${r.blocker?.id}`,
  );
});

suite("deleted candidate", () => {
  const f = healthy();
  f.deletedAt = D("2026-09-10T06:30:00Z");
  f.anonymizedAt = D("2026-09-10T06:30:00Z");
  f.gate = {
    exists: true,
    searchableByRecruiters: false,
    withdrawnAt: D("2026-09-10T06:30:00Z"),
  };
  f.passesSearchGate = false;
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "deleted accounts are excluded everywhere");
  assert(r.blocker?.id === "account-deleted", `blocker was ${r.blocker?.id}`);
  assert(
    r.verdict.includes("the account was deleted"),
    `verdict must name the blocker, got: ${r.verdict}`,
  );
  const anonymized = r.checks.find((c) => c.id === "account-anonymized");
  assert(anonymized?.status === "INFO", "erasure is context, not the blocker");
});

suite("no recruiter-discovery record", () => {
  const f = profileOnly();
  f.gate = { exists: false, searchableByRecruiters: false, withdrawnAt: null };
  f.passesSearchGate = false;
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "the gate joins to a record this candidate does not have");
  assert(r.blocker?.id === "discovery-record", `blocker was ${r.blocker?.id}`);
  const moderation = r.checks.find((c) => c.id === "moderation-stop");
  assert(
    moderation?.status === "INFO",
    "with no record there is no moderation stop to report as a blocker",
  );
});

suite("trimmed by the profile pool cap", () => {
  const f = profileOnly();
  f.profilePoolAhead = 640;

  const r = evaluateDiscoverability(f);
  assert(!r.appears, "a candidate past the pool cap is never loaded");
  assert(r.blocker?.id === "profile-pool-cap", `blocker was ${r.blocker?.id}`);
  assert(
    r.blocker!.detail.includes("640") && r.blocker!.detail.includes("600"),
    "the cap row must show the real position and the real cap",
  );
});

/* ── honesty about what is NOT a blocker ─────────────────────────────────── */

suite("a track record carries a candidate whose profile is unusable", () => {
  const f = healthy();
  f.profile.fullName = "";
  f.skills = { claimed: 0, withEvidence: 0 };
  f.inProfilePool = false;

  const r = evaluateDiscoverability(f);
  assert(r.appears, "challenge submissions still reach recruiters");
  assert(r.blocker === null, "there is no blocker when the candidate appears");
  const name = r.checks.find((c) => c.id === "profile-name");
  const skills = r.checks.find((c) => c.id === "skills-claimed");
  assert(name?.status === "LIMITING", `profile-name was ${name?.status}`);
  assert(skills?.status === "LIMITING", `skills-claimed was ${skills?.status}`);
  assert(
    r.verdict.startsWith("Appears in recruiter search"),
    `verdict was: ${r.verdict}`,
  );
});

suite("invalidated sessions are context, never a blocker", () => {
  const f = healthy();
  f.sessionInvalidatedAt = D("2026-09-05T04:00:00Z");
  const r = evaluateDiscoverability(f);
  const row = r.checks.find((c) => c.id === "sessions-invalidated");
  assert(row?.status === "INFO", "sign-out does not affect recruiter search");
  assert(r.appears, "the candidate still appears");
});

suite("missing skill evidence narrows rather than blocks", () => {
  const f = healthy();
  f.skills = { claimed: 4, withEvidence: 0 };
  const r = evaluateDiscoverability(f);
  const row = r.checks.find((c) => c.id === "skills-evidence");
  assert(row?.status === "LIMITING", `skills-evidence was ${row?.status}`);
  assert(r.appears, "an evidence floor is a recruiter filter, not the gate");
});

suite("a healthy candidate reports every condition group", () => {
  const r = evaluateDiscoverability(healthy());
  assert(r.appears, "nothing is wrong with this candidate");
  assert(r.blocker === null, "no blocker");
  for (const group of GROUP_ORDER) {
    assert(
      r.checks.some((c) => c.group === group),
      `no check reported for the ${group} group`,
    );
  }
  for (const id of [
    "account-deleted",
    "account-suspended",
    "moderation-stop",
    "discovery-record",
    "profile-record",
    "skills-claimed",
  ]) {
    assert(r.checks.some((c) => c.id === id), `condition ${id} is not listed`);
  }
});

suite("a named blocker always carries a summary and a detail", () => {
  const scenarios: DiscoverabilityFacts[] = [];

  const deleted = healthy();
  deleted.deletedAt = D("2026-09-10T06:30:00Z");
  deleted.passesSearchGate = false;
  deleted.inProfilePool = false;
  deleted.tracks = {
    challengeWithSubmissions: 0,
    programMemberships: 0,
    hackathonWithSubmission: 0,
  };
  scenarios.push(deleted);

  const suspended = profileOnly();
  suspended.disabledAt = D("2026-09-01T10:00:00Z");
  suspended.passesSearchGate = false;
  suspended.inProfilePool = false;
  scenarios.push(suspended);

  const moderated = profileOnly();
  moderated.gate = {
    exists: true,
    searchableByRecruiters: false,
    withdrawnAt: null,
  };
  moderated.passesSearchGate = false;
  moderated.inProfilePool = false;
  scenarios.push(moderated);

  for (const f of scenarios) {
    const r = evaluateDiscoverability(f);
    assert(!r.appears, "scenario must not appear");
    assert(Boolean(r.blocker?.summary), "the blocker must name itself");
    assert(
      r.blocker!.detail.length > 40,
      "the blocker must explain itself in plain words",
    );
  }
});

/* ── no consent / opt-out wording anywhere ───────────────────────────────── */

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /consent/i, why: "no consent exists in the recruiter-search path" },
  {
    pattern: /visibilit|visible/i,
    why: "there is no candidate-facing visibility setting to enable",
  },
  { pattern: /\bopted\s+out\b/i, why: "candidates cannot opt out" },
  { pattern: /\bopt[\s-](?:in|out)\b/i, why: "candidates cannot opt in or out" },
  { pattern: /\bopt-?ins?\b/i, why: "candidates cannot opt in" },
];

suite("panel and evaluator sources carry no consent or opt-out wording", () => {
  for (const rel of [EVALUATOR, PANEL]) {
    const src = code(rel);
    for (const { pattern, why } of FORBIDDEN) {
      const hit = src.match(pattern);
      assert(hit === null, `${rel} says "${hit?.[0]}" — ${why}`);
    }
  }
});

suite("no rendered string in any scenario carries that wording", () => {
  const scenarios: DiscoverabilityFacts[] = [];

  const push = (mutate: (f: DiscoverabilityFacts) => void) => {
    const f = profileOnly();
    mutate(f);
    scenarios.push(f);
  };

  scenarios.push(healthy(), profileOnly());
  push((f) => {
    f.deletedAt = D("2026-09-10T06:30:00Z");
    f.anonymizedAt = D("2026-09-10T06:30:00Z");
    f.gate = {
      exists: true,
      searchableByRecruiters: false,
      withdrawnAt: D("2026-09-10T06:30:00Z"),
    };
    f.passesSearchGate = false;
    f.inProfilePool = false;
  });
  push((f) => {
    f.disabledAt = D("2026-09-01T10:00:00Z");
    f.disabledReason = "Spam submissions";
    f.sessionInvalidatedAt = D("2026-09-01T10:00:00Z");
    f.passesSearchGate = false;
    f.inProfilePool = false;
  });
  push((f) => {
    f.gate = { exists: true, searchableByRecruiters: false, withdrawnAt: null };
    f.passesSearchGate = false;
    f.inProfilePool = false;
  });
  push((f) => {
    f.gate = { exists: false, searchableByRecruiters: false, withdrawnAt: null };
    f.passesSearchGate = false;
    f.inProfilePool = false;
  });
  push((f) => {
    f.profile = {
      exists: false,
      fullName: "",
      headline: null,
      locationCity: null,
      countryCode: null,
      educationCount: 0,
      experienceCount: 0,
      hasNoWorkExperience: false,
    };
    f.skills = { claimed: 0, withEvidence: 0 };
    f.inProfilePool = false;
  });
  push((f) => {
    f.skills = { claimed: 0, withEvidence: 0 };
    f.inProfilePool = false;
  });
  push((f) => {
    f.profilePoolAhead = 640;
  });

  for (const f of scenarios) {
    const r = evaluateDiscoverability(f);
    const strings = [
      r.verdict,
      ...r.checks.flatMap((c) => [c.label, c.detail, c.summary ?? "", c.action ?? ""]),
    ];
    for (const s of strings) {
      for (const { pattern, why } of FORBIDDEN) {
        const hit = s.match(pattern);
        assert(hit === null, `panel copy says "${hit?.[0]}" in "${s}" — ${why}`);
      }
    }
  }
});

/* ── the checks describe the live query, not a parallel invention ────────── */

suite("the loader probes the platform's own gate and pool", () => {
  const src = code(LOADER);
  assert(
    src.includes("searchableUserWhere()"),
    "the verdict must run the one discovery gate, not restate it",
  );
  assert(
    src.includes("resolveProfileRefs"),
    "profile-pool membership must come from the repository /hire itself uses",
  );
  assert(
    !/candidateVisibility\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(
      src,
    ),
    "this panel is read-only; it must never write the discovery record",
  );
  assert(
    !src.includes("consentSource") && !src.includes("consentedAt"),
    "the legacy audit columns are not read by this panel",
  );
});

suite("the pool-cap count mirrors the repository predicate", () => {
  const repo = code(HIRE_REPO);
  const loader = code(LOADER);
  for (const clause of ['fullName: { not: "" }', "claimedByCandidate: true"]) {
    assert(repo.includes(clause), `repository no longer has ${clause}`);
    assert(loader.includes(clause), `loader no longer mirrors ${clause}`);
  }
});

suite("panel is a read-only Server Component mounted on the admin page", () => {
  const panel = code(PANEL);
  assert(!panel.includes('"use client"'), "the panel must stay a Server Component");
  assert(
    !panel.includes("@/app/actions"),
    "the panel must not import Server Actions",
  );
  const page = code(PAGE);
  assert(
    page.includes("CandidateDiscoverabilityPanel"),
    "the admin candidate page must mount the panel",
  );
  assert(page.includes("requireAdmin"), "the page must stay admin-gated");
});

if (failed > 0) {
  console.log(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
