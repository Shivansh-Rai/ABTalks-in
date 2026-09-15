import { z } from "zod";
import raw from "./progression.json";
import { canonicalSkillName } from "@/lib/skill-catalog";
import {
  GUIDANCE_COMPLETED_DAYS,
  GUIDANCE_POOL_CAP,
  type AiCohortStatus,
  type CandidateFacts,
  type ChallengeDomain,
  type ChallengeFact,
  type GuidanceFlags,
  type GuidanceItem,
  type GuidanceKind,
  type SkillFact,
} from "./types";

const challengeDomainSchema = z.enum(["AI", "DS", "SE", "CLAUDE"]);

const edgeWhenSchema = z
  .object({
    flag: z
      .enum(["program", "databricks", "dsArchitect", "powerBi", "claude"])
      .optional(),
    aiCohortStatus: z
      .enum(["none", "APPLIED", "ACTIVE", "COMPLETED"])
      .optional(),
    challenge: z
      .object({
        domain: challengeDomainSchema,
        status: z.enum([
          "active_or_guidance_completed",
          "guidance_completed",
          "not_joined",
        ]),
      })
      .optional(),
    claudeCompletedOrCredential: z.boolean().optional(),
    databricksStatus: z.enum(["none", "COMPLETED", "occupied"]).optional(),
    dsArchitectStatus: z.enum(["none", "occupied"]).optional(),
    powerBiStatus: z.enum(["none", "occupied"]).optional(),
    dsOrDatabricks: z.boolean().optional(),
    skillNeedles: z.array(z.string()).optional(),
    roleNeedles: z.array(z.string()).optional(),
    includeDataAiCategory: z.boolean().optional(),
    hackathonOpen: z.boolean().optional(),
    notHackathonRegistered: z.boolean().optional(),
    seOrAnyGuidanceCompleted: z.boolean().optional(),
    mockSlug: z.string().optional(),
    noMockYet: z.boolean().optional(),
    aiOrClaudeGuidanceCompleted: z.boolean().optional(),
  })
  .strict();

const edgeThenSchema = z.object({
  kind: z.enum(["cohort", "hackathon", "challenge", "mock"]),
  title: z.string(),
  href: z.string(),
  cta: z.string(),
  becauseKey: z.enum([
    "ai_cohort_completed",
    "ai_cohort_applied",
    "challenge_fact",
    "claude_completed",
    "databricks_completed",
    "skill_listed",
    "skill_or_role",
    "hackathon_source",
    "ai_or_claude_completed",
  ]),
  becauseDomain: challengeDomainSchema.optional(),
  skillNeedles: z.array(z.string()).optional(),
  roleNeedles: z.array(z.string()).optional(),
  includeDataAiCategory: z.boolean().optional(),
});

const edgeSchema = z.object({
  id: z.string(),
  family: z.string(),
  when: edgeWhenSchema,
  then: edgeThenSchema,
});

const progressionSchema = z.object({
  version: z.literal(1),
  edges: z.array(edgeSchema),
});

export type ProgressionEdge = z.infer<typeof edgeSchema>;

export const PROGRESSION_EDGES: ProgressionEdge[] =
  progressionSchema.parse(raw).edges;

const DOMAIN_LABEL: Record<ChallengeDomain, string> = {
  AI: "Artificial Intelligence",
  DS: "Data Science",
  SE: "Software Engineering",
  CLAUDE: "Claude Challenge",
};

export function isGuidanceCompleted(row: ChallengeFact | undefined): boolean {
  if (!row) return false;
  if (row.status === "COMPLETED") return true;
  if (row.domain === "CLAUDE") return false;
  return row.daysCompleted >= GUIDANCE_COMPLETED_DAYS;
}

export function isActiveOrGuidanceCompleted(
  row: ChallengeFact | undefined,
): boolean {
  return row?.status === "ACTIVE" || isGuidanceCompleted(row);
}

