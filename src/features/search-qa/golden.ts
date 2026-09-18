/**
 * The golden recruiter-search dataset: deterministic QA candidates whose
 * correct search behaviour is written down by hand.
 *
 * It lives in memory, never in a database — nothing here can pollute
 * production. `buildGoldenPool` turns the canonical fixtures into the search
 * documents the real track loaders would produce (the same per-track read
 * rules, `splitSkills`, the NULLS-FIRST education pick, the real
 * `mergeTrackLoads` dedupe) so the service's pure stages can be exercised
 * exactly as production runs them.
 *
 * Fixtures QA053+ are FAULT INJECTIONS — a stale document, a deleted user in
 * the pool, a dropped row — that exist only to prove the classifier names each
 * failure correctly. They are kept out of the regression pool.
 *
 * Server-only through its imports (dossier / loaders); used by the offline
 * suite under `--conditions=react-server`.
 */
import { declared, derived, verified } from "@/features/hire/dossier-provenance";
import { computeCoverage } from "@/features/hire/dossier";
import { mergeTrackLoads, type TrackLoad } from "@/features/hire/track-loaders";
import { splitSkills, yearsFor } from "@/features/hire/challenge-dossier";
import { collectRoleTitles } from "@/features/hire/role-match";
import { encodeCandidateRef } from "@/features/hire/candidate-ref";
import { candidatePublicId } from "@/features/hire/public-id";
import type {
  AvailabilitySnapshot,
  CandidateDossier,
  EvidenceCoverage,
  ScoreableMember,
} from "@/features/hire/types";
import {
  expectedTracks,
  gateReasons,
  type CanonicalCandidate,
  type CanonicalPreference,
  type PoolCohort,
  type SearchEnv,
  type TrackSlug,
} from "@/features/search-qa/canonical";
import type { PoolSnapshot } from "@/features/search-qa/compare";

export const GOLDEN_NOW = new Date("2026-09-15T06:30:00.000Z");

export const GOLDEN_ENV: SearchEnv = {
  newTalentRead: true,
  challengePool: { enabled: true, minDays: 10 },
  openCohortIds: ["cohort_open"],
};

export const GOLDEN_COHORTS: ReadonlyMap<string, PoolCohort> = new Map([
  ["cohort_open", { id: "cohort_open", status: "ENROLLING", published: false }],
  ["cohort_closed", { id: "cohort_closed", status: "ARCHIVED", published: false }],
]);

type Evidence = {
  missionsPassed: number;
  cleanPassCount: number;
  commitDays: number;
  projectScores: number[];
  cohortDay: number;
};

export type GoldenFixture = {
  code: string;
  note: string;
  canonical: CanonicalCandidate;
  evidence?: Evidence;
  /** Challenge streak (the challenge track's consistency signal). */
  streak?: number;
  /** Fault injection: what the search document says instead of the truth. */
  fault?: {
    documentSkills?: string[];
    documentAvailability?: AvailabilitySnapshot;
    documentRoleTitles?: string[];
    forceTrack?: TrackSlug;
    dropFromPool?: boolean;
  };
};

type Opts = {
  name?: string;
  headline?: string | null;
  role?: string;
  emailDomain?: string;
  deleted?: boolean;
  disabled?: boolean;
  visibility?: "searchable" | "hidden" | "withdrawn" | "none";
  skills?: (string | { name: string; claimed?: boolean; active?: boolean })[];
  grad?: number | null;
  extraEducation?: { graduationYear: number | null }[];
  expMonths?: number;
  expRows?: { startedOn: string; endedOn: string | null; totalMonths: number; title?: string }[];
  pref?: Partial<CanonicalPreference> | null;
  program?: { cohortId: string; status?: string };
  challenge?: { domain: string; submissions: number }[];
  hackathon?: boolean;
  github?: string | null;
  linkedin?: string | null;
  evidence?: Evidence;
  streak?: number;
  fault?: GoldenFixture["fault"];
  legacyProgramSkills?: string[];
};

const pad = (n: number) => String(n).padStart(3, "0");

