/**
 * T-253 event vocabulary + PII filter tests — run with:
 *   npm run test:analytics-events
 * or:
 *   npx tsx src/lib/analytics/events.test.ts
 *
 * Covers the pure half of the instrumentation: the names, the parameter
 * allowlist, the bucket rules, and the consent gate. The React wiring that
 * calls into it (use-track.ts and the emit sites) is guarded structurally by
 * instrumentation.test.ts and confirmed end to end in GA4 DebugView.
 */
import {
  ANALYTICS_EVENTS,
  PROFILE_SECTIONS,
  SCORE_BUCKETS,
  SKILL_COUNT_BUCKETS,
  allowedParamsFor,
  hasAnalyticsConsent,
  sanitizeParams,
  scoreBucket,
  skillCountBucket,
  type AnalyticsEventName,
} from "@/lib/analytics/events";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log("  ✓", name);
}

const NAMES = Object.values(ANALYTICS_EVENTS) as AnalyticsEventName[];

console.log("T-253 analytics events: vocabulary, PII filter, buckets, consent");

// ── The nine T-253 behaviours ────────────────────────────────────────────────

{
  // Seven of the nine requested behaviours reach GA4. The other two have no
  // emit site that could honestly fire:
  //   - "job alert sent" runs in a Vercel cron with no browser and no consent
  //     signal (see features/hire/run-hire-alerts.ts),
  //   - "profile-view notification sent" has no underlying feature — nothing in
  //     the schema records a profile view and nothing notifies a candidate.
  assert(NAMES.length === 7, `expected 7 event names, got ${NAMES.length}`);
  assert(new Set(NAMES).size === 7, "event names must be unique");
  ok("vocabulary: 7 unique names (2 of the 9 behaviours have no emit site)");
}

{
  const expected = [
    "recruiter_reg_submitted", // recruiter signup completed
    "recruiter_candidate_viewed", // candidate profile viewed
    "recruiter_contact_unlocked", // contact unlock completed
    "site_profile_updated", // candidate profile updated
    "site_skill_added", // candidate skill added
    "site_job_applied", // job application created
    "site_test_completed", // assessment submitted
  ];
  for (const name of expected) {
    assert(
      (NAMES as string[]).includes(name),
      `missing required event: ${name}`,
    );
  }
  ok("vocabulary: every instrumented T-253 behaviour has its taxonomy name");
}

{
  // Plan 114 §3: lowercase snake_case ASCII, self-capped at 32 characters.
  for (const name of NAMES) {
    assert(/^[a-z][a-z0-9_]*$/.test(name), `${name} is not lowercase snake_case`);
    assert(name.length <= 32, `${name} exceeds the 32-char cap`);
  }
  ok("vocabulary: names are lowercase snake_case and within the 32-char cap");
}

{
  // The excluded four. Nothing in the vocabulary can name them, so no emit site
  // can reference one through ANALYTICS_EVENTS even by accident.
  const forbidden = [
    "visibility", // candidate visibility toggles
    "login", // recruiter Google login
    "member", // company admin — member invited
    "role", // company admin — role changed
    "company", // company admin — company updated
    "invite", // team invitation
    "team",
  ];
  for (const fragment of forbidden) {
    const hit = NAMES.find((n) => n.includes(fragment));
    assert(!hit, `excluded concept "${fragment}" is tracked as ${hit}`);
  }
  ok("exclusions: no event name covers visibility, login, company admin or invites");
}

// ── Parameter allowlist ──────────────────────────────────────────────────────

{
  // Every event declares its contract, even the ones whose contract is "none".
  for (const name of NAMES) {
    assert(
      typeof allowedParamsFor(name) === "object",
      `${name} has no parameter contract`,
    );
  }
  ok("params: every event declares a parameter contract");
}

{
  const parameterless: AnalyticsEventName[] = [
    ANALYTICS_EVENTS.recruiterCandidateViewed,
    ANALYTICS_EVENTS.recruiterContactUnlocked,
    ANALYTICS_EVENTS.siteJobApplied,
  ];
  for (const name of parameterless) {
    assert(
      Object.keys(allowedParamsFor(name)).length === 0,
      `${name} should take no parameters`,
    );
  }
  ok("params: the three events that need no data declare none");
}

