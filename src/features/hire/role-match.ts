/**
 * How well a candidate fits the ROLE a recruiter asked for.
 *
 * `spec.title` was asked, stored and shown — and read by nothing. "Frontend
 * developer" and "Data analyst" returned the same twenty people in the same
 * order, because with no skills named every candidate scored the same neutral
 * stack value (audit 2026-09-17). Profiles now carry the data to do better: a
 * headline, target roles and job titles from work history.
 *
 * Two independent readings, kept apart so each can be explained:
 *
 *   - TITLE FIT — does anything the candidate calls themselves (headline,
 *     target role, a job they held, the cohort job role) name this role or a
 *     neighbouring one? Scored as the `role` dimension.
 *   - SKILL FIT — how many of the skills this role typically needs do they
 *     list? Used as the stack dimension when the recruiter named no skills.
 *
 * Neither ever excludes anybody. A role is a ranking signal: people who
 * describe themselves differently, or not at all, still appear — lower.
 *
 * PURE and client-safe (no `server-only`): the scorer and the search QA both
 * import it, and neither may reach a database through it.
 */
import { skillGroupOf, type SkillGroup } from "@/lib/skill-catalog";

export type RoleKey =
  | "DATA_SCIENTIST"
  | "DATA_ENGINEER"
  | "AI_ML"
  | "DATA_ANALYST"
  | "BUSINESS_ANALYST"
  | "SECURITY"
  | "QA"
  | "DEVOPS"
  | "MOBILE"
  | "FULLSTACK"
  | "FRONTEND"
  | "BACKEND"
  | "EMBEDDED"
  | "MECHANICAL"
  | "CIVIL"
  | "DESIGN"
  | "PRODUCT"
  | "MARKETING"
  | "SALES"
  | "HR"
  | "ANALYST"
  | "MANAGER"
  | "SOFTWARE";

/**
 * Ordered most-specific first; a QUERY takes the first rule that hits.
 *
 * Order carries meaning, as in `role-family.ts`: "Data scientist" is tested
 * before AI/ML, "React Native" (mobile) before React (frontend), "Embedded
 * software engineer" before the generic software rule, and the three generic
 * keys — ANALYST, MANAGER, SOFTWARE — come last so they only answer a title
 * nothing more precise describes.
 */
const RULES: { key: RoleKey; pattern: RegExp }[] = [
  { key: "DATA_SCIENTIST", pattern: /data scien/ },
  {
    key: "DATA_ENGINEER",
    pattern: /data engineer|\betl\b|big data|data platform|analytics engineer|databricks|\bspark\b|airflow|data warehous/,
  },
  {
    key: "AI_ML",
    pattern: /\b(ai|ml|nlp|llm|llms|genai|mlops)\b|artificial intelligence|machine learning|deep learning|computer vision|gen ai|generative ai|prompt engineer/,
  },
  {
    key: "DATA_ANALYST",
    pattern: /data analy|analytics|\bbi\b|business intelligence|power bi|tableau|\bmis\b|reporting analyst|insights analyst/,
  },
  { key: "BUSINESS_ANALYST", pattern: /business analy|product analy|functional analy|\bba\b/ },
  { key: "SECURITY", pattern: /secur|cyber|penetration|pentest|\bsoc\b|ethical hack/ },
  { key: "QA", pattern: /\bqa\b|quality assurance|\btest(ing|er|ers)?\b|\bsdet\b/ },
  {
    key: "DEVOPS",
    pattern: /devops|dev ops|\bsre\b|site reliability|\bcloud\b|infrastructure|platform engineer|sysadmin|system admin|network engineer/,
  },
  { key: "MOBILE", pattern: /android|\bios\b|mobile|flutter|react native|app developer/ },
  { key: "FULLSTACK", pattern: /full ?stack|\bmern\b|\bmean\b/ },
  {
    key: "FRONTEND",
    pattern: /front ?end|\bui (developer|engineer)\b|\breact\b|angular|\bvue\b|web developer/,
  },
  {
    key: "BACKEND",
    pattern: /back ?end|\bapi\b|\bnode\b|\bjava\b|spring|django|golang|\bphp\b|\.net\b|python developer|server side/,
  },
  {
    key: "EMBEDDED",
    pattern: /embedded|firmware|vlsi|electronic|electrical|\biot\b|hardware|robotic/,
  },
  { key: "MECHANICAL", pattern: /mechanical|\bcad\b|automobile|automotive|manufactur|production engineer/ },
  { key: "CIVIL", pattern: /\bcivil\b|structural|construction|site engineer/ },
  {
    key: "DESIGN",
    pattern: /designer|\bux\b|user experience|graphic design|product design|visual design|ui ux/,
  },
  {
    key: "PRODUCT",
    pattern: /product manage|product owner|program manager|project manager|scrum master/,
  },
  { key: "MARKETING", pattern: /marketing|\bseo\b|content writ|social media|\bbrand\b|growth/ },
  { key: "SALES", pattern: /\bsales\b|business development|\bbde\b|account executive|pre ?sales/ },
  { key: "HR", pattern: /\bhr\b|human resource|recruit|talent acquisition/ },
  { key: "ANALYST", pattern: /\banalyst\b/ },
  { key: "MANAGER", pattern: /\bmanager\b|\bhead of\b|director/ },
  {
    key: "SOFTWARE",
    pattern: /software|\bsde\b|\bswe\b|programmer|developer|\bcoder\b|\bengineer\b/,
  },
];