export function qaUserId(n: number): string {
  return `qa${pad(n)}`;
}

function fixture(n: number, note: string, o: Opts): GoldenFixture {
  const userId = qaUserId(n);
  const vis = o.visibility ?? "searchable";
  const skills = (o.skills ?? []).map((s, i) => {
    const v = typeof s === "string" ? { name: s } : s;
    return {
      skillId: `sk_${squashId(v.name)}`,
      name: v.name,
      isActive: v.active ?? true,
      claimed: v.claimed ?? true,
      verified: false,
      evidenceScore: 100 - i,
      evidenceCount: v.claimed === false ? 1 : 0,
    };
  });
  const education = [
    ...(o.grad === undefined
      ? []
      : [{
          institutionName: "QA Institute of Technology",
          collegeId: "college_qa",
          degree: "B.E / B.Tech",
          fieldOfStudy: "Computer Science",
          startYear: o.grad ? o.grad - 4 : null,
          graduationYear: o.grad,
          isCurrent: false,
        }]),
    ...(o.extraEducation ?? []).map((e) => ({
      institutionName: "QA Junior College",
      collegeId: null,
      degree: "Higher Secondary (12th)",
      fieldOfStudy: null,
      startYear: null,
      graduationYear: e.graduationYear,
      isCurrent: false,
    })),
  ];
  const experience = o.expRows
    ? o.expRows.map((r) => ({
        companyName: "QA Corp",
        title: r.title ?? "Engineer",
        totalMonths: r.totalMonths,
        startedOn: new Date(r.startedOn),
        endedOn: r.endedOn ? new Date(r.endedOn) : null,
        isCurrent: r.endedOn == null,
      }))
    : o.expMonths
      ? [{
          companyName: "QA Corp",
          title: "Engineer",
          totalMonths: o.expMonths,
          startedOn: new Date(GOLDEN_NOW.getTime() - o.expMonths * 30.44 * 86_400_000),
          endedOn: null,
          isCurrent: true,
        }]
      : [];
  const preference: CanonicalPreference | null =
    o.pref === null
      ? null
      : {
          openToWork: true,
          noticePeriodDays: null,
          preferredLocations: [],
          opportunityTypes: [],
          willingToRelocate: false,
          remotePreference: null,
          expectedSalaryMin: null,
          expectedSalaryMax: null,
          preferredRoles: [],
          ...(o.pref ?? {}),
        };
  return {
    code: `QA${pad(n)}`,
    note,
    evidence: o.evidence,
    streak: o.streak,
    fault: o.fault,
    canonical: {
      userId,
      role: o.role ?? "STUDENT",
      emailDomain: o.emailDomain ?? "qa.abtalks.test",
      emailValid: true,
      createdAt: new Date(GOLDEN_NOW.getTime() - n * 86_400_000),
      deleted: o.deleted ?? false,
      disabled: o.disabled ?? false,
      anonymized: false,
      visibility:
        vis === "none"
          ? null
          : { searchable: vis !== "hidden", withdrawn: vis === "withdrawn" },
      profile: {
        fullName: o.name ?? `QA Candidate ${pad(n)}`,
        headline: o.headline ?? null,
        locationCity: null,
        linkedinUrl: o.linkedin ?? null,
        githubUsername: o.github ?? null,
        portfolioUrl: null,
        hasResume: false,
      },
      skills,
      education,
      experience,
      projects: [],
      links: [],
      preference,
      legacy: {
        studentProfileSkills: null,
        studentProfileGradYear: null,
        programMemberSkills: o.legacyProgramSkills ?? null,
      },
      memberships: {
        program: o.program
          ? [{ memberId: `pm_${userId}`, cohortId: o.program.cohortId, status: o.program.status ?? "ENROLLED" }]
          : [],
        challenge: o.challenge ?? [],
        hackathonWithSubmission: o.hackathon ?? false,
      },
    },
  };
}

function squashId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

const STRONG_COHORT: Evidence = {
  missionsPassed: 22,
  cleanPassCount: 18,
  commitDays: 20,
  projectScores: [80, 85, 90],
  cohortDay: 31,
};

