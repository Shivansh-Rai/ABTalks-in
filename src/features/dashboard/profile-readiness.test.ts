/**
 * Plan 180 — the dashboard road unlocks at 70% profile strength, but only once
 * the high-importance details are in.
 *
 * Run: npm run test:profile-readiness
 */
import { CandidateGender, CandidatePersona, GradeType } from "@prisma/client";
import { computeCompleteness } from "@/features/profile/completeness";
import {
  PROFILE_READY_SCORE,
  evaluateProfileReadiness,
} from "@/features/dashboard/profile-readiness";
import type { CandidateDetail } from "@/repositories/candidate-detail";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
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

const skill = (id: string) => ({
  skillId: id,
  name: id,
  slug: id,
  categoryName: null,
  claimedByCandidate: true,
  verified: false,
  evidenceScore: 0,
  evidenceCount: 0,
  lastEvidenceAt: null,
});

const education: CandidateDetail["education"][number] = {
  id: "e1",
  institutionName: "IIT Bombay",
  collegeId: null,
  degree: "B.Tech",
  fieldOfStudy: "CSE",
  startMonth: 7,
  startYear: 2022,
  endMonth: 5,
  graduationYear: 2026,
  isCurrent: false,
  gradeType: GradeType.CGPA_10,
  grade: "8.6",
  description: "Core CS",
};

const project: CandidateDetail["projects"][number] = {
  id: "p1",
  title: "ABTalks",
  description: "A talent platform",
  techStack: ["TypeScript"],
  repoUrl: "https://github.com/abtalks/app",
  liveUrl: "https://abtalks.in",
};

function detail(over: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    userId: "u1",
    fullName: "Test User",
    headline: "Final-year CSE student",
    summary: "I build things",
    awards: null,
    gender: CandidateGender.MALE,
    primaryPersona: CandidatePersona.STUDENT,
    phone: "+919876543210",
    phoneVerified: false,
    locationCity: "Pune",
    locationRegion: "Maharashtra",
    countryCode: "IN",
    linkedinUrl: null,
    githubUsername: null,
    portfolioUrl: null,
    resumeUrl: null,
    hasNoWorkExperience: true,
    referralCode: "ABC123",
    isReadyForInterview: false,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    education: [education],
    experience: [],
    projects: [project],
    certifications: [],
    skills: [skill("a"), skill("b"), skill("c")],
    links: [],
    preference: null,
    ...over,
  };
}

function readiness(over: Partial<CandidateDetail> = {}, hasResume = false) {
  const d = detail(over);
  const completeness = computeCompleteness(d, { hasResume });
  return { ...evaluateProfileReadiness(d, completeness), score: completeness.score };
}

suite("the bar is 70, not 100", () => {
  assert(PROFILE_READY_SCORE === 70, "the bar is 70%");
  const r = readiness();
  assert(r.score < 100, `fixture is deliberately short of 100, got ${r.score}`);
  assert(r.score >= 70, `fixture clears the bar, got ${r.score}`);
  assert(r.ready, `a 70%+ profile with the essentials in is ready (${r.blocking.join(", ")})`);
});

suite("under the bar is not ready even with the essentials in", () => {
  // Drops projects (15) and work history (20); education still completes the
  // history essential, so nothing essential is missing — only the percentage.
  const r = readiness({ projects: [], hasNoWorkExperience: false, experience: [] });
  assert(r.score < PROFILE_READY_SCORE, `expected under 70, got ${r.score}`);
  assert(!r.ready, "under 70 the road stays shut");
  assert(r.blocking.length === 0, `nothing essential is missing, got ${r.blocking.join(", ")}`);
});

suite("a missing essential holds the road shut above 70", () => {
  for (const [label, over] of [
    ["Headline", { headline: null }],
    ["Full name", { fullName: "" }],
    ["Phone number", { phone: null }],
    ["Phone number", { phone: "12" }],
    ["Current city", { locationCity: null }],
    ["At least three skills", { skills: [skill("a"), skill("b")] }],
  ] as [string, Partial<CandidateDetail>][]) {
    // Resume + links + a second project keep the score above the bar so the
    // only thing in the way is the essential itself.
    const r = readiness(
      {
        linkedinUrl: "https://linkedin.com/in/x",
        githubUsername: "tester",
        ...over,
      },
      true,
    );
    assert(
      r.score >= PROFILE_READY_SCORE,
      `${label}: score should stay above the bar, got ${r.score}`,
    );
    assert(!r.ready, `${label}: missing essential must hold the road shut`);
    assert(
      r.blocking.includes(label),
      `${label}: expected it named in blocking, got ${r.blocking.join(", ") || "none"}`,
    );
  }
});

suite("no education and no work history blocks", () => {
  const r = readiness({ education: [], hasNoWorkExperience: false, experience: [] });
  assert(
    r.blocking.includes("Your education or work history"),
    `expected history blocked, got ${r.blocking.join(", ") || "none"}`,
  );
  assert(!r.ready, "an empty history is not ready");
});

suite("'no work experience yet' settles the history essential", () => {
  const r = readiness({ education: [], hasNoWorkExperience: true, experience: [] });
  assert(
    !r.blocking.includes("Your education or work history"),
    "the experience section completes on the tick alone",
  );
});

suite("blocking is ordered most valuable first", () => {
  const r = readiness({ headline: null, phone: null, locationCity: null });
  assert(r.blocking[0] === "Headline", `expected Headline first, got ${r.blocking[0]}`);
  assert(r.blocking[1] === "Phone number", `expected Phone number second, got ${r.blocking[1]}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