/** Keys that only describe a title nothing more specific matched. */
const GENERIC: ReadonlySet<RoleKey> = new Set(["ANALYST", "MANAGER", "SOFTWARE"]);

/**
 * Neighbouring roles and how much of a match each is, 0–1. Symmetric.
 *
 * A full-stack developer is most of a frontend developer; a data scientist is a
 * reasonable read for an AI role; a generic "software engineer" is some of any
 * engineering role. Anything not listed is no title match at all — the skills
 * can still carry them.
 */
const RELATED: [RoleKey, RoleKey, number][] = [
  ["FULLSTACK", "FRONTEND", 0.7],
  ["FULLSTACK", "BACKEND", 0.7],
  ["SOFTWARE", "FRONTEND", 0.6],
  ["SOFTWARE", "BACKEND", 0.6],
  ["SOFTWARE", "FULLSTACK", 0.6],
  ["SOFTWARE", "MOBILE", 0.5],
  ["SOFTWARE", "DEVOPS", 0.5],
  ["SOFTWARE", "QA", 0.4],
  ["SOFTWARE", "AI_ML", 0.4],
  ["SOFTWARE", "DATA_ENGINEER", 0.4],
  ["SOFTWARE", "EMBEDDED", 0.4],
  ["SOFTWARE", "SECURITY", 0.3],
  ["FULLSTACK", "MOBILE", 0.4],
  ["FRONTEND", "MOBILE", 0.4],
  ["FRONTEND", "DESIGN", 0.4],
  ["FRONTEND", "BACKEND", 0.3],
  ["BACKEND", "DEVOPS", 0.5],
  ["BACKEND", "DATA_ENGINEER", 0.4],
  ["BACKEND", "SECURITY", 0.3],
  ["DEVOPS", "SECURITY", 0.4],
  ["DEVOPS", "QA", 0.3],
  ["DATA_ANALYST", "BUSINESS_ANALYST", 0.7],
  ["DATA_ANALYST", "ANALYST", 0.7],
  ["DATA_ANALYST", "DATA_SCIENTIST", 0.6],
  ["DATA_ANALYST", "DATA_ENGINEER", 0.5],
  ["DATA_ANALYST", "AI_ML", 0.3],
  ["DATA_SCIENTIST", "AI_ML", 0.7],
  ["DATA_SCIENTIST", "DATA_ENGINEER", 0.5],
  ["DATA_SCIENTIST", "ANALYST", 0.4],
  ["DATA_ENGINEER", "AI_ML", 0.4],
  ["BUSINESS_ANALYST", "ANALYST", 0.7],
  ["BUSINESS_ANALYST", "PRODUCT", 0.5],
  ["PRODUCT", "MANAGER", 0.5],
  ["PRODUCT", "DESIGN", 0.3],
  ["MARKETING", "SALES", 0.4],
];

const RELATED_FIT = new Map<string, number>();
for (const [a, b, v] of RELATED) {
  RELATED_FIT.set(`${a}|${b}`, v);
  RELATED_FIT.set(`${b}|${a}`, v);
}

/**
 * The skills a role typically lists: whole catalog groups, plus named skills
 * from other groups. Roles defined by what someone does rather than the tools
 * they use (sales, HR, generic management) have none, and are judged on the
 * title alone.
 */