/* ── the dataset ─────────────────────────────────────────────────────────── */

export const GOLDEN_FIXTURES: readonly GoldenFixture[] = [
  fixture(1, "React/JS/Node, 2026 grad, Ghaziabad, fresher, GitHub, hackathon, AI cohort", {
    skills: ["React", "JavaScript", "Node.js"], grad: 2026, github: "qa-one",
    pref: { preferredLocations: ["Ghaziabad"], remotePreference: "Remote", opportunityTypes: ["INTERNSHIP", "FULL_TIME"] },
    program: { cohortId: "cohort_open" }, hackathon: true,
    evidence: { missionsPassed: 8, cleanPassCount: 6, commitDays: 9, projectScores: [], cohortDay: 31 },
  }),
  fixture(2, "Python/ML, 2025 grad, Bangalore, 2 years, GitHub", {
    skills: ["Python", "Machine Learning"], grad: 2025, expMonths: 24, github: "qa-two",
    pref: { preferredLocations: ["Bangalore"], remotePreference: "Hybrid", opportunityTypes: ["FULL_TIME"] },
  }),
  fixture(3, "Python/SQL Claude challenge 30 days, prefers Bengaluru", {
    skills: ["Python", "SQL"], grad: 2024, challenge: [{ domain: "CLAUDE", submissions: 30 }], streak: 12,
    pref: { preferredLocations: ["Bengaluru"] },
  }),
  fixture(4, "React Native only", { skills: ["React Native"] }),
  fixture(5, "Go (catalog alias golang)", { skills: ["Go"] }),
  fixture(6, "C++", { skills: ["C++"] }),
  fixture(7, "C#", { skills: ["C#"] }),
  fixture(8, "Node.js", { skills: ["Node.js"] }),
  fixture(9, "Next.js", { skills: ["Next.js"] }),
  fixture(10, "UI/UX (slash skill)", { skills: ["UI/UX"] }),
  fixture(11, "React — DELETED", { skills: ["React"], deleted: true }),
  fixture(12, "React — DISABLED", { skills: ["React"], disabled: true }),
  fixture(13, "React — visibility WITHDRAWN", { skills: ["React"], visibility: "withdrawn" }),
  fixture(14, "React — searchableByRecruiters false", { skills: ["React"], visibility: "hidden" }),
  fixture(15, "React — no CandidateVisibility row", { skills: ["React"], visibility: "none" }),
  fixture(16, "React — RECRUITER role marked searchable", { skills: ["React"], role: "RECRUITER" }),
  fixture(18, "only a withdrawn React claim (evidence kept), hackathon", {
    skills: [{ name: "React", claimed: false }], hackathon: true,
  }),
  fixture(19, "React, not open to work", { skills: ["React"], pref: { openToWork: false } }),
  fixture(20, "React, no preference row", { skills: ["React"], pref: null }),
  fixture(21, "React, opportunity types unstated", { skills: ["React"], pref: { opportunityTypes: [] } }),
  fixture(22, "React, internship only", { skills: ["React"], pref: { opportunityTypes: ["INTERNSHIP"] } }),
  fixture(23, "React, freelance only", { skills: ["React"], pref: { opportunityTypes: ["FREELANCE"] } }),
  fixture(24, "React, Flexible work mode", { skills: ["React"], pref: { remotePreference: "Flexible" } }),
  fixture(25, "React, On-site", { skills: ["React"], pref: { remotePreference: "On-site" } }),
  fixture(26, "React, work mode unstated", { skills: ["React"], pref: { remotePreference: null } }),
  fixture(27, "React, Delhi NCR", { skills: ["React"], pref: { preferredLocations: ["Delhi NCR"] } }),
  fixture(28, "React, Noida", { skills: ["React"], pref: { preferredLocations: ["Noida"] } }),
  fixture(29, "React, banglore (typo)", { skills: ["React"], pref: { preferredLocations: ["banglore"] } }),
  fixture(30, "React, Pune but willing to relocate", { skills: ["React"], pref: { preferredLocations: ["Pune"], willingToRelocate: true } }),
  fixture(31, "React, Remote (India) as a city", { skills: ["React"], pref: { preferredLocations: ["Remote (India)"] } }),
  fixture(32, "React, expects ₹6L minimum", { skills: ["React"], pref: { expectedSalaryMin: 600_000, expectedSalaryMax: 900_000 } }),
  fixture(33, "React, 90-day notice", { skills: ["React"], pref: { noticePeriodDays: 90 } }),
  fixture(34, "React, notice unstated", { skills: ["React"], pref: { noticePeriodDays: null } }),
  fixture(35, "B — AI cohort graduate: React, 22 missions, 3 graded projects", {
    skills: ["React", "TypeScript"], grad: 2023, expMonths: 36, program: { cohortId: "cohort_open", status: "COMPLETED" },
    evidence: STRONG_COHORT,
  }),
  fixture(36, "React, member of a CLOSED cohort (profile track only)", {
    skills: ["React"], program: { cohortId: "cohort_closed" },
  }),
  fixture(37, "React, SE challenge 9 days (below the 10-day floor)", {
    skills: ["React"], challenge: [{ domain: "SE", submissions: 9 }], streak: 5,
  }),
  fixture(38, "React, SE challenge exactly 10 days", {
    skills: ["React"], grad: 2022, challenge: [{ domain: "SE", submissions: 10 }], streak: 3,
  }),
  fixture(39, "Python, Claude challenge 60 days", {
    skills: ["Python"], challenge: [{ domain: "CLAUDE", submissions: 60 }], streak: 60,
  }),
  fixture(40, "A — lists React, no evidence, thin profile", { skills: ["React"] }),
  fixture(41, "React, test-domain account", { skills: ["React"], emailDomain: "abtalks.dev" }),
  fixture(42, "React, placeholder name", { skills: ["React"], name: "test" }),
  fixture(43, "Python, graduation year 1901", { skills: ["Python"], grad: 1901 }),
  fixture(44, "Java, experience ends before it starts", {
    skills: ["Java"], expRows: [{ startedOn: "2025-06-01", endedOn: "2024-01-01", totalMonths: -17 }],
  }),
  fixture(45, "Java, URL stored as GitHub username", { skills: ["Java"], github: "https://github.com/qa45" }),
  fixture(46, "Python, same GitHub as QA002", { skills: ["Python"], github: "qa-two" }),
  fixture(47, "React + TypeScript", { skills: ["React", "TypeScript"] }),
  fixture(48, "JavaScript only", { skills: ["JavaScript"] }),
  fixture(49, "reactjs spelling", { skills: ["reactjs"] }),
  fixture(50, "Java only — must not match JavaScript", { skills: ["Java"] }),
  fixture(51, "Kubernetes (alias k8s)", { skills: ["Kubernetes"] }),
  fixture(52, "C only — must not match React", { skills: ["C"] }),
  fixture(58, "React claimed twice under two spellings (React, reactjs)", { skills: ["React", "reactjs"] }),
  fixture(59, "a pasted skill list stored as one skill", { skills: ["python c++ html css js react"] }),
  fixture(60, "cohort member with no claimed skills; application listed Python", {
    program: { cohortId: "cohort_open" }, legacyProgramSkills: ["Python"],
    evidence: { missionsPassed: 4, cleanPassCount: 3, commitDays: 4, projectScores: [], cohortDay: 31 },
  }),
  fixture(61, "Claude challenge, 5 submissions (below the floor), profile with no claimed skills", {
    challenge: [{ domain: "CLAUDE", submissions: 5 }], streak: 2,
  }),
  fixture(62, "AI/ML claimed as one skill", { skills: ["AI/ML"] }),
  fixture(63, "C/C++ claimed as one skill", { skills: ["C/C++"] }),
  fixture(64, "Data Structures & Algorithms (catalog name)", { skills: ["Data Structures & Algorithms"] }),
  fixture(65, "Git & GitHub claimed as one skill", { skills: ["Git & GitHub"] }),
  fixture(66, "a paste with a long part: Python Data Structures & Algorithms (DSA) SQL Git", {
    skills: ["Python Data Structures & Algorithms (DSA) SQL Git"],
  }),
  // Role (spec.title) — ranked, never filtered. Skills chosen so no skill
  // search elsewhere in this dataset changes.
  fixture(67, "role: headline Frontend Developer; Vue.js, Tailwind CSS", {
    headline: "Frontend Developer",
    skills: ["Vue.js", "Tailwind CSS"],
  }),
  fixture(68, "role: target role Data Analyst only; Power BI", {
    pref: { preferredRoles: ["Data Analyst"] },
    skills: ["Power BI"],
  }),
  fixture(69, "role: work history Machine Learning Engineer only; PyTorch", {
    expRows: [{ startedOn: "2024-06-01", endedOn: null, totalMonths: 27, title: "Machine Learning Engineer" }],
    skills: ["PyTorch"],
  }),
  fixture(70, "role: no titles; Angular, Sass (frontend by skills alone)", {
    skills: ["Angular", "Sass"],
  }),
  fixture(71, "role: headline Student; Tableau (no frontend connection)", {
    headline: "Student",
    skills: ["Tableau"],
  }),
  fixture(56, "React, graduation year hidden behind a year-less education row", {
    skills: ["React"], grad: 2024, extraEducation: [{ graduationYear: null }],
  }),
];

