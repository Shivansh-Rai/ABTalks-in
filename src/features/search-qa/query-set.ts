/**
 * The recruiter-query set for end-to-end relevance testing.
 *
 * WHAT THIS MEASURES, and what it deliberately does not.
 *
 * Every query below is answerable from data young-shadow actually holds. On
 * 2026-10-07, over the 13,176 searchable candidates there:
 *
 *   skills on file ......... 2,577   (19.6%)
 *   CandidatePreference .......  42   ( 0.3%)
 *   locationCity ..............  333  ( 2.9%)
 *   headline ..................  267  ( 2.4%)
 *   expectedSalaryMax ...........  0
 *   SkillEvidence rows ..........  0
 *
 * So a query carrying a city, a notice period, a work mode or a budget cannot
 * be judged right or wrong: `scoreCandidate` only binds those filters when the
 * candidate has the field (unknown is correctly not a mismatch), and almost
 * nobody does. Such a query would score 100% on a filter that never ran.
 *
 * The set is therefore scoped to SKILL, ROLE and FREE-TEXT intent, which is
 * where the 2,577 give real signal — plus a small, separately tagged
 * `unbindable` group kept ONLY to document that those constraints silently do
 * not constrain. Those are never counted in the relevance score.
 *
 * PURE. No imports that reach a database or a model.
 */

export type QueryKind =
  /** One named technology. The pool answer is checkable by hand. */
  | "single_skill"
  /** Several named technologies — tests the must-have gate and AND semantics. */
  | "multi_skill"
  /** A role title with no technology named — tests role matching. */
  | "role_only"
  /** Role plus stack, the commonest real recruiter shape. */
  | "role_and_skill"
  /** An alias or spelling the catalog does not store verbatim. */
  | "alias_or_spelling"
  /** Prose a recruiter would actually type, not a keyword list. */
  | "natural_prose"
  /** Not a hiring brief at all — must not produce a search. */
  | "non_brief"
  /** Carries a constraint the data cannot bind. Documented, never scored. */
  | "unbindable";

export type RecruiterQuery = {
  /** Stable id. Labels and baselines are keyed on this, so never renumber. */
  id: string;
  kind: QueryKind;
  /** Exactly what a recruiter types into the composer. */
  text: string;
  /**
   * What a correct answer must satisfy, in words, for the human labeller.
   * This is the rubric — it is shown beside the results on the labelling sheet.
   */
  rubric: string;
  /**
   * Skills the parse MUST produce, lowercase, as `toBriefPatch` normalises
   * them. Asserted mechanically before any human label: a wrong parse makes
   * the result set meaningless, and that is a different bug from bad ranking.
   */
  expectStack?: string[];
  /** The parse must NOT invent these (hallucination guard). */
  rejectStack?: string[];
  /** A role is expected in the spec (exact words vary by model). */
  expectRole?: boolean;
  /** The parse must classify this as not-a-brief. */
  expectNotBrief?: boolean;
  /**
   * For `unbindable`: the constraint the recruiter stated that the data cannot
   * enforce. Reported, never scored.
   */
  unbindable?: string;
};