const ROLE_SKILLS: Partial<Record<RoleKey, { groups?: SkillGroup[]; skills?: string[] }>> = {
  FRONTEND: { groups: ["Frontend"], skills: ["JavaScript", "TypeScript"] },
  BACKEND: {
    groups: ["Backend"],
    skills: ["Java", "Python", "Go", "C#", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis"],
  },
  FULLSTACK: {
    groups: ["Frontend", "Backend"],
    skills: ["JavaScript", "TypeScript", "SQL", "MongoDB", "PostgreSQL", "MySQL"],
  },
  MOBILE: { groups: ["Mobile"], skills: ["Kotlin", "Swift", "Dart"] },
  DEVOPS: { groups: ["Cloud & DevOps"], skills: ["Bash", "Shell Scripting", "Nginx"] },
  QA: { groups: ["Testing & QA"], skills: ["Quality Assurance"] },
  SECURITY: { groups: ["Security"] },
  DATA_ANALYST: {
    skills: [
      "SQL", "Excel", "Power BI", "Tableau", "Looker", "Data Analysis",
      "Data Visualization", "Statistics", "Statistical Analysis", "Pandas",
      "Data Cleaning", "Python", "A/B Testing",
    ],
  },
  DATA_SCIENTIST: {
    skills: [
      "Data Science", "Machine Learning", "Statistics", "Pandas", "NumPy",
      "scikit-learn", "Python", "R", "Feature Engineering", "Predictive Modeling",
      "Deep Learning", "XGBoost", "Data Analysis",
    ],
  },
  DATA_ENGINEER: {
    skills: [
      "Data Engineering", "ETL", "Apache Spark", "PySpark", "Apache Airflow",
      "Databricks", "Data Warehousing", "Apache Kafka", "Snowflake", "BigQuery",
      "dbt", "Hadoop", "Big Data", "Hive", "SQL",
    ],
  },
  AI_ML: {
    skills: [
      "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "Keras", "NLP",
      "Computer Vision", "Generative AI", "LangChain", "LangGraph", "LlamaIndex",
      "Prompt Engineering", "OpenAI API", "AI Agents", "MLOps", "Fine-Tuning",
      "Embeddings", "Claude", "Model Deployment", "scikit-learn",
    ],
  },
  BUSINESS_ANALYST: {
    skills: [
      "Business Analysis", "Requirements Gathering", "User Stories",
      "Stakeholder Management", "SQL", "Excel", "Power BI", "Tableau", "Jira",
      "Data Analysis",
    ],
  },
  ANALYST: {
    skills: ["Excel", "SQL", "Data Analysis", "Power BI", "Tableau", "Statistics"],
  },
  PRODUCT: {
    skills: [
      "Product Management", "Product Strategy", "Roadmapping", "User Stories",
      "Agile", "Scrum", "Jira", "Stakeholder Management", "Market Research",
    ],
  },
  DESIGN: { groups: ["Design"] },
  EMBEDDED: { groups: ["Electrical Engineering"], skills: ["C", "C++", "Embedded C"] },
  MECHANICAL: { groups: ["Mechanical Engineering"] },
  CIVIL: { groups: ["Civil Engineering"] },
  MARKETING: {
    skills: ["Digital Marketing", "SEO", "Market Research", "Go-to-Market Strategy"],
  },
  SOFTWARE: {
    groups: ["Languages", "Backend", "Frontend", "Systems"],
    skills: ["Git", "Data Structures and Algorithms"],
  },
};

/** Typical skills needed for a full skill fit. Listing three is a real signal. */
const SKILLS_FOR_FULL_FIT = 3;

/**
 * Words that say how senior or what kind of contract, not what the job is.
 * "Senior frontend developer intern" asks for a frontend developer.
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  "senior", "sr", "junior", "jr", "lead", "principal", "staff", "associate",
  "intern", "internship", "trainee", "fresher", "freshers", "graduate", "entry",
  "level", "mid", "i", "ii", "iii", "iv", "the", "a", "an", "and", "or", "of",
  "for", "in", "at", "to", "with", "role", "position", "job", "remote", "hybrid",
  "onsite", "full", "time", "part", "contract", "permanent", "experienced",
  "wanted", "hiring", "needed", "required",
]);

export type RoleQuery = {
  /** The recruiter's own words, trimmed — used in the card's gap text. */
  label: string;
  /** Null for a title no rule describes ("Sales executive" is SALES; "Chef" is null). */
  key: RoleKey | null;
  /** Meaningful words of the title, for phrase and keyword matching. */
  tokens: string[];
};