/** Fault injections for classifier self-tests. Never part of the regression pool. */
export const FAULT_FIXTURES: readonly GoldenFixture[] = [
  fixture(53, "STALE: canonical Python, document React", {
    skills: ["Python"], fault: { documentSkills: ["React"] },
  }),
  fixture(54, "INVALID: deleted user forced into the pool with React", {
    skills: ["React"], deleted: true, fault: { forceTrack: "PROFILE" },
  }),
  fixture(55, "MISSING: eligible React profile dropped by the loader", {
    skills: ["React"], fault: { dropFromPool: true },
  }),
  fixture(57, "STALE availability: canonical Hybrid, document REMOTE", {
    skills: ["React"], pref: { remotePreference: "Hybrid" },
    fault: {
      documentAvailability: {
        openToWork: true, expectedSalaryMin: null, expectedSalaryMax: null, salaryCurrency: "INR",
        noticePeriodDays: null, preferredWorkMode: "REMOTE", preferredCities: [], openToRelocate: false, opportunityTypes: [],
      },
    },
  }),
];

export function goldenFixture(code: string): GoldenFixture {
  const f = [...GOLDEN_FIXTURES, ...FAULT_FIXTURES].find((x) => x.code === code);
  if (!f) throw new Error(`No golden fixture ${code}`);
  return f;
}

