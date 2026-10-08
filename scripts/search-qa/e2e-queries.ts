/**
 * End-to-end recruiter-search relevance harness — READ-ONLY against the DB.
 *
 *   npm run qa:search:e2e                      live model + live search, writes the sheet
 *   npm run qa:search:e2e -- --replay          no API calls; replays the parse cache
 *   npm run qa:search:e2e -- --only=Q01,Q18    a subset
 *   npm run qa:search:e2e -- --top=20          how many results per query to dump
 *   npm run qa:search:e2e -- --score           read labels and print the scorecard
 *
 * WHY THIS EXISTS. The offline suite (`npm run test:recruiter-search`) proves the
 * pure stages over synthetic fixtures; the audits (`npm run audit:*`) prove the
 * live filters and the data. Neither answers the recruiter's actual question:
 * *I typed a correct sentence — are these the right people?* That needs the real
 * model, the real database and a human judgement, which is what this produces.
 *
 * THREE LAYERS, kept apart (same shape as the interview evals):
 *
 *   1. parse assertions  — mechanical, no judgement. A wrong JobSpec makes the
 *      result set meaningless, and that is a different bug from bad ranking, so
 *      it is reported separately and first.
 *   2. labelling sheet   — top-N per query with the evidence a human needs, plus
 *      a JSON file to mark each result relevant / not.
 *   3. scorecard         — precision@10, recall over the labelled-relevant set,
 *      and rank correlation, diffed against a committed baseline.
 *
 * Every raw model response is cached to disk by text hash, so re-running the
 * search, changing the dump, or adding a metric costs no quota. Delete the
 * cache file to force fresh parses.
 *
 * The session is forced read-only by ./read-only-env, imported first on purpose.
 */
import { assumedFlags, databaseHost } from "./read-only-env";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { prisma } from "@/lib/db";
import { extractHireBrief, type HireBriefResult } from "@/features/hire/gemini-brief";
import { mergeBriefPatch } from "@/features/hire/hire-brief";
import { applyPoolBrief, confirmPoolBrief, extractPoolBrief } from "@/features/hire/pool-brief";
import { searchCandidates } from "@/features/hire/search-candidates";
import { QUERY_SET, type RecruiterQuery } from "@/features/search-qa/query-set";
import {
  LABELS_PATH,
  buildScorecard,
  formatScorecard,
  readLabels,
  type QueryRun,
  type ResultRow,
} from "@/features/search-qa/relevance";
import type { JobSpec } from "@/lib/validations/hire";
import type { ScoredCandidate } from "@/features/hire/types";

const OUT_DIR = join(process.cwd(), "docs", "qa", "search-e2e");
const CACHE_PATH = join(OUT_DIR, "parse-cache.json");
const RUN_PATH = join(OUT_DIR, "last-run.json");
const SHEET_PATH = join(OUT_DIR, "labelling-sheet.md");

const argv = process.argv.slice(2);
const flag = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const has = (n: string) => argv.includes(`--${n}`);

// ─── parse cache ─────────────────────────────────────────────────────────────

type Cache = Record<string, { text: string; result: HireBriefResult; parseMs: number }>;

function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

const keyOf = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

// ─── layer 1: parse assertions ───────────────────────────────────────────────

type ParseCheck = {
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
};

function checkParse(
  q: RecruiterQuery,
  spec: JobSpec,
  result: HireBriefResult,
  provenance: "gemini" | "fallback" | "empty",
  parseMs: number,
): ParseCheck {
  if (!result.ok) {
    // `unconfigured` is a setup problem, not a product defect — say which.
    if (result.reason === "unconfigured") {
      return { status: "WARN", detail: "GEMINI_API_KEY not set — only the deterministic path ran" };
    }
    // A timeout is reported with what production then searched on, because the
    // fallback spec is the real answer the recruiter would have received.
    const after = provenance === "empty"
      ? (q.expectNotBrief
          ? "and the fallback produced no spec either, which is correct here"
          : "and the fallback produced NO spec, so the search ran unconstrained")
      : `and the deterministic fallback produced ${describeSpec(spec)}`;
    return {
      status: provenance === "empty" && !q.expectNotBrief ? "FAIL" : "WARN",
      detail: `gemini ${result.reason} after ${parseMs} ms ${after}`,
    };
  }
  if (provenance === "empty" && !q.expectNotBrief) {
    return {
      status: "FAIL",
      detail: "parse returned a brief but it reduced to an empty spec — the search is unconstrained",
    };
  }
  const stack = (spec.mustHaveStack ?? []).map((s) => s.toLowerCase());
  const problems: string[] = [];

  if (q.expectNotBrief) {
    const set = Object.entries(spec).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined,
    );
    if (set.length > 0) {
      problems.push(`expected no brief, got ${set.map(([k]) => k).join(", ")}`);
    }
  }
  for (const want of q.expectStack ?? []) {
    if (!stack.includes(want.toLowerCase())) {
      problems.push(`missing required skill "${want}" (got [${stack.join(", ")}])`);
    }
  }
  for (const banned of q.rejectStack ?? []) {
    if (stack.includes(banned.toLowerCase())) {
      problems.push(`invented skill "${banned}" that the text never named as a requirement`);
    }
  }
  if (q.expectRole && !spec.title) {
    // A missing role costs the `role 20` weight but does not invalidate the
    // result set, so this is a warning and the query is still labelled.
    return { status: "WARN", detail: "no role extracted, so the role weight did not apply" };
  }
  if (problems.length > 0) return { status: "FAIL", detail: problems.join("; ") };
  return { status: "PASS", detail: describeSpec(spec) };
}

