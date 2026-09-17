/**
 * Recruiter-search bugs that are confirmed, reported, and not yet fixed.
 *
 * A strict "expected failure" list. A golden test tied to an issue here runs
 * every time; when it fails it is reported as XFAIL (known, still NOT READY);
 * when it unexpectedly PASSES the suite fails with "known issue fixed — remove
 * it from known-issues.ts". So a fix cannot land silently, and a pinned issue
 * can never quietly become a permanent excuse.
 *
 * Removing an entry is the last step of fixing the bug, never the first.
 *
 * PURE.
 */
import type { QaCategory, Severity } from "@/features/search-qa/types";

export type KnownIssue = {
  id: string;
  category: QaCategory;
  severity: Severity;
  title: string;
  /** Where the defect lives, as `path:line` at the time it was pinned. */
  location: string;
  evidence: string;
  proposedFix: string;
};

/**
 * Fixed on 2026-09-16 and therefore removed from this registry (their tests are
 * now ordinary assertions): QA-KI-001 work-mode label/enum, QA-KI-002 zero-budget
 * sentinel, QA-KI-003 "Any" city sentinel, QA-KI-005 NULLS-FIRST education pick.
 */
export const KNOWN_ISSUES = {
  "QA-KI-004": {
    id: "QA-KI-004",
    category: "SEARCH_INDEX_STALE",
    severity: "ERROR",
    title: "splitSkills breaks canonical skill names containing / or &",
    location: "src/features/hire/challenge-dossier.ts:105",
    evidence:
      "splitSkills was written for pasted legacy StudentProfile strings and is also applied to CandidateSkill names on the 078 read path. \"AI/ML\", \"UI/UX\", \"CI/CD\" become [\"AI\",\"ML\"] etc., and the two-letter pieces cannot match by containment, so a candidate who claimed \"UI/UX\" is not found by a \"UI/UX\" requirement.",
    proposedFix: "Only split legacy free-text skills; keep catalog CandidateSkill names whole.",
  },
  "QA-KI-006": {
    id: "QA-KI-006",
    category: "PAGINATION_ERROR",
    severity: "ERROR",
    title: "Rank window of 100 is cut before the must-have gate",
    location: "src/features/hire/search-candidates.ts:109",
    evidence:
      "rankCandidates(limit: 100) ranks everyone — including hard-filtered and non-matching candidates — and pickSearchMatches applies must-have skills to that window only. When 100+ non-matching candidates outscore the matching ones, matching candidates are dropped and the recruiter sees fewer results than exist.",
    proposedFix: "Apply hard filters and the must-have gate before truncating to the rank window.",
  },
  "QA-KI-007": {
    id: "QA-KI-007",
    category: "PERMISSION_ERROR",
    severity: "ERROR",
    title: "Saved PROFILE matches are rendered as CLAUDE refs",
    location: "src/features/hire/load-request-matches.ts:200",
    evidence:
      "loadRequestMatches maps any source outside PROGRAM/CLAUDE/CHALLENGE_60/HACKATHON to \"CLAUDE\", so a saved PROFILE match gets candidateRef CLAUDE:<userId>; resolveEligibleCandidates then re-tests it against Claude enrolment and drops it, so it cannot be shortlisted or introduced from the saved list.",
    proposedFix: "Pass PROFILE (any registry-known source) through unchanged.",
  },
  "QA-KI-008": {
    id: "QA-KI-008",
    category: "RANKING_ERROR",
    severity: "ERROR",
    title: "Declared-skill-only candidates outrank evidence-backed candidates",
    location: "src/features/hire/score-candidate.ts:115",
    evidence:
      "Per-member coverage drops every evidence dimension for PROFILE candidates and reweights stack to ~83%, so a profile that merely lists React scores ~85 while a cohort member with passed missions, projects and interview who also lists React scores lower. Sorting is by score, not tier, so the unproven PARTIAL candidate is listed above the proven STRONG one.",
    proposedFix: "Rank by tier before score, or cap evidence-free scores below the evidence-backed band. Needs a ranking product decision.",
  },
  "QA-KI-009": {
    id: "QA-KI-009",
    category: "NORMALIZATION_ERROR",
    severity: "WARNING",
    title: "Skill and city matching ignore the catalog's own aliases",
    location: "src/features/hire/score-candidate.ts:89",
    evidence:
      "stackTokensMatch compares literal names: \"golang\" does not find Go, \"reactjs\" does not find React.js, \"k8s\" does not find Kubernetes, although skill-catalog.ts lists those aliases. Location matching likewise misses Bangalore ↔ Bengaluru (Scout itself rewrites \"bangalore\" to \"Bengaluru\") and Gurgaon ↔ Gurugram.",
    proposedFix: "Fold both sides through canonicalSkillName / a city alias map before matching.",
  },
  "QA-KI-010": {
    id: "QA-KI-010",
    category: "SEARCH_FILTER_ERROR",
    severity: "WARNING",
    title: "Scout's stack parser misses C++ / C# from free text",
    location: "src/features/hire/pool-brief.ts:214",
    evidence:
      "extractRoleStack builds /\\bc\\+\\+\\b/; \\b after \"+\" needs a following word character, so \"need a c++ developer\" extracts no stack.",
    proposedFix: "Use lookarounds (?<![a-z0-9]) / (?![a-z0-9]) instead of \\b for symbol-bearing tokens.",
  },
  "QA-KI-011": {
    id: "QA-KI-011",
    category: "VISIBILITY_ERROR",
    severity: "WARNING",
    title: "Admin \"Recruiter search\" panel reports tracks the loaders do not load",
    location: "src/features/admin/candidate-discoverability.ts:156",
    evidence:
      "evaluateDiscoverability counts any challenge enrolment with one submission and any ProgramMember row as a carrying track. The loaders also require HIRE_CHALLENGE_POOL with its 10-submission floor, and an ENROLLED/COMPLETED member of a published or open cohort. Read-only production check 2026-09-17 (production flags): the panel says 1 candidate appears whom no loader returns, and names a non-carrying track for 19 (18 still reach recruiters through the profile pool). Recruiters are not exposed; admins are misinformed.",
    proposedFix:
      "Derive track membership from the loaders' real rules — challenge floor and flag, member status and cohort openness — e.g. via features/search-qa canonical expectedTracks with currentSearchEnv(). Owner: T-265 (Shivansh).",
  },
} as const satisfies Record<string, KnownIssue>;

export type KnownIssueId = keyof typeof KNOWN_ISSUES;

export function knownIssue(id: KnownIssueId): KnownIssue {
  return KNOWN_ISSUES[id];
}