function challengeOf(
  facts: CandidateFacts,
  domain: ChallengeDomain,
): ChallengeFact | undefined {
  return facts.challenges.find((c) => c.domain === domain);
}

function occupied(status: string | null): boolean {
  return status !== null;
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenMatch(hay: string, needle: string): boolean {
  const h = squash(hay);
  const n = squash(needle);
  if (!h || !n) return false;
  if (h === n) return true;
  const re = new RegExp(`(?:^| )${escapeRegex(n)}(?: |$)`);
  return re.test(h);
}

/** Match skill names using catalog aliases (react.js → React). */
export function matchingSkillNames(
  skills: SkillFact[],
  needles: readonly string[],
): string[] {
  const hits: string[] = [];
  for (const skill of skills) {
    const canon = canonicalSkillName(skill.name) || skill.name;
    const matched = needles.some((needle) => {
      const needleCanon = canonicalSkillName(needle) || needle;
      return (
        tokenMatch(skill.name, needle) ||
        tokenMatch(canon, needle) ||
        tokenMatch(canon, needleCanon) ||
        squash(canon) === squash(needleCanon)
      );
    });
    if (matched && !hits.includes(skill.name)) hits.push(skill.name);
  }
  return hits;
}

export function matchingRole(
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
  if (shown.length === 1) return `You listed ${shown[0]} on your profile.`;
  return `You listed ${shown[0]} and ${shown[1]} on your profile.`;
}

export function challengeBecause(row: ChallengeFact): string {
  if (row.domain === "CLAUDE") {
    return isGuidanceCompleted(row) || row.status === "COMPLETED"
      ? "You completed the Claude Challenge."
      : "You are on the Claude Challenge.";
  }
  const label = DOMAIN_LABEL[row.domain];
  if (isGuidanceCompleted(row)) {
    return `You completed the ${label} 60-day challenge.`;
  }
  return `You are on the ${label} 60-day challenge.`;
}

function skillOrRoleBecause(
  facts: CandidateFacts,
  skillNeedles: readonly string[] | undefined,
  roleNeedles: readonly string[] | undefined,
  includeDataAiCategory: boolean | undefined,
): string | null {
  const needles = skillNeedles ?? [];
  const skillNames = matchingSkillNames(facts.skills, needles);
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
  const role = matchingRole(facts.preferredRoles, roleNeedles ?? []);
  if (role) return `Your preferred role ${role} is on your profile.`;
  return null;
}

function aiCohortMatches(
  actual: AiCohortStatus,
  expected: "none" | "APPLIED" | "ACTIVE" | "COMPLETED",
): boolean {
  if (expected === "none") return actual === null;
  return actual === expected;
}

/** True when the domain has no ACTIVE/COMPLETED enrollment (abandoned blocks re-join). */
function isJoinable(row: ChallengeFact | undefined): boolean {
  if (!row) return true;
  if (row.status === "ABANDONED") return false;
  if (row.status === "ACTIVE" || row.status === "COMPLETED") return false;
  if (isGuidanceCompleted(row)) return false;
  return true;
}

function challengeStatusMatches(
  row: ChallengeFact | undefined,
  status:
    | "active_or_guidance_completed"
    | "guidance_completed"
    | "not_joined",
): boolean {
  if (status === "not_joined") return isJoinable(row);
  if (status === "guidance_completed") return isGuidanceCompleted(row);
  return isActiveOrGuidanceCompleted(row);
}

function edgeWhenMatches(
  when: ProgressionEdge["when"],
  facts: CandidateFacts,
  alreadyHasMock: boolean,
): boolean {
  if (when.flag && !facts.flags[when.flag as keyof GuidanceFlags]) return false;

  if (when.aiCohortStatus !== undefined) {
    if (!aiCohortMatches(facts.aiCohortStatus, when.aiCohortStatus)) {
      return false;
    }
  }

  if (when.challenge) {
    const row = challengeOf(facts, when.challenge.domain);
    if (!challengeStatusMatches(row, when.challenge.status)) return false;
  }

  if (when.claudeCompletedOrCredential) {
    const claude = challengeOf(facts, "CLAUDE");
    const ok =
      facts.hasClaudeCredential ||
      claude?.status === "COMPLETED" ||
      isGuidanceCompleted(claude);
    if (!ok) return false;
  }

  if (when.databricksStatus === "none" && occupied(facts.databricksStatus)) {
    return false;
  }
  if (
    when.databricksStatus === "COMPLETED" &&
    facts.databricksStatus !== "COMPLETED"
  ) {
    return false;
  }
  if (when.databricksStatus === "occupied" && !occupied(facts.databricksStatus)) {
    return false;
  }

  if (when.dsArchitectStatus === "none" && occupied(facts.dsArchitectStatus)) {
    return false;
  }
  if (when.powerBiStatus === "none" && occupied(facts.powerBiStatus)) {
    return false;
  }

  if (when.dsOrDatabricks) {
    const ds = challengeOf(facts, "DS");
    if (!isActiveOrGuidanceCompleted(ds) && !occupied(facts.databricksStatus)) {
      return false;
    }
  }

  if (when.skillNeedles && when.skillNeedles.length > 0) {
    // For skill-only gates (powerbi), require a skill hit.
    // For skill_or_role edges, also accept role — handled in because build;
    // for when matching on skill-to-challenge, we need skill OR role OR category.
    if (when.roleNeedles || when.includeDataAiCategory) {
      const skills = matchingSkillNames(facts.skills, when.skillNeedles);
      const role = matchingRole(facts.preferredRoles, when.roleNeedles ?? []);
      const cat =
        when.includeDataAiCategory && hasDataAiCategory(facts.skills);
      if (skills.length === 0 && !role && !cat) return false;
    } else {
      if (matchingSkillNames(facts.skills, when.skillNeedles).length === 0) {
        return false;
      }
    }
  }

  if (when.hackathonOpen === true && !facts.hackathonRegistrationOpen) {
    return false;
  }
  if (when.notHackathonRegistered === true && facts.hackathonRegistered) {
    return false;
  }

  if (when.seOrAnyGuidanceCompleted) {
    const se = challengeOf(facts, "SE");
    const any =
      facts.challenges.find((c) => isGuidanceCompleted(c)) ?? null;
    if (!isActiveOrGuidanceCompleted(se) && !any) return false;
  }

  if (when.mockSlug) {
    const mock = facts.mocks.find((m) => m.slug === when.mockSlug);
    if (!mock) return false;
    if (mock.attemptsLeft !== null && mock.attemptsLeft <= 0) return false;
  }

  if (when.noMockYet && alreadyHasMock) return false;

  if (when.aiOrClaudeGuidanceCompleted) {
    const ai = challengeOf(facts, "AI");
    const claude = challengeOf(facts, "CLAUDE");
    const ok =
      isGuidanceCompleted(ai) ||
      claude?.status === "COMPLETED" ||
      facts.hasClaudeCredential;
    if (!ok) return false;
  }

  return true;
}

function buildBecause(
  edge: ProgressionEdge,
  facts: CandidateFacts,
): string | null {
  const { then: t } = edge;
  switch (t.becauseKey) {
    case "ai_cohort_completed":
      return "You completed the 31-day AI Cohort.";
    case "ai_cohort_applied":
      return "You applied to the 31-day AI Cohort.";
    case "claude_completed":
      return "You completed the Claude Challenge.";
    case "databricks_completed":
      return "You completed the 31 Days Databricks cohort.";
    case "challenge_fact": {
      const domain = t.becauseDomain ?? "AI";
      const row = challengeOf(facts, domain);
      if (!row) return null;
      return challengeBecause(row);
    }
    case "skill_listed": {
      const hits = matchingSkillNames(facts.skills, t.skillNeedles ?? []);
      if (!hits[0]) return null;
      return `You listed ${hits[0]} on your profile.`;
    }
    case "skill_or_role":
      return skillOrRoleBecause(
        facts,
        t.skillNeedles,
        t.roleNeedles,
        t.includeDataAiCategory,
      );
    case "hackathon_source": {
      const se = challengeOf(facts, "SE");
      const source =
        isActiveOrGuidanceCompleted(se)
          ? se
          : facts.challenges.find((c) => isGuidanceCompleted(c));
      if (!source) return null;
      return challengeBecause(source);
    }
    case "ai_or_claude_completed": {
      const ai = challengeOf(facts, "AI");
      if (isGuidanceCompleted(ai) && ai) return challengeBecause(ai);
      return "You completed the Claude Challenge.";
    }
    default:
      return null;
  }
}

function mockTitle(facts: CandidateFacts, slug: string, fallback: string): string {
  return facts.mocks.find((m) => m.slug === slug)?.label ?? fallback;
}

/**
 * Soft-dedupe against hub Continue journey / Prep Kit / exhausted mocks.
 */
export function softDedupeProfileItems(
  items: GuidanceItem[],
  facts: CandidateFacts,
): GuidanceItem[] {
  const activeDomains = new Set(
    facts.challenges
      .filter((c) => c.status === "ACTIVE")
      .map((c) => c.domain),
  );

  return items.filter((item) => {
    // Challenge-join for a domain already ACTIVE — Continue your journey covers it.
    if (item.kind === "challenge" && item.href.startsWith("/register?domain=")) {
      const domain = item.href.split("=")[1] as ChallengeDomain | undefined;
      if (domain && activeDomains.has(domain)) return false;
    }

    // Already ACTIVE on AI cohort — don't recommend apply/continue as "new".
    if (
      item.href.includes("/program/ai-cohort") &&
      facts.aiCohortStatus === "ACTIVE"
    ) {
      return false;
    }
    if (
      item.href === "/program/databricks" &&
      facts.databricksStatus === "ACTIVE"
    ) {
      return false;
    }
    if (
      item.href === "/program/ds-architect" &&
      facts.dsArchitectStatus === "ACTIVE"
    ) {
      return false;
    }
    if (
      item.href === "/program/powerbi" &&
      facts.powerBiStatus === "ACTIVE"
    ) {
      return false;
    }

    if (item.kind === "mock") {
      const slug = item.href.split("/").pop() ?? "";
      const mock = facts.mocks.find((m) => m.slug === slug);
      if (mock && mock.attemptsLeft !== null && mock.attemptsLeft <= 0) {
        return false;
      }
    }

    return true;
  });
}

export function evaluateProgressionEdges(facts: CandidateFacts): GuidanceItem[] {
  const out: GuidanceItem[] = [];
  const seenHref = new Set<string>();
  const seenFamily = new Set<string>();
  let alreadyHasMock = false;

  for (const edge of PROGRESSION_EDGES) {
    if (out.length >= GUIDANCE_POOL_CAP) break;

    // Flag-safe family fallthrough: if this family already produced a card, skip.
    // Exception: skill-challenge and fallback-mock may produce multiple.
    const familyOnce =
      edge.family === "ai-cohort-funnel" ||
      edge.family === "post-ai-cohort" ||
      edge.family === "hackathon" ||
      edge.family === "ds-track";
    if (familyOnce && seenFamily.has(edge.family)) continue;

    if (!edgeWhenMatches(edge.when, facts, alreadyHasMock)) continue;

    const because = buildBecause(edge, facts);
    if (!because) continue;

    if (seenHref.has(edge.then.href)) continue;

    let title = edge.then.title;
    if (edge.when.mockSlug) {
      title = mockTitle(facts, edge.when.mockSlug, edge.then.title);
    }

    const item: GuidanceItem = {
      id: edge.id,
      kind: edge.then.kind as GuidanceKind,
      title,
      because,
      href: edge.then.href,
      cta: edge.then.cta,
    };

    out.push(item);
    seenHref.add(item.href);
    seenFamily.add(edge.family);
    if (item.kind === "mock") alreadyHasMock = true;
  }

  return softDedupeProfileItems(out, facts);
}