export const QUERY_SET: readonly RecruiterQuery[] = [
  // ─── single skill ────────────────────────────────────────────────────────
  {
    id: "Q01",
    kind: "single_skill",
    text: "Looking for Python developers",
    rubric:
      "Every result must actually claim Python. 1,623 candidates hold it, so a thin list is a bug, not a thin pool.",
    expectStack: ["python"],
    expectRole: true,
  },
  {
    id: "Q02",
    kind: "single_skill",
    text: "We need someone strong in React",
    rubric: "Every result claims React (389 hold it). React Native alone is not React — flag it if it appears.",
    expectStack: ["react"],
  },
  {
    id: "Q03",
    kind: "single_skill",
    text: "Hiring a candidate who knows Docker",
    rubric: "Every result claims Docker (172 hold it). Kubernetes-only is not Docker.",
    expectStack: ["docker"],
  },
  {
    id: "Q04",
    kind: "single_skill",
    text: "Anyone with C++ experience?",
    rubric:
      "C++ must survive parsing — the '++' once made this unparseable (QA-KI-010). 565 candidates hold it. C alone, or C#, is wrong.",
    expectStack: ["c++"],
  },
  {
    id: "Q05",
    kind: "single_skill",
    text: "Need a LangChain person",
    rubric:
      "129 candidates hold langchain (stored lowercase). Case must not matter. A generic 'AI' match without langchain is wrong.",
    expectStack: ["langchain"],
  },

  // ─── multi skill ─────────────────────────────────────────────────────────
  {
    id: "Q06",
    kind: "multi_skill",
    text: "Full stack developer with React and Node",
    rubric:
      "Both must be claimed, not either. A React-only candidate at the top is the must-have gate failing. Check whether 'Node' reached anyone — the catalog may store 'Node.js'.",
    expectStack: ["react", "node"],
    expectRole: true,
  },
  {
    id: "Q07",
    kind: "multi_skill",
    text: "Python and SQL, for a data role",
    rubric:
      "Both claimed. Python 1,623 × sql 945 should give a large intersection; a short list means the AND is over-filtering.",
    expectStack: ["python", "sql"],
    expectRole: true,
  },
  {
    id: "Q08",
    kind: "multi_skill",
    text: "Someone who has worked with AWS, Docker and Kubernetes",
    rubric:
      "All three. AWS 155, Docker 172 — the intersection is genuinely small, so a short list here is honest. Judge whether the people returned really hold all three; a 2-of-3 match ranked STRONG is wrong.",
    expectStack: ["aws", "docker", "kubernetes"],
  },
  {
    id: "Q09",
    kind: "multi_skill",
    text: "FastAPI plus PostgreSQL backend engineer",
    rubric:
      "FastAPI 142, PostgreSql 149 (note the catalog's casing). Case-insensitive matching must find both.",
    expectStack: ["fastapi", "postgresql"],
    expectRole: true,
  },

  // ─── role only ───────────────────────────────────────────────────────────
  {
    id: "Q10",
    kind: "role_only",
    text: "I want to hire a data analyst",
    rubric:
      "No technology named, so the pool is everyone and ranking carries the whole answer. Results should read as analysts — Power BI / Excel / SQL / Pandas people above, say, mobile developers. Random ordering here means role matching does nothing.",
    expectRole: true,
    rejectStack: ["python", "sql"],
  },
  {
    id: "Q11",
    kind: "role_only",
    text: "Hiring a DevOps engineer",
    rubric:
      "Expect Docker / AWS / Git / Kubernetes people. A pure frontend candidate in the top 10 is a ranking failure.",
    expectRole: true,
  },
  {
    id: "Q12",
    kind: "role_only",
    text: "We're looking for an AI engineer",
    rubric:
      "Expect langchain / Rag / Prompt Engineering / Machine learning signal. This is the platform's own cohort domain, so it is the query most likely to be asked and the one with the most evidence behind it.",
    expectRole: true,
  },
  {
    id: "Q13",
    kind: "role_only",
    text: "Need a frontend developer",
    rubric: "Expect React / HTML / CSS / JavaScript. A backend-only candidate high up is a ranking failure.",
    expectRole: true,
  },

  // ─── role and skill ──────────────────────────────────────────────────────
  {
    id: "Q14",
    kind: "role_and_skill",
    text: "Backend engineer who knows Java and Spring Boot",
    rubric:
      "Java 652. Spring Boot may or may not be in the catalog — if it is not, note that the gate silently drops it rather than reporting it.",
    expectStack: ["java"],
    expectRole: true,
  },
  {
    id: "Q15",
    kind: "role_and_skill",
    text: "ML engineer with PyTorch or TensorFlow",
    rubric:
      "'or' must not become an AND gate: a PyTorch-only candidate is a correct answer. If the list is empty, the OR was read as AND.",
    expectRole: true,
  },
  {
    id: "Q16",
    kind: "role_and_skill",
    text: "Data engineer comfortable with Snowflake and dbt",
    rubric: "Snowflake 109. dbt is likely absent from the catalog — note whether its absence is reported or swallowed.",
    expectStack: ["snowflake"],
    expectRole: true,
  },
  {
    id: "Q17",
    kind: "role_and_skill",
    text: "Mobile developer, React Native or Flutter",
    rubric: "Neither may be well represented. An empty or thin list is the correct answer if so — padding it with web React people is not.",
    expectRole: true,
  },

  // ─── alias / spelling ────────────────────────────────────────────────────
  {
    id: "Q18",
    kind: "alias_or_spelling",
    text: "Need a ReactJS developer",
    rubric:
      "Must reach the 389 'React' candidates. Skill.aliases is empty on all 1,235 catalog rows, so this can only work if the model normalises ReactJS → react. If it returns nothing, alias handling is dead end-to-end.",
    expectStack: ["react"],
  },
  {
    id: "Q19",
    kind: "alias_or_spelling",
    text: "Postgres experience required",
    rubric: "Must reach 'PostgreSql' (149). Tests model normalisation plus case-insensitive SQL together.",
    expectStack: ["postgresql"],
  },
  {
    id: "Q20",
    kind: "alias_or_spelling",
    text: "Looking for JS and TS developers",
    rubric: "JS → javascript (378), TS → typescript. An empty result means the abbreviation never expanded.",
    expectStack: ["javascript", "typescript"],
  },
  {
    id: "Q21",
    kind: "alias_or_spelling",
    text: "Someone who has done RAG pipelines",
    rubric: "Catalog stores 'Rag' (112). Must match case-insensitively and must not be read as the English word 'rag'.",
    expectStack: ["rag"],
  },
  {
    id: "Q22",
    kind: "alias_or_spelling",
    text: "ML and NLP background preferred",
    rubric:
      "'Machine learning' (129) is stored with a space and lowercase 'l'. Whether 'ML' expands to it is the whole test.",
  },

  // ─── natural prose ───────────────────────────────────────────────────────
  {
    id: "Q23",
    kind: "natural_prose",
    text: "We're a seed-stage startup and we need our first backend hire — someone who can own a Python API end to end and isn't scared of deploying it themselves.",
    expectStack: ["python"],
    expectRole: true,
    rubric:
      "Prose, not keywords. Python must be extracted; 'seed-stage' and 'first hire' must NOT become filters. Results should favour people with both Python and some deployment signal (Docker/AWS/Git).",
  },
  {
    id: "Q24",
    kind: "natural_prose",
    text: "Our analytics team is drowning. I need someone who can take messy spreadsheets and turn them into dashboards leadership will actually read.",
    rubric:
      "No technology named explicitly. A good answer surfaces Power BI (165) / Excel (143) / sql people. Nothing may be invented into mustHaveStack — this is the strongest hallucination test in the set.",
    rejectStack: ["power bi", "excel", "sql", "tableau"],
  },
  {
    id: "Q25",
    kind: "natural_prose",
    text: "Replacing a senior engineer who left. Java shop, lots of legacy, needs someone patient.",
    rubric:
      "Java must be extracted. 'senior' may set seniority. 'patient' and 'legacy' must not become skills or filters.",
    expectStack: ["java"],
  },
  {
    id: "Q26",
    kind: "natural_prose",
    text: "no java",
    rubric:
      "A negation. Java must NOT become a must-have — the prompt says to drop negated skills. If Java appears as a required skill, the two-key grounding rule has been defeated by a single keyword.",
    rejectStack: ["java"],
  },

  // ─── not a brief ─────────────────────────────────────────────────────────
  {
    id: "Q27",
    kind: "non_brief",
    text: "who is the prime minister of india",
    rubric: "Must not search. Any candidate list here is a routing failure.",
    expectNotBrief: true,
  },
  {
    id: "Q28",
    kind: "non_brief",
    text: "how many candidates do you have?",
    rubric:
      "A question about the pool, not a brief. Must report a count and must NOT run a search. This exact shape shipped broken on 2026-09-02 — get_pool_stats claimed an empty pool while search returned 19.",
    expectNotBrief: true,
  },
  {
    id: "Q29",
    kind: "non_brief",
    text: "hi",
    rubric: "Greeting. No search, no filters set.",
    expectNotBrief: true,
  },

  // ─── unbindable: documented, never scored ────────────────────────────────
  {
    id: "Q30",
    kind: "unbindable",
    text: "Remote React developer in Bangalore, 30 day notice, budget 18 LPA",
    unbindable:
      "workMode, locationCity, noticePeriodDays, salaryMax — 42 of 13,176 candidates have any preference row and 0 have expectedSalaryMax, so these four constraints bind against almost nobody and the result set does not say so.",
    rubric:
      "DO NOT LABEL FOR RELEVANCE. The point is the report: how many of the stated constraints actually bound, and whether the recruiter is told. A full-looking list of Noida React people is the failure being documented.",
    expectStack: ["react"],
  },
  {
    id: "Q31",
    kind: "unbindable",
    text: "Python developer based in Bengaluru",
    unbindable:
      "locationCity reads CandidatePreference.preferredLocations (42 rows) and never CandidateProfile.locationCity (333 rows, 20 of them Bengaluru). Also Bengaluru/Bangalore are separate strings in the data.",
    rubric:
      "DO NOT LABEL FOR RELEVANCE. Report only: did any Bengaluru-on-profile candidate appear, and was the city constraint reported as bound or ignored?",
    expectStack: ["python"],
  },
] as const;

/** Queries whose results are scored for relevance. */
export function scorableQueries(): RecruiterQuery[] {
  return QUERY_SET.filter((q) => q.kind !== "unbindable" && q.kind !== "non_brief");
}

export function queryById(id: string): RecruiterQuery | null {
  return QUERY_SET.find((q) => q.id === id) ?? null;
}
