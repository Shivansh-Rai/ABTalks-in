/**
 * Career guidance rules (T-224).
 *
 * Deterministic. Every `because` interpolates a fact on `CandidateFacts`.
 * A rule that cannot name a real fact does not fire. No scores, salary,
 * or market claims.
 */

import {
  GUIDANCE_CAP,
  MAX_JOB_CARDS,
  type CandidateFacts,
  type ChallengeDomain,
  type ChallengeFact,
  type GuidanceItem,
  type MockFact,
  type SkillFact,
} from "./types";

const DOMAIN_LABEL: Record<ChallengeDomain, string> = {
  AI: "Artificial Intelligence",
  DS: "Data Science",
  SE: "Software Engineering",
  CLAUDE: "Claude Challenge",
};

const AI_COHORT_HREF = "/program/ai-cohort/apply";
const DATABRICKS_HREF = "/program/databricks";
const DS_ARCHITECT_HREF = "/program/ds-architect";
const POWERBI_HREF = "/program/powerbi";
const HACKATHON_HREF = "/hackathon";
const AI_FLUENCY_HREF = "/mock-interviews/ai-fluency";
const AGENTIC_CODING_HREF = "/mock-interviews/agentic-coding";

const DATA_SKILL_NEEDLES = [
  "databricks",
  "spark",
  "pandas",
  "numpy",
  "sql",
  "tableau",
  "power bi",
  "powerbi",
  "scikit-learn",
  "scikit learn",
  "statistics",
  "data analysis",
  "data science",
] as const;

const AI_SKILL_NEEDLES = [
  "pytorch",
  "tensorflow",
  "langchain",
  "huggingface",
  "hugging face",
  "machine learning",
  "computer vision",
  "keras",
] as const;

const AI_SKILL_SHORT = ["llm", "nlp"] as const;

const SE_SKILL_NEEDLES = [
  "react",
  "typescript",
  "javascript",
  "kubernetes",
  "next.js",
  "nextjs",
  "golang",
] as const;

const DATA_ROLE_NEEDLES = [
  "data scientist",
  "data engineer",
  "data analyst",
  "analytics",
] as const;

const AI_ROLE_NEEDLES = [
  "machine learning",
  "ml engineer",
  "ai engineer",
  "llm",
] as const;

const SE_ROLE_NEEDLES = [
  "software",
  "backend",
  "frontend",
  "full stack",
  "fullstack",
] as const;

const POWER_BI_SKILL_NEEDLES = ["power bi", "powerbi", "tableau"] as const;

function occupied(status: "ACTIVE" | "COMPLETED" | null): boolean {
  return status !== null;
}

function challengeOf(
  facts: CandidateFacts,
  domain: ChallengeDomain,
): ChallengeFact | undefined {
  return facts.challenges.find((c) => c.domain === domain);
}

function isActiveOrCompleted(row: ChallengeFact | undefined): boolean {
  return row?.status === "ACTIVE" || row?.status === "COMPLETED";
}

function isCompleted(row: ChallengeFact | undefined): boolean {
  return row?.status === "COMPLETED";
}

function isAbandoned(row: ChallengeFact | undefined): boolean {
  return row?.status === "ABANDONED";
}

