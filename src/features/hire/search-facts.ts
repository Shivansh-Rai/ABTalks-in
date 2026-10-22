/**
 * What one search found in the pool, as a funnel of plain counts.
 *
 * Pure, over the members search already has in memory: no database, no model.
 * Two readers:
 *   - `count-candidates.ts`, whose "I have found N" number is `matching`, so
 *     the count and the summary can never disagree;
 *   - `search-summary.ts`, which turns these facts into Scout's search summary.
 *
 * The funnel follows how search treats each part of the brief. The role,
 * the hard filters (city preference, work mode, notice, budget, engagement
 * type, open to work) and the must-have skills narrow the pool. Experience
 * does not: search ranks on it and never excludes on it, so it is reported as
 * how many of the matching candidates are in the asked-for band.
 */
import type { JobSpec } from "@/lib/validations/hire";
import { canonicalSkillName } from "@/lib/skill-catalog";
import type { ScoreableMember } from "@/features/hire/types";
import { assessRole, evaluateHardFilters } from "@/features/hire/score-candidate";

export type SearchFacts = {
  /** Eligible candidates the search considered. */
  poolSize: number;
  /** Present when the brief named a role. */
  role: { title: string; connected: number } | null;
  /** Each hard filter in the brief, in order, with how many were left after it. */
  filters: { label: string; left: number }[];
  /** Each must-have skill and how many of the filtered candidates have it. */
  skills: { name: string; have: number }[];
  /** The end of the funnel: the "I have found N" number. */
  matching: number;
  /** Of `matching`, how many sit in the experience band asked for. */
  experience: { label: string; inBand: number } | null;
};

const WORK_MODE: Record<string, string> = {
  ONSITE: "onsite work",
  HYBRID: "hybrid work",
  REMOTE: "remote work",
  FLEXIBLE: "flexible work",
};

const EMPLOYMENT: Record<string, string> = {
  FULL_TIME: "full-time",
  PART_TIME: "part-time",
  CONTRACT: "contract",
  INTERNSHIP: "internship",
  FREELANCE: "freelance",
};

/** The hard-filter reason each brief field produces, and how to name it. */
function filterSteps(spec: JobSpec): { reason: string; label: string }[] {
  const steps: { reason: string; label: string }[] = [];
  const city = spec.locationCity?.trim();
  if (city && city !== "Any") {
    steps.push({ reason: "Location mismatch", label: city });
  }
  if (spec.workMode && spec.workMode !== "FLEXIBLE") {
    steps.push({
      reason: "Work mode mismatch",
      label: WORK_MODE[spec.workMode] ?? spec.workMode.toLowerCase(),
    });
  }
  if (spec.noticePeriodDays != null && spec.noticePeriodDays < 180) {
    steps.push({
      reason: "Notice period too long",
      label:
        spec.noticePeriodDays === 0
          ? "immediate availability"
          : `availability within ${spec.noticePeriodDays} days`,
    });
  }
  if (spec.employmentType) {
    steps.push({
      reason: "Not open to this engagement type",
      label: `${EMPLOYMENT[spec.employmentType] ?? spec.employmentType} roles`,
    });
  }
  if (spec.salaryMax != null && spec.salaryMax > 0) {
    steps.push({ reason: "Expected salary above budget", label: "your budget" });
  }
  const extra = (spec.extra ?? {}) as Record<string, unknown>;
  if (extra.openToWork === true) {
    steps.push({ reason: "Not open to work", label: "open to work" });
  }
  return steps;
}

/** Reasons that mean "not in the pool at all", before any brief applies. */
const ELIGIBILITY = /^(No recruiter-visibility consent|Cohort results not published|Status )/;

/** "2+ years", "2 to 4 years". Null for no band, or for "evidence only". */
function experienceBand(spec: JobSpec): { min: number; max: number | null; label: string } | null {
  const lo = spec.minExperience;
  const hi = spec.maxExperience;
  if (lo == null && hi == null) return null;
  if (lo === 0 && (hi ?? 0) >= 50) return null;
  const min = lo ?? 0;
  const max = hi == null || hi >= 50 ? null : hi;
  const label =
    max == null
      ? `${min}+ years of experience`
      : min === max
        ? `${min} years of experience`
        : lo == null
          ? `up to ${max} years of experience`
          : `${min} to ${max} years of experience`;
  return { min, max, label };
}

export function computeSearchFacts(
  members: ScoreableMember[],
  spec: JobSpec,
): SearchFacts {
  const steps = filterSteps(spec);
  const must = spec.mustHaveStack ?? [];
  const title = spec.title?.trim() || null;

  // One hard-filter pass per member; every step below reads its reasons.
  // `missingMust` is the scorer's own skill match, so "has Python" here is
  // exactly what search means by it.
  const pool: { member: ScoreableMember; reasons: string[]; missing: string[] }[] = [];
  for (const member of members) {
    const { reasons, missingMust } = evaluateHardFilters(member, spec);
    if (reasons.some((r) => ELIGIBILITY.test(r))) continue;
    pool.push({ member, reasons, missing: missingMust });
  }

  let remaining = title
    ? pool.filter(({ member }) => !assessRole(member, spec)?.mismatch)
    : pool;
  const connected = remaining.length;

  const filters: SearchFacts["filters"] = [];
  for (const step of steps) {
    remaining = remaining.filter(({ reasons }) => !reasons.includes(step.reason));
    filters.push({ label: step.label, left: remaining.length });
  }
  // Anything else the scorer failed them on (a city from the pool geo, a
  // budget read from elsewhere in the brief) still excludes them, so
  // `matching` is exactly the set the scorer accepts.
  remaining = remaining.filter(({ reasons }) => reasons.length === 0);

  const skills = must.map((name) => ({
    name,
    have: remaining.filter(({ missing }) => !missing.includes(name)).length,
  }));
  const matched = remaining.filter(({ missing }) => missing.length === 0);

  const band = experienceBand(spec);
  const experience = band
    ? {
        label: band.label,
        inBand: matched.filter(({ member }) => {
          const y = member.yearsExperience;
          return y != null && y >= band.min && (band.max == null || y <= band.max);
        }).length,
      }
    : null;

  return {
    poolSize: pool.length,
    role: title ? { title, connected } : null,
    filters,
    skills,
    matching: matched.length,
    experience,
  };
}