{
  // Plan 114 §11: every parameter has a bounded value set, with no exceptions.
  for (const name of NAMES) {
    for (const [key, values] of Object.entries(allowedParamsFor(name))) {
      assert(values.length > 0, `${name}.${key} has an empty value set`);
      for (const v of values) {
        assert(
          typeof v === "string" && v.length > 0 && v.length <= 40,
          `${name}.${key} has a value that is not a short string`,
        );
      }
    }
  }
  ok("params: every declared parameter has a bounded, short value set");
}

// ── PII filter ───────────────────────────────────────────────────────────────

{
  // The plan 114 §7 "never send" list, aimed at every event at once. None of it
  // is on any allowlist, so none of it survives — whatever a call site does.
  const pii: Record<string, unknown> = {
    email: "priya@example.com",
    private_email: "priya@example.com",
    phone: "+919876543210",
    full_name: "Priya Sharma",
    fullName: "Priya Sharma",
    password: "hunter2",
    token: "eyJhbGciOiJIUzI1NiJ9.abc.def",
    otp: "483920",
    resume_text: "Priya Sharma — 4 years at …",
    note: "Strong candidate, asked for 18 LPA",
    candidate_note: "Strong candidate, asked for 18 LPA",
    answers: "A,B,C,D",
    score: 7,
    user_id: "clx8f2h9k0001abcd",
    userId: "clx8f2h9k0001abcd",
    jobId: "clx8f2h9k0002efgh",
    skill_names: "React, Node.js",
    company: "Acme Corp",
    page_location: "https://abtalks.dev/register?email=priya@example.com",
  };

  for (const name of NAMES) {
    const safe = sanitizeParams(name, pii);
    assert(
      Object.keys(safe).length === 0,
      `${name} leaked ${Object.keys(safe).join(", ")}`,
    );
  }
  ok("pii: no event passes through email, phone, name, note, answers, ids or tokens");
}

{
  // A raw form object, handed over whole — the mistake the allowlist exists for.
  const rawForm = {
    fullName: "Priya Sharma",
    company: "Acme Corp",
    email: "priya@example.com",
    phone: "+919876543210",
    code: "483920",
    acceptedTerms: true,
    newsletterOptIn: true,
  };
  const safe = sanitizeParams(ANALYTICS_EVENTS.recruiterRegSubmitted, rawForm);
  assert(
    Object.keys(safe).length === 0,
    `recruiter signup leaked ${Object.keys(safe).join(", ")}`,
  );
  ok("pii: passing the whole registration form sends nothing at all");
}

{
  // The right key holding the wrong thing — free text smuggled under an
  // allowlisted name — is dropped on the value check, not just the key check.
  const smuggled = sanitizeParams(ANALYTICS_EVENTS.siteProfileUpdated, {
    section: "priya@example.com",
  });
  assert(
    smuggled.section === undefined,
    "an out-of-set value survived under an allowed key",
  );

  const smuggledBucket = sanitizeParams(ANALYTICS_EVENTS.siteTestCompleted, {
    score_bucket: "7/10 — Priya Sharma",
  });
  assert(
    smuggledBucket.score_bucket === undefined,
    "an out-of-set bucket value survived",
  );
  ok("pii: an allowed key holding an unlisted value is dropped too");
}

{
  // Non-strings cannot pass either — no numeric ids, no booleans, no objects.
  const typed = sanitizeParams(ANALYTICS_EVENTS.siteSkillAdded, {
    skill_count_bucket: 11,
  });
  assert(
    typed.skill_count_bucket === undefined,
    "a non-string value survived the filter",
  );
  ok("pii: non-string values are dropped");
}