function challengeBecause(row: ChallengeFact): string {
  if (row.domain === "CLAUDE") {
    return row.status === "COMPLETED"
      ? "You completed the Claude Challenge."
      : "You are on the Claude Challenge.";
  }
  const label = DOMAIN_LABEL[row.domain];
  return row.status === "COMPLETED"
    ? `You completed the ${label} 60-day challenge.`
    : `You are on the ${label} 60-day challenge.`;
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary / exact match against a candidate-owned string. */
function tokenMatch(hay: string, needle: string): boolean {
  const h = squash(hay);
  const n = squash(needle);
  if (!h || !n) return false;
  if (h === n) return true;
  const re = new RegExp(`(?:^| )${escapeRegex(n)}(?: |$)`);
  return re.test(h);
}

function matchingSkillNames(
  skills: SkillFact[],
  needles: readonly string[],
): string[] {
  const hits: string[] = [];
  for (const skill of skills) {
    if (needles.some((needle) => tokenMatch(skill.name, needle))) {
      if (!hits.includes(skill.name)) hits.push(skill.name);
    }
  }
  return hits;
}

function matchingRole(
  roles: string[],
  needles: readonly string[],
): string | null {
  for (const role of roles) {
    const squashed = squash(role);
    if (needles.some((needle) => squashed.includes(squash(needle)))) {
      return role;
    }
  }
  return null;
}

function hasDataAiCategory(skills: SkillFact[]): boolean {
  return skills.some((s) => s.categoryName === "Data & AI");
}

function namedSkillsBecause(names: string[]): string | null {
  if (names.length === 0) return null;
  const shown = names.slice(0, 2);
  if (shown.length === 1) {
    return `You listed ${shown[0]} on your profile.`;
  }
  return `You listed ${shown[0]} and ${shown[1]} on your profile.`;
}

function challengeSignalBecause(
  facts: CandidateFacts,
  skillNeedles: readonly string[],
  roleNeedles: readonly string[],
  includeDataAiCategory: boolean,
): string | null {
  const skillNames = matchingSkillNames(facts.skills, skillNeedles);
  const fromCategory =
    includeDataAiCategory && hasDataAiCategory(facts.skills)
      ? facts.skills
          .filter((s) => s.categoryName === "Data & AI")
          .map((s) => s.name)
      : [];
  const combined = [...skillNames];
  for (const name of fromCategory) {
    if (!combined.includes(name)) combined.push(name);
  }
  const skillsLine = namedSkillsBecause(combined);
  if (skillsLine) return skillsLine;
  const role = matchingRole(facts.preferredRoles, roleNeedles);
  if (role) return `Your preferred role ${role} is on your profile.`;
  return null;
}

function mockAvailable(facts: CandidateFacts, slug: string): MockFact | null {
  const mock = facts.mocks.find((m) => m.slug === slug);
  if (!mock) return null;
  if (mock.attemptsLeft !== null && mock.attemptsLeft <= 0) return null;
  return mock;
}

function overlappingSkillName(
  jobSkills: string[],
  candidateSkills: SkillFact[],
): string | null {
  const byLower = new Map(
    candidateSkills.map((s) => [s.name.trim().toLowerCase(), s.name]),
  );
  for (const raw of jobSkills) {
    const hit = byLower.get(raw.trim().toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/**
 * Same idea as job-alert `roleMatches`: the preferred role, or any of its
 * words of length >= 3, appears in the job title. Copied rather than imported
 * so this engine does not take on alert threshold math.
 */
function roleMatchesTitle(role: string, jobTitle: string): boolean {
  const needle = role.trim().toLowerCase();
  if (!needle) return false;
  const hay = jobTitle.trim().toLowerCase();
  if (!hay) return false;
  if (hay.includes(needle)) return true;
  const words = needle.split(/\s+/).filter((w) => w.length >= 3);
  return words.some((w) => hay.includes(w));
}

function matchingPreferredRole(
  roles: string[],
  jobTitle: string,
): string | null {
  for (const role of roles) {
    if (roleMatchesTitle(role, jobTitle)) return role;
  }
  return null;
}

function pushItem(
  out: GuidanceItem[],
  seen: Set<string>,
  item: GuidanceItem,
): void {
  if (out.length >= GUIDANCE_CAP) return;
  if (seen.has(item.href)) return;
  seen.add(item.href);
  out.push(item);
}

export function evaluateRules(facts: CandidateFacts): GuidanceItem[] {
  const out: GuidanceItem[] = [];
  const seen = new Set<string>();

  const aiChallenge = challengeOf(facts, "AI");
  const dsChallenge = challengeOf(facts, "DS");
  const seChallenge = challengeOf(facts, "SE");
  const claudeChallenge = challengeOf(facts, "CLAUDE");

  // 1. Completed AI cohort → mock (AI Fluency).
  if (facts.aiCohortStatus === "COMPLETED") {
    const mock = mockAvailable(facts, "ai-fluency");
    if (mock) {
      pushItem(out, seen, {
        id: "completed-ai-cohort-mock",
        kind: "mock",
        title: mock.label,
        because: "You completed the 31-day AI Cohort.",
        href: AI_FLUENCY_HREF,
        cta: "Start interview",
      });
    }
  }

  // 2. AI challenge ACTIVE or COMPLETED → AI cohort.
  if (
    facts.flags.program &&
    !occupied(facts.aiCohortStatus) &&
    isActiveOrCompleted(aiChallenge) &&
    aiChallenge
  ) {
    pushItem(out, seen, {
      id: "ai-challenge-to-cohort",
      kind: "cohort",
      title: "31 Days AI Cohort",
      because: challengeBecause(aiChallenge),
      href: AI_COHORT_HREF,
      cta: "Apply",
    });
  }

  // 3. Claude COMPLETED → AI cohort.
  if (
    facts.flags.program &&
    !occupied(facts.aiCohortStatus) &&
    isCompleted(claudeChallenge) &&
    claudeChallenge
  ) {
    pushItem(out, seen, {
      id: "claude-completed-to-cohort",
      kind: "cohort",
      title: "31 Days AI Cohort",
      because: "You completed the Claude Challenge.",
      href: AI_COHORT_HREF,
      cta: "Apply",
    });
  }

  // 4. DS challenge ACTIVE or COMPLETED → Databricks.
  if (
    facts.flags.databricks &&
    !occupied(facts.databricksStatus) &&
    isActiveOrCompleted(dsChallenge) &&
    dsChallenge
  ) {
    pushItem(out, seen, {
      id: "ds-challenge-to-databricks",
      kind: "cohort",
      title: "31 Days Databricks",
      because: challengeBecause(dsChallenge),
      href: DATABRICKS_HREF,
      cta: "Open",
    });
  }

  // 5. Databricks COMPLETED → DS Architect.
  if (
    facts.flags.dsArchitect &&
    !occupied(facts.dsArchitectStatus) &&
    facts.databricksStatus === "COMPLETED"
  ) {
    pushItem(out, seen, {
      id: "databricks-to-ds-architect",
      kind: "cohort",
      title: "10 Days Data Solutions Architect",
      because: "You completed the 31 Days Databricks cohort.",
      href: DS_ARCHITECT_HREF,
      cta: "Open",
    });
  }

  // 6. DS challenge or Databricks, plus Power BI / Tableau skill → Power BI.
  if (
    facts.flags.powerBi &&
    !occupied(facts.powerBiStatus) &&
    (isActiveOrCompleted(dsChallenge) || occupied(facts.databricksStatus))
  ) {
    const powerSkills = matchingSkillNames(
      facts.skills,
      POWER_BI_SKILL_NEEDLES,
    );
    if (powerSkills[0]) {
      pushItem(out, seen, {
        id: "ds-to-powerbi",
        kind: "cohort",
        title: "7 Days Power BI & Analytics",
        because: `You listed ${powerSkills[0]} on your profile.`,
        href: POWERBI_HREF,
        cta: "Open",
      });
    }
  }

  // 7. Hackathon: SE active/completed, else any completed 60-day challenge.
  if (facts.hackathonRegistrationOpen && !facts.hackathonRegistered) {
    const seEligible = isActiveOrCompleted(seChallenge) ? seChallenge : null;
    const completedAny =
      facts.challenges.find((c) => c.status === "COMPLETED") ?? null;
    const source = seEligible ?? completedAny;
    if (source) {
      pushItem(out, seen, {
        id: "challenge-to-hackathon",
        kind: "hackathon",
        title: "ABTalks Vibe Code Hackathon",
        because: challengeBecause(source),
        href: HACKATHON_HREF,
        cta: "Register",
      });
    }
  }

  // 8. Skill / preferred-role → challenge (not joined, not abandoned).
  const challengeSignals: {
    domain: Exclude<ChallengeDomain, "CLAUDE">;
    skillNeedles: readonly string[];
    roleNeedles: readonly string[];
    includeCategory: boolean;
  }[] = [
    {
      domain: "DS",
      skillNeedles: DATA_SKILL_NEEDLES,
      roleNeedles: DATA_ROLE_NEEDLES,
      includeCategory: true,
    },
    {
      domain: "AI",
      skillNeedles: [...AI_SKILL_NEEDLES, ...AI_SKILL_SHORT],
      roleNeedles: AI_ROLE_NEEDLES,
      includeCategory: true,
    },
    {
      domain: "SE",
      skillNeedles: SE_SKILL_NEEDLES,
      roleNeedles: SE_ROLE_NEEDLES,
      includeCategory: false,
    },
  ];

  for (const signal of challengeSignals) {
    const row = challengeOf(facts, signal.domain);
    if (isActiveOrCompleted(row) || isAbandoned(row)) continue;
    const because = challengeSignalBecause(
      facts,
      signal.skillNeedles,
      signal.roleNeedles,
      signal.includeCategory,
    );
    if (!because) continue;
    pushItem(out, seen, {
      id: `skill-to-${signal.domain.toLowerCase()}-challenge`,
      kind: "challenge",
      title: DOMAIN_LABEL[signal.domain],
      because,
      href: `/register?domain=${signal.domain}`,
      cta: "Join",
    });
  }

  // 9. Opportunities — overlapping skill or preferred-role in title. Max 2.
  const applied = new Set(facts.appliedJobIds);
  let jobCards = 0;
  for (const job of facts.jobs) {
    if (jobCards >= MAX_JOB_CARDS) break;
    if (applied.has(job.id)) continue;
    const skillHit = overlappingSkillName(job.skills, facts.skills);
    const roleHit = matchingPreferredRole(facts.preferredRoles, job.title);
    if (!skillHit && !roleHit) continue;
    const because = skillHit
      ? `This listing asks for ${skillHit}, which is on your profile.`
      : `It matches your preferred role ${roleHit}.`;
    const before = out.length;
    pushItem(out, seen, {
      id: `job-${job.id}`,
      kind: "opportunity",
      title: `${job.title} at ${job.company}`,
      because,
      href: `/jobs/${job.id}`,
      cta: "View job",
    });
    if (out.length > before) jobCards += 1;
  }

  // 10. Fallback mock after a completed challenge, if no mock card yet.
  const alreadyMock = out.some((item) => item.kind === "mock");
  if (!alreadyMock) {
    if (isCompleted(aiChallenge) || isCompleted(claudeChallenge)) {
      const mock = mockAvailable(facts, "ai-fluency");
      if (mock) {
        const source = isCompleted(aiChallenge) ? aiChallenge : claudeChallenge;
        pushItem(out, seen, {
          id: "completed-challenge-mock-ai",
          kind: "mock",
          title: mock.label,
          because: source ? challengeBecause(source) : mock.label,
          href: AI_FLUENCY_HREF,
          cta: "Start interview",
        });
      }
    } else if (isCompleted(seChallenge) && seChallenge) {
      const mock = mockAvailable(facts, "agentic-coding");
      if (mock) {
        pushItem(out, seen, {
          id: "completed-challenge-mock-se",
          kind: "mock",
          title: mock.label,
          because: challengeBecause(seChallenge),
          href: AGENTIC_CODING_HREF,
          cta: "Start interview",
        });
      }
    }
  }

  return out;
}