// ─── Summary text ────────────────────────────────────────────────────────────

/** The top of the ranked list, which the facts alone do not know. */
export type SummaryTop = { shown: number; strong: number };

const fmt = (n: number) => n.toLocaleString("en-IN");

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "sql" -> "SQL" through the skill catalog; an unknown skill is capitalised. */
export function displaySkill(raw: string): string {
  const s = canonicalSkillName(raw);
  return s === s.toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Scout's search summary, assembled from the facts. Always accurate and
 * instant: it is what the recruiter reads whenever the written version is
 * unavailable or fails its checks.
 */
export function templateSearchSummary(f: SearchFacts, top: SummaryTop): string {
  const out: string[] = [];
  out.push(
    f.role
      ? `I looked through ${fmt(f.poolSize)} candidates in the pool, and ${fmt(f.role.connected)} fit the ${f.role.title} role.`
      : `I looked through ${fmt(f.poolSize)} candidates in the pool.`,
  );

  if (f.filters.length > 0) {
    const [first, ...rest] = f.filters;
    let line = `Filtering them by ${first!.label} left ${fmt(first!.left)}`;
    for (const step of rest) line += `, then by ${step.label}, ${fmt(step.left)}`;
    out.push(`${line}.`);
  }

  if (f.skills.length === 1) {
    const [only] = f.skills;
    out.push(`${fmt(only!.have)} of them have ${displaySkill(only!.name)}.`);
  } else if (f.skills.length > 1) {
    const each = f.skills.map((k) => `${fmt(k.have)} have ${displaySkill(k.name)}`);
    const all = f.skills.length === 2 ? "both" : "all of them";
    out.push(`For skills, ${joinList(each)}, and ${fmt(f.matching)} have ${all}.`);
  }

  const narrowed = f.filters.length > 0 || f.skills.length > 0;
  if (f.matching === 0) {
    out.push("Nobody in the pool meets all of that yet.");
  } else if (narrowed) {
    const noun = f.matching === 1 ? "candidate" : "candidates";
    const exp = f.experience
      ? `, ${fmt(f.experience.inBand)} of them with ${f.experience.label}`
      : "";
    out.push(`That leaves ${fmt(f.matching)} matching ${noun}${exp}.`);
  } else if (f.experience) {
    out.push(`${fmt(f.experience.inBand)} of them have ${f.experience.label}.`);
  }

  if (top.shown > 0) {
    if (f.matching === 0) {
      out.push(`I have ranked the ${fmt(top.shown)} closest candidates so you can see who almost fits.`);
    } else {
      out.push(
        top.strong > 0
          ? `I have ranked the top ${fmt(top.shown)} by verified evidence, and ${fmt(top.strong)} of them are strong matches.`
          : `I have ranked the top ${fmt(top.shown)} by verified evidence.`,
      );
    }
  }
  return out.join(" ");
}

/** Every number the summary may state, from the facts and their labels. */
function allowedNumbers(f: SearchFacts, top: SummaryTop): Set<number> {
  const nums = new Set<number>([
    f.poolSize,
    f.matching,
    top.shown,
    top.strong,
    f.skills.length,
  ]);
  if (f.role) nums.add(f.role.connected);
  for (const step of f.filters) nums.add(step.left);
  for (const k of f.skills) nums.add(k.have);
  if (f.experience) nums.add(f.experience.inBand);
  const labels = [
    f.role?.title ?? "",
    f.experience?.label ?? "",
    ...f.filters.map((x) => x.label),
    ...f.skills.map((k) => k.name),
  ].join(" ");
  for (const m of labels.matchAll(/\d+/g)) nums.add(Number(m[0]));
  return nums;
}

/**
 * A written summary is used only if every number in it is one the facts
 * contain, it states the matching count, and it reads as plain prose. A model
 * that rounds, adds up or invents a figure fails here and the template is
 * shown instead.
 */
export function summaryIsGrounded(text: string, f: SearchFacts, top: SummaryTop): boolean {
  const t = text.trim();
  if (t.length < 40 || t.length > 900) return false;
  if (/[—*#\n]|^\s*[-•]/.test(t)) return false;
  const allowed = allowedNumbers(f, top);
  const found = [...t.matchAll(/(?<![\w.])\d[\d,]*(?:\.\d+)?(?![\w])/g)].map((m) =>
    Number(m[0].replace(/,/g, "")),
  );
  if (found.some((n) => !allowed.has(n))) return false;
  return found.includes(f.matching) || f.matching === 0;
}