function describeSpec(spec: JobSpec): string {
  const parts: string[] = [];
  if (spec.title) parts.push(`role="${spec.title}"`);
  if (spec.mustHaveStack?.length) parts.push(`stack=[${spec.mustHaveStack.join(", ")}]`);
  if (spec.locationCity) parts.push(`city=${spec.locationCity}`);
  if (spec.workMode) parts.push(`mode=${spec.workMode}`);
  if (spec.seniority) parts.push(`seniority=${spec.seniority}`);
  if (spec.minExperience != null) parts.push(`minExp=${spec.minExperience}`);
  if (spec.noticePeriodDays != null) parts.push(`notice=${spec.noticePeriodDays}`);
  if (spec.salaryMax != null) parts.push(`salaryMax=${spec.salaryMax}`);
  return parts.length ? parts.join(" ") : "(empty spec)";
}

/**
 * Which stated constraints could actually bind, given the data.
 *
 * `scoreCandidate` only applies a work-mode or city filter when the candidate
 * HAS that field — unknown is deliberately not a mismatch. With 42 preference
 * rows in 13,176 searchable candidates, a recruiter's stated constraint can
 * therefore be silently inert. This counts that, per query, from the results
 * the search actually returned.
 */
function bindingReport(spec: JobSpec, rows: ScoredCandidate[]): string[] {
  const notes: string[] = [];
  const n = rows.length;
  if (n === 0) return notes;
  const known = rows.filter((r) => !r.availabilityUnknown).length;
  if (spec.locationCity || spec.workMode || spec.noticePeriodDays != null || spec.salaryMax != null) {
    notes.push(
      `${known}/${n} returned candidates have any availability data, so the stated ` +
        `availability constraints could bind for at most ${known}`,
    );
  }
  const flagged = rows.filter((r) => r.hardFilterReasons.length > 0).length;
  notes.push(`${flagged}/${n} carry a hard-filter reason; ${n - flagged} passed every gate that bound`);
  return notes;
}

// ─── the run ─────────────────────────────────────────────────────────────────

function toRow(r: ScoredCandidate, rank: number, spec: JobSpec): ResultRow {
  const wanted = (spec.mustHaveStack ?? []).map((s) => s.toLowerCase());
  const claimed = r.dossier?.declaredSkills.value ?? r.evidence.skills ?? [];
  const matched = claimed.filter((s) => wanted.includes(s.toLowerCase()));
  return {
    rank,
    candidateRef: r.candidateRef,
    role: r.jobRole,
    source: r.source,
    score: r.score,
    tier: r.tier,
    matchedSkills: matched,
    claimedSkills: claimed.slice(0, 25),
    missingMust: wanted.filter((w) => !claimed.some((c) => c.toLowerCase() === w)),
    gaps: r.gaps,
    hardFilterReasons: r.hardFilterReasons,
    availabilityUnknown: r.availabilityUnknown,
    dimensionsUsed: r.scoreBreakdown.dimensionsUsed ?? [],
  };
}