function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[_\-/|,;:()[\]&+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(normalized: string): string[] {
  return normalized
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * Every role a title names, in the order the title names them, generic keys
 * dropped when a specific one is present.
 *
 * Order matters to `roleTitleFit`: the role a title LEADS with is what the
 * person is. "Reporting Analyst in sales & marketing" is an analyst who works
 * in sales, not a salesperson; a headline reading "Student | Full-Stack
 * Developer | … React • Node.js" is a full-stack developer who uses Node.
 */
export function roleKeysForTitle(raw: string): RoleKey[] {
  const t = normalizeTitle(raw);
  if (!t) return [];
  const hits = RULES.flatMap((r) => {
    const at = t.search(r.pattern);
    return at === -1 ? [] : [{ key: r.key, at }];
  })
    // Stable: two rules matching at the same place keep specificity order.
    .sort((a, b) => a.at - b.at)
    .map((h) => h.key);
  const specific = hits.filter((k) => !GENERIC.has(k));
  return specific.length > 0 ? specific : hits;
}

/** A role a title mentions but does not lead with — a real connection, not the job. */
const SECONDARY_MENTION_FIT = 0.7;

/**
 * Parse the recruiter's role. Null when there is nothing to rank on — no
 * title, or one made only of seniority words ("Intern", "Senior").
 */
export function parseRoleQuery(title: string | null | undefined): RoleQuery | null {
  const label = (title ?? "").trim().replace(/\s+/g, " ");
  if (!label) return null;
  const t = normalizeTitle(label);
  const key = RULES.find((r) => r.pattern.test(t))?.key ?? null;
  const tokens = tokensOf(t);
  if (!key && tokens.length === 0) return null;
  return { label, key, tokens };
}

function containsPhrase(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return ` ${haystack} `.includes(` ${tokens.join(" ")} `);
}

export type TitleFit = {
  /** 0–1. */
  fit: number;
  /** The candidate's own title that produced the fit, for explanations. */
  matched: string | null;
};

/**
 * The best reading of any title the candidate gave.
 *
 *   1.0  the title leads with the same role, or contains the recruiter's words
 *   0.7  the title mentions the role after leading with another
 *   0.3–0.7  a neighbouring role (see RELATED)
 *   share  for a role no rule describes, the share of its words present
 *   0    nothing
 */
export function roleTitleFit(query: RoleQuery, titles: readonly string[]): TitleFit {
  let best: TitleFit = { fit: 0, matched: null };
  for (const raw of titles) {
    const t = normalizeTitle(raw ?? "");
    if (!t) continue;
    let fit = 0;
    if (containsPhrase(t, query.tokens)) {
      fit = 1;
    } else if (query.key) {
      roleKeysForTitle(t).forEach((k, i) => {
        const v = k === query.key ? 1 : (RELATED_FIT.get(`${query.key}|${k}`) ?? 0);
        const capped = i === 0 ? v : Math.min(v, SECONDARY_MENTION_FIT);
        if (capped > fit) fit = capped;
      });
    } else {
      const words = new Set(tokensOf(t));
      const found = query.tokens.filter((w) => words.has(w)).length;
      fit = found / query.tokens.length;
    }
    if (fit > best.fit) best = { fit, matched: raw.trim() };
    if (best.fit >= 1) break;
  }
  return best;
}

export type SkillFit = {
  /** 0–1: typical skills listed, saturating at three. */
  fit: number;
  /** The candidate's skills that count toward this role. */
  hits: string[];
};

const hitCache = new Map<string, boolean>();
const HIT_CACHE_MAX = 50_000;

/**
 * How many of the role's typical skills the candidate lists.
 *
 * Null when the role has no typical skills (sales, HR, a role no rule
 * describes) — the caller must treat that as "not measurable", never as zero.
 * `match` is the scorer's own skill matcher, passed in so aliases, compounds
 * and spellings fold exactly as they do for a must-have.
 */
export function roleSkillFit(
  query: RoleQuery,
  skills: readonly string[],
  match: (have: string[], need: string) => boolean,
): SkillFit | null {
  const def = query.key ? ROLE_SKILLS[query.key] : undefined;
  if (!query.key || !def) return null;
  const hits: string[] = [];
  const seen = new Set<string>();
  for (const raw of skills) {
    const skill = raw.trim();
    const norm = skill.toLowerCase();
    if (!skill || seen.has(norm)) continue;
    seen.add(norm);
    const cacheKey = `${query.key}|${norm}`;
    let hit = hitCache.get(cacheKey);
    if (hit === undefined) {
      const group = skillGroupOf(skill);
      hit =
        (group != null && (def.groups ?? []).includes(group)) ||
        (def.skills ?? []).some((need) => match([skill], need));
      if (hitCache.size >= HIT_CACHE_MAX) hitCache.clear();
      hitCache.set(cacheKey, hit);
    }
    if (hit) hits.push(skill);
  }
  return { fit: Math.min(1, hits.length / SKILLS_FOR_FULL_FIT), hits };
}

/**
 * Every title a candidate has given, in the order they carry weight: what they
 * call themselves, what they want next, then the jobs they held (current and
 * most recent first). Blank and repeated titles dropped.
 *
 * Shared by the search loader and the offline golden pool so both build the
 * same list from the same rows.
 */
export function collectRoleTitles(input: {
  jobRole?: string | null;
  headline?: string | null;
  preferredRoles?: readonly string[] | null;
  experienceTitles?: readonly string[] | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [
    input.jobRole,
    input.headline,
    ...(input.preferredRoles ?? []),
    ...(input.experienceTitles ?? []),
  ]) {
    const t = (raw ?? "").trim().replace(/\s+/g, " ");
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export const __test = { RULES, RELATED_FIT, ROLE_SKILLS, normalizeTitle, tokensOf };