{
  // The parameter-less events stay parameter-less however they are called.
  const withJunk = sanitizeParams(ANALYTICS_EVENTS.siteJobApplied, {
    jobId: "clx8f2h9k0002efgh",
    note: "Why I'm a great fit",
  });
  assert(
    Object.keys(withJunk).length === 0,
    "a parameter-less event accepted parameters",
  );
  ok("pii: parameter-less events send nothing even when handed data");
}

{
  // Undefined params is the normal call for a parameter-less event.
  assert(
    Object.keys(sanitizeParams(ANALYTICS_EVENTS.siteJobApplied)).length === 0,
    "omitting params should produce an empty object",
  );
  ok("params: omitting params yields an empty payload, not a crash");
}

{
  // And the legitimate values do get through, or the events would be useless.
  for (const section of PROFILE_SECTIONS) {
    const safe = sanitizeParams(ANALYTICS_EVENTS.siteProfileUpdated, { section });
    assert(safe.section === section, `section ${section} was wrongly dropped`);
  }
  for (const bucket of SKILL_COUNT_BUCKETS) {
    const safe = sanitizeParams(ANALYTICS_EVENTS.siteSkillAdded, {
      skill_count_bucket: bucket,
    });
    assert(
      safe.skill_count_bucket === bucket,
      `skill bucket ${bucket} was wrongly dropped`,
    );
  }
  for (const bucket of SCORE_BUCKETS) {
    const safe = sanitizeParams(ANALYTICS_EVENTS.siteTestCompleted, {
      score_bucket: bucket,
    });
    assert(
      safe.score_bucket === bucket,
      `score bucket ${bucket} was wrongly dropped`,
    );
  }
  const method = sanitizeParams(ANALYTICS_EVENTS.recruiterRegSubmitted, {
    method: "otp",
  });
  assert(method.method === "otp", "method=otp was wrongly dropped");
  ok("params: every declared value survives the filter");
}

{
  // The filter must not hand back the caller's object, or a later mutation of
  // the payload would reach into what was already sent.
  const input = { section: "basic" };
  const safe = sanitizeParams(ANALYTICS_EVENTS.siteProfileUpdated, input);
  assert(safe !== (input as unknown), "sanitizeParams returned the input object");
  ok("params: the filter returns a fresh object, never the caller's");
}

// ── Bucket rules ─────────────────────────────────────────────────────────────

{
  assert(skillCountBucket(1) === "1-3", "1 skill is 1-3");
  assert(skillCountBucket(3) === "1-3", "3 skills is 1-3");
  assert(skillCountBucket(4) === "4-10", "4 skills is 4-10");
  assert(skillCountBucket(10) === "4-10", "10 skills is 4-10");
  assert(skillCountBucket(11) === "11+", "11 skills is 11+");
  assert(skillCountBucket(250) === "11+", "250 skills is 11+");
  ok("buckets: skill count bands at the 3/10 boundaries");
}

{
  assert(scoreBucket(0, 10) === "low", "0/10 is low");
  assert(scoreBucket(3, 10) === "low", "3/10 is low");
  assert(scoreBucket(4, 10) === "mid", "4/10 is mid");
  assert(scoreBucket(7, 10) === "mid", "7/10 is mid");
  assert(scoreBucket(75, 100) === "high", "75/100 is high");
  assert(scoreBucket(10, 10) === "high", "10/10 is high");
  ok("buckets: score bands at the 40% / 75% boundaries");
}

{
  // A quiz with no questions cannot be scored; dividing by zero would send NaN.
  assert(scoreBucket(0, 0) === "low", "an empty quiz must not divide by zero");
  ok("buckets: a zero-question quiz reads low rather than NaN");
}

// ── Consent gate (reuses T-252's mapping) ────────────────────────────────────

{
  assert(hasAnalyticsConsent(null) === false, "undecided must not emit");
  assert(hasAnalyticsConsent("essential") === false, "essential must not emit");
  assert(hasAnalyticsConsent("limited") === true, "limited may emit");
  assert(hasAnalyticsConsent("all") === true, "all may emit");
  ok("consent: emits only on limited/all — the same gate T-252's loader uses");
}

console.log(`\n${passed} assertions passed`);