/**
 * The spec production would actually search on, and where it came from.
 *
 * This matters more than it looks. When the Gemini parse fails — and at a
 * 4,000 ms budget against a model that answers in 1.3-4.0 s, it fails
 * intermittently — production does NOT stop. The composer falls back to
 * `detectSpokenBrief` for its ticks and Scout keeps the deterministic
 * `extractPoolBrief` / `confirmPoolBrief` spec. So the recruiter still gets a
 * list; it is just built from keyword hints instead of the model's reading.
 *
 * A harness that only called Gemini would therefore measure a path production
 * does not always take, and an empty-spec search — which returns an
 * unconstrained page of whoever ranks highest — would be invisible. Provenance
 * is recorded so the scorecard can say which engine produced each answer.
 */
function specFor(q: RecruiterQuery, result: HireBriefResult): {
  spec: JobSpec;
  provenance: "gemini" | "fallback" | "empty";
} {
  if (result.ok) {
    const spec = mergeBriefPatch({}, result.patch);
    if (Object.keys(spec).length > 0) return { spec, provenance: "gemini" };
  }
  // Production's deterministic path: the recruiter's own words, two-key confirmed.
  const { brief } = confirmPoolBrief(q.text, {}, q.text);
  const withPool = applyPoolBrief({}, { ...brief, ...extractPoolBrief(q.text) });
  if (Object.keys(withPool).length > 0) return { spec: withPool, provenance: "fallback" };
  return { spec: {}, provenance: "empty" };
}

async function runQuery(
  q: RecruiterQuery,
  cache: Cache,
  opts: { replay: boolean; top: number; parseTimeoutMs: number },
): Promise<QueryRun> {
  const key = keyOf(q.text);
  let result: HireBriefResult | undefined = cache[key]?.result;
  let parseMs = cache[key]?.parseMs ?? 0;
  let fromCache = Boolean(result);

  if (!result) {
    if (opts.replay) {
      return {
        id: q.id,
        kind: q.kind,
        text: q.text,
        rubric: q.rubric,
        unbindable: q.unbindable ?? null,
        parse: { status: "WARN", detail: "no cached parse and --replay given" },
        spec: {},
        provenance: "empty",
        parseMs: 0,
        latencyMs: 0,
        totalEligible: 0,
        belowEvidenceFloor: 0,
        binding: [],
        results: [],
        fromCache: false,
      };
    }
    const t0 = Date.now();
    result = await extractHireBrief(q.text, {
      useCache: false,
      timeoutMs: opts.parseTimeoutMs,
    });
    parseMs = Date.now() - t0;
    // Only successes are cached. A timeout cached here would pin the
    // deterministic fallback for every later run and quietly turn a transient
    // network failure into a permanent "this is what search returns".
    if (result.ok) cache[key] = { text: q.text, result, parseMs };
    fromCache = false;
  }

  const { spec, provenance } = specFor(q, result);
  const parse = checkParse(q, spec, result, provenance, parseMs);

  // A non-brief must not search at all. Running one anyway would both cost a
  // query and hide the routing bug behind a plausible-looking list.
  if (q.expectNotBrief) {
    return {
      id: q.id, kind: q.kind, text: q.text, rubric: q.rubric,
      unbindable: null, parse, spec, provenance, parseMs, latencyMs: 0,
      totalEligible: 0, belowEvidenceFloor: 0,
      binding: ["not searched: classified as not-a-brief (correct behaviour is no search)"],
      results: [], fromCache,
    };
  }

  const started = Date.now();
  const search = await searchCandidates(spec, { limit: opts.top });
  const latencyMs = Date.now() - started;

  if (!search.ok) {
    return {
      id: q.id, kind: q.kind, text: q.text, rubric: q.rubric,
      unbindable: q.unbindable ?? null,
      parse: { status: "FAIL", detail: `search failed: ${search.message}` },
      spec, provenance, parseMs, latencyMs, totalEligible: 0, belowEvidenceFloor: 0,
      binding: [], results: [], fromCache,
    };
  }

  const rows = search.data.matches.slice(0, opts.top);
  return {
    id: q.id,
    kind: q.kind,
    text: q.text,
    rubric: q.rubric,
    unbindable: q.unbindable ?? null,
    parse,
    spec,
    provenance,
    parseMs,
    latencyMs,
    totalEligible: search.data.totalEligible,
    belowEvidenceFloor: search.data.belowEvidenceFloor,
    binding: bindingReport(spec, rows),
    results: rows.map((r, i) => toRow(r, i + 1, spec)),
    fromCache,
  };
}

/** Completed runs from disk, overlaid with this invocation's, in query order. */
function mergeRuns(done: Map<string, QueryRun>, fresh: QueryRun[]): QueryRun[] {
  const byId = new Map(done);
  for (const r of fresh) byId.set(r.id, r);
  return QUERY_SET.map((q) => byId.get(q.id)).filter((r): r is QueryRun => Boolean(r));
}