export function goldenUserId(code: string): string {
  return goldenFixture(code).canonical.userId;
}

/* ── document construction, mirroring the track loaders ─────────────────── */

function availabilityOf(p: CanonicalPreference | null): AvailabilitySnapshot {
  if (!p) return null;
  return {
    openToWork: p.openToWork,
    expectedSalaryMin: p.expectedSalaryMin,
    expectedSalaryMax: p.expectedSalaryMax,
    salaryCurrency: "INR",
    noticePeriodDays: p.noticePeriodDays,
    preferredWorkMode: p.remotePreference,
    preferredCities: p.preferredLocations,
    openToRelocate: p.willingToRelocate,
    opportunityTypes: p.opportunityTypes,
  };
}

/** `loadRecruiterIdentities`: every CandidateSkill row by evidence, education `desc` NULLS LAST. */
function identityOf(c: CanonicalCandidate) {
  const months = c.experience.reduce((n, e) => n + (e.totalMonths ?? 0), 0);
  const sortedEdu = [...c.education].sort((a, b) => {
    if (a.graduationYear == null) return b.graduationYear == null ? 0 : 1;
    if (b.graduationYear == null) return -1;
    return b.graduationYear - a.graduationYear;
  });
  return {
    skills: [...c.skills].sort((a, b) => b.evidenceScore - a.evidenceScore).map((s) => s.name),
    yearsExperience: months > 0 ? Math.round(months / 12) : null,
    graduationYear: sortedEdu[0]?.graduationYear ?? null,
    hasGithub: Boolean(c.profile?.githubUsername),
    hasLinkedin: Boolean(c.profile?.linkedinUrl),
  };
}

function dossierFor(
  c: CanonicalCandidate,
  source: TrackSlug,
  skills: string[],
  years: number,
  gradYear: number | null,
  availability: AvailabilitySnapshot,
  ev: { missionsPassed: number; cleanPassCount: number; commitDays: number; projectScores: number[] },
): CandidateDossier {
  const id = source === "PROGRAM" ? `pm_${c.userId}` : c.userId;
  const idn = identityOf(c);
  return {
    publicId: candidatePublicId(id),
    source,
    candidateRef: encodeCandidateRef(source, id),
    programMemberId: source === "PROGRAM" ? id : null,
    userId: c.userId,
    roleFamily: derived("OTHER"),
    rawRoleLabel: derived("Candidate"),
    yearsExperience: declared(years),
    education: declared({ level: null, university: null, gradYear }),
    declaredSkills: declared(skills),
    links: declared({ linkedin: idn.hasLinkedin, github: idn.hasGithub, resume: false }),
    evidence: {
      missionsPassed: verified(ev.missionsPassed),
      missionsAttempted: verified(ev.missionsPassed),
      missionsWaived: verified(0),
      cleanPassCount: verified(ev.cleanPassCount),
      cleanPassPct: derived(0),
      commitDays: verified(ev.commitDays),
      activeDaysSpan: derived(0),
      lastActiveAt: verified(null),
      projectScores: verified(ev.projectScores),
      // RECRUITER_FIELD_POLICY.interviewResults is false on every path.
      interview: verified(null),
      workingLanguages: derived([]),
      missionTypesPassed: verified([]),
      cohortProgress: derived({ day: 0, ofDays: 0 }),
    },
    compensation: { declared: null, estimate: null },
    availability,
  };
}

function memberFor(f: GoldenFixture, slug: TrackSlug, env: SearchEnv): ScoreableMember {
  const c = f.canonical;
  const idn = identityOf(c);
  const availability = f.fault?.documentAvailability ?? availabilityOf(c.preference);
  let skills: string[];
  let years: number;
  let ev = { missionsPassed: 0, cleanPassCount: 0, commitDays: 0, projectScores: [] as number[] };
  let cohortDay = 0;
  let maxEarnable: number | undefined;
  let window: number | undefined;
  switch (slug) {
    case "PROGRAM":
      // listProgramCandidates: identity skills when any, never split.
      skills = idn.skills.length ? idn.skills : (c.legacy?.programMemberSkills ?? []);
      years = idn.yearsExperience ?? 0;
      ev = f.evidence ?? ev;
      cohortDay = f.evidence?.cohortDay ?? 1;
      break;
    case "CLAUDE":
    case "CHALLENGE_60": {
      skills = splitSkills(idn.skills);
      years = yearsFor(idn.yearsExperience, idn.graduationYear, GOLDEN_NOW);
      const domains = slug === "CLAUDE" ? ["CLAUDE"] : ["SE", "DS", "AI"];
      const best = c.memberships.challenge
        .filter((e) => domains.includes(e.domain))
        .sort((a, b) => b.submissions - a.submissions)[0];
      ev = { missionsPassed: best?.submissions ?? 0, cleanPassCount: 0, commitDays: f.streak ?? 0, projectScores: [] };
      cohortDay = 60;
      maxEarnable = 60;
      window = 60;
      break;
    }
    case "HACKATHON":
      skills = splitSkills(idn.skills);
      years = idn.yearsExperience ?? 0;
      ev = { missionsPassed: 1, cleanPassCount: 0, commitDays: 1, projectScores: [] };
      cohortDay = 1;
      maxEarnable = 1;
      window = 1;
      break;
    case "PROFILE":
      skills = splitSkills(idn.skills);
      years = idn.yearsExperience ?? 0;
      maxEarnable = 0;
      window = 0;
      break;
  }
  if (f.fault?.documentSkills) skills = f.fault.documentSkills;
  void env;
  // attachRoleTitles: headline, target roles, then work history current-first.
  const roleTitles = f.fault?.documentRoleTitles ?? collectRoleTitles({
    headline: c.profile?.headline,
    preferredRoles: c.preference?.preferredRoles,
    experienceTitles: [...c.experience]
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.startedOn.getTime() - a.startedOn.getTime())
      .map((e) => e.title),
  });
  const dossier = dossierFor(c, slug, skills, years, idn.graduationYear, availability, ev);
  return {
    id: slug === "PROGRAM" ? `pm_${c.userId}` : c.userId,
    source: slug,
    candidateRef: dossier.candidateRef,
    userId: c.userId,
    fullName: c.profile?.fullName ?? "",
    jobRole: "",
    company: "",
    roleTitles,
    yearsExperience: years,
    skills,
    missionPoints: 0,
    missionsPassed: ev.missionsPassed,
    missionsAttempted: ev.missionsPassed,
    cleanPassCount: ev.cleanPassCount,
    totalScore: 0,
    commitDayCount: ev.commitDays,
    projectScores: ev.projectScores,
    interview: null,
    hasVisibilityConsent: true,
    cohortPublished: true,
    status: "ENROLLED",
    availability,
    cohortDay,
    maxEarnableMissions: maxEarnable,
    consistencyWindow: window,
    dossier,
  };
}