/**
 * Name the searches that quietly degraded.
 *
 * `loadTrack` catches its own Prisma failures, logs `[hire] loadTrack failed`
 * and returns an empty load, so `searchCandidates` still answers `ok` — with a
 * track silently missing from the pool. During the first full run three loaders
 * failed that way and the search returned results anyway. A human labelling
 * those results would be grading a pool that was never loaded.
 *
 * There is no flag to read, so the pool size is the evidence: a brief with a
 * *looser* skill constraint cannot legitimately see a much smaller pool than
 * the widest query in the run.
 */
function flagCollapse(runs: QueryRun[]): QueryRun[] {
  const pools = runs.filter((r) => r.kind !== "non_brief").map((r) => r.totalEligible);
  const widest = pools.length ? Math.max(...pools) : 0;
  if (widest === 0) return runs;
  return runs.map((r) => {
    if (r.kind === "non_brief" || r.parse.status === "FAIL") return r;
    const floor = Math.round(widest * 0.25);
    if (r.totalEligible >= floor) return r;
    return {
      ...r,
      parse: {
        status: "FAIL",
        detail:
          `POOL COLLAPSE: ${r.totalEligible} eligible against ${widest} for the widest query ` +
          `in this run — a track load almost certainly failed and was swallowed. ` +
          `Do not label these results; re-run this query. (${r.parse.detail})`,
      },
    };
  });
}

// ─── the labelling sheet ─────────────────────────────────────────────────────

function sheet(runs: QueryRun[], host: string): string {
  const L: string[] = [];
  L.push("# Recruiter search — end-to-end labelling sheet");
  L.push("");
  L.push(`Generated ${new Date().toISOString()} · database \`${host}\` · read-only session.`);
  L.push("");
  L.push("## How to label");
  L.push("");
  L.push(`Open \`${LABELS_PATH}\`. For every result listed below, set its ref to \`1\` if the`);
  L.push("candidate is a reasonable answer to the query as written, `0` if not. Leave it");
  L.push("`null` if you genuinely cannot tell — unlabelled results are excluded from the");
  L.push("score rather than counted as wrong. Then run `npm run qa:search:e2e -- --score`.");
  L.push("");
  L.push("Judge the query **as a recruiter who typed that sentence**, not against the");
  L.push("parsed spec: if the parse dropped something, that is the parse's failure to");
  L.push("report, and it is already in the Parse column.");
  L.push("");

  const fails = runs.filter((r) => r.parse.status === "FAIL");
  const warns = runs.filter((r) => r.parse.status === "WARN");
  L.push("## Layer 1 — parse assertions (mechanical, no judgement)");
  L.push("");
  L.push(`${runs.length - fails.length - warns.length} PASS · ${warns.length} WARN · ${fails.length} FAIL`);
  L.push("");
  L.push("| Query | Status | Spec from | Parse ms | Detail |");
  L.push("|---|---|---|---|---|");
  for (const r of runs) {
    L.push(
      `| ${r.id} | ${r.parse.status} | ${r.provenance} | ${r.parseMs} | ` +
        `${r.parse.detail.replace(/\|/g, "\\|")} |`,
    );
  }
  L.push("");
  L.push("## Layer 2 — results to label");
  L.push("");

  for (const r of runs) {
    L.push(`### ${r.id} · ${r.kind}`);
    L.push("");
    L.push(`> ${r.text}`);
    L.push("");
    L.push(`**Rubric.** ${r.rubric}`);
    L.push("");
    if (r.unbindable) {
      L.push(`**NOT SCORED — unbindable constraint.** ${r.unbindable}`);
      L.push("");
    }
    L.push(
      `Parse: \`${r.parse.status}\` — ${r.parse.detail}  ` +
        `\nPool: ${r.totalEligible} eligible, ${r.belowEvidenceFloor} below the evidence floor, ` +
        `${r.results.length} returned in ${r.latencyMs} ms`,
    );
    for (const note of r.binding) L.push(`  \n_${note}_`);
    L.push("");
    if (r.results.length === 0) {
      L.push("_No results._ If the rubric says the pool is large, this is the finding.");
      L.push("");
      continue;
    }
    L.push("| # | ref | role | score/tier | matched | missing must | claimed skills |");
    L.push("|---|---|---|---|---|---|---|");
    for (const c of r.results) {
      L.push(
        `| ${c.rank} | \`${c.candidateRef}\` | ${c.role || "—"} | ` +
          `${c.score}/${c.tier} | ${c.matchedSkills.join(", ") || "—"} | ` +
          `${c.missingMust.join(", ") || "—"} | ${c.claimedSkills.join(", ") || "—"} |`,
      );
    }
    L.push("");
  }
  return `${L.join("\n")}\n`;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function assertReadOnly(): Promise<void> {
  const rows = await prisma.$queryRaw<{ default_transaction_read_only: string }[]>`SHOW default_transaction_read_only`;
  if (rows[0]?.default_transaction_read_only !== "on") {
    throw new Error("Refusing to run: the database session is not read-only.");
  }
}

async function main(): Promise<number> {
  await assertReadOnly();
  console.log(`search-qa · e2e · database ${databaseHost} · read-only session verified`);
  if (!has("score")) {
    console.log(
      `search-qa · parse budget ${flag("parse-timeout") ?? 4000} ms (production default is 4000)`,
    );
  }
  if (assumedFlags.length) console.log(`search-qa · --profile=production assumed: ${assumedFlags.join(", ")}`);

  if (has("score")) {
    if (!existsSync(RUN_PATH)) throw new Error(`No run to score. Run the harness first (${RUN_PATH} missing).`);
    const runs = JSON.parse(readFileSync(RUN_PATH, "utf8")) as QueryRun[];
    const card = buildScorecard(runs, readLabels());
    console.log(formatScorecard(card));
    return card.gate === "FAIL" ? 2 : 0;
  }

  // A long run WILL be interrupted: 31 queries against a 775 ms round trip is
  // over an hour. So every query is persisted as it finishes and `--resume`
  // reuses what is already on disk. The first version saved only at the end and
  // a kill at Q20 threw away sixteen good parses.
  const resume = has("resume");
  const done = new Map<string, QueryRun>();
  if (resume && existsSync(RUN_PATH)) {
    for (const r of JSON.parse(readFileSync(RUN_PATH, "utf8")) as QueryRun[]) {
      if (r.results.length > 0 || r.kind === "non_brief") done.set(r.id, r);
    }
    console.log(`search-qa · --resume: reusing ${done.size} completed quer${done.size === 1 ? "y" : "ies"}`);
  }

  const only = flag("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const top = Number(flag("top") ?? 20);
  const replay = has("replay");
  // Production's budget is 4,000 ms. Raise it only to tell "the model is wrong"
  // apart from "the model is too slow" — the report always prints which.
  const parseTimeoutMs = Number(flag("parse-timeout") ?? 4000);
  const queries = QUERY_SET.filter((q) => !only || only.includes(q.id));
  const cache = loadCache();

  const runs: QueryRun[] = [];
  mkdirSync(OUT_DIR, { recursive: true });
  for (const q of queries) {
    process.stdout.write(`  ${q.id} ${q.kind.padEnd(18)} `);
    const reused = done.get(q.id);
    const run = reused ?? (await runQuery(q, cache, { replay, top, parseTimeoutMs }));
    runs.push(run);
    if (!reused) {
      // Checkpoint both files now, not at the end.
      if (!replay) saveCache(cache);
      writeFileSync(RUN_PATH, `${JSON.stringify(mergeRuns(done, runs), null, 2)}\n`);
    }
    if (reused) { console.log("reused from last-run.json"); continue; }
    console.log(
      `${run.parse.status.padEnd(4)} ${run.provenance.padEnd(8)} ` +
        `${String(run.results.length).padStart(3)} results  parse ${String(run.parseMs).padStart(5)} ms  ` +
        `search ${String(run.latencyMs).padStart(6)} ms ${run.fromCache ? " (cached parse)" : ""}`,
    );
  }

  if (!replay) saveCache(cache);
  const all = mergeRuns(done, runs);
  writeFileSync(RUN_PATH, `${JSON.stringify(all, null, 2)}\n`);
  writeFileSync(SHEET_PATH, sheet(flagCollapse(all), databaseHost));

  const labels = readLabels();
  const card = buildScorecard(flagCollapse(all), labels);
  console.log(`\nsheet  → ${SHEET_PATH}`);
  console.log(`labels → ${LABELS_PATH}`);
  console.log(formatScorecard(card));

  const parseFails = all.filter((r) => r.parse.status === "FAIL").length;
  if (parseFails > 0) return 2;
  return card.gate === "FAIL" ? 2 : 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    await prisma.$disconnect();
    process.exit(1);
  });