/**
 * The pool the service would load for these tracks. Membership uses the
 * loaders' implemented rules (gate + track rule) — the same rules the oracle
 * documents, so any divergence in a regression run is a document or filter
 * difference, which is the thing under test. Faults override it.
 */
export function buildGoldenPool(
  fixtures: readonly GoldenFixture[],
  opts: { tracks?: string[]; minEvidenceDays?: number; caps?: Partial<Record<TrackSlug, number>> } = {},
  env: SearchEnv = GOLDEN_ENV,
): PoolSnapshot {
  const slugs: TrackSlug[] = (["PROGRAM", "CLAUDE", "CHALLENGE_60", "HACKATHON", "PROFILE"] as const).filter(
    (s) => !opts.tracks?.length || opts.tracks.includes(s),
  );
  const loads: TrackLoad[] = [];
  const infos: PoolSnapshot["loads"] = [];
  for (const slug of slugs) {
    let rows = fixtures.filter((f) => {
      if (f.fault?.dropFromPool) return false;
      if (f.fault?.forceTrack) return f.fault.forceTrack === slug;
      if (gateReasons(f.canonical).length > 0) return false;
      return expectedTracks(f.canonical, env, GOLDEN_COHORTS, { minEvidenceDays: opts.minEvidenceDays }).includes(slug);
    });
    const cap = opts.caps?.[slug] ?? null;
    if (cap != null) rows = rows.slice(0, cap);
    const members = rows.map((f) => memberFor(f, slug, env));
    const coverage: EvidenceCoverage = members.length
      ? computeCoverage(members.map((m) => m.dossier!))
      : { dimensions: { stack: false, missions: false, cleanPass: false, projects: false, consistency: false, interview: false, experience: false, role: false }, note: "empty" };
    for (const m of members) m.coverage = coverage;
    loads.push({ slug, members, coverage, belowEvidenceFloor: 0, cohortName: null, stage: null });
    infos.push({ slug, count: members.length, cap, truncated: cap != null && members.length >= cap, userIds: members.map((m) => m.userId) });
  }
  const merged = mergeTrackLoads(loads);
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const m of merged.members) {
    if (seen.has(m.userId)) dup.push(m.userId);
    seen.add(m.userId);
  }
  return {
    key: `${opts.tracks?.join(",") || "*"}|${opts.minEvidenceDays ?? 0}`,
    members: merged.members,
    coverage: merged.coverage,
    loads: infos,
    duplicateUserIds: dup,
  };
}

export function goldenPopulation(includeFaults = false): CanonicalCandidate[] {
  return [...GOLDEN_FIXTURES, ...(includeFaults ? FAULT_FIXTURES : [])].map((f) => f.canonical);
}
