/**
 * Relevance scoring for the end-to-end recruiter-search harness.
 *
 * The ground truth is a human's. A label file maps `queryId → candidateRef →
 * 1 | 0 | null`, where `null` means "could not tell" and is EXCLUDED from the
 * score rather than counted against the search — an unlabelled result must
 * never masquerade as a wrong one.
 *
 * What is measured, and why these three:
 *
 *  - **precision@10** — of the ten people a recruiter actually looks at, how
 *    many are right. This is the number that matches the recruiter's experience,
 *    so it is the gate.
 *  - **recall over labelled-relevant** — of everyone the labeller marked
 *    relevant anywhere in the dump, how many made the top 10. Catches the case
 *    where the right people are present but ranked below the fold, which
 *    precision alone reports as success.
 *  - **rank correlation** — are the relevant ones ABOVE the irrelevant ones.
 *    A list that is 50% right with the right half on top is a usable list; the
 *    same list shuffled is not, and precision cannot tell them apart.
 *
 * PURE. No database, no model, no filesystem beyond reading the label file.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { QueryKind } from "@/features/search-qa/query-set";
import type { JobSpec } from "@/lib/validations/hire";
import type { MatchTier, ScoreDimension } from "@/features/hire/types";

export const LABELS_PATH = join("docs", "qa", "search-e2e", "labels.json");

/** Below this, the query is reported as failing rather than merely weak. */
export const PRECISION_GATE = 0.7;

export type ResultRow = {
  rank: number;
  candidateRef: string;
  /**
   * NO NAME, and no userId, on purpose.
   *
   * Judging "is this a reasonable answer to the query" needs the candidate's
   * skills and role; their name adds nothing to that decision and everything to
   * the cost of the artifact leaking. `scripts/anonymise-match-rationales.ts`
   * exists in this repo precisely because stored rationales once began "Ada
   * Lovelace scores 92/100" and every such row was a live name leak — a QA sheet
   * full of real candidates would be the same mistake in a new place.
   *
   * `candidateRef` is the label key and is already the id the recruiter surfaces
   * use. Anyone who needs the person behind a ref can resolve it with
   * `npm run audit:search-explain -- --user=<id>`.
   */
  role: string;
  source: string;
  score: number;
  tier: MatchTier;
  matchedSkills: string[];
  claimedSkills: string[];
  missingMust: string[];
  gaps: string[];
  hardFilterReasons: string[];
  availabilityUnknown: boolean;
  dimensionsUsed: ScoreDimension[];
};

export type QueryRun = {
  id: string;
  kind: QueryKind;
  text: string;
  rubric: string;
  unbindable: string | null;
  parse: { status: "PASS" | "FAIL" | "WARN"; detail: string };
  spec: JobSpec;
  /**
   * Which engine produced the spec that was searched on. `fallback` means the
   * Gemini parse failed and production's deterministic keyword path answered
   * instead; `empty` means neither did, and the result set is unconstrained —
   * whoever ranks highest in the whole pool, regardless of the query.
   */
  provenance: "gemini" | "fallback" | "empty";
  /** Wall-clock of the parse call, against production's 4,000 ms budget. */
  parseMs: number;
  latencyMs: number;
  totalEligible: number;
  belowEvidenceFloor: number;
  binding: string[];
  results: ResultRow[];
  fromCache: boolean;
};

/** `queryId → candidateRef → 1 relevant | 0 not | null unknown`. */
export type Labels = Record<string, Record<string, 0 | 1 | null>>;

export function readLabels(path: string = LABELS_PATH): Labels {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Labels;
  } catch {
    return {};
  }
}

export type QueryScore = {
  id: string;
  kind: QueryKind;
  /** Null when nothing in this query's dump is labelled yet. */
  precisionAt10: number | null;
  recall: number | null;
  /**
   * Somers' D over (rank, relevance): +1 every relevant-above-irrelevant pair,
   * −1 for every inversion, normalised. +1 is a perfectly ordered list, 0 is
   * indistinguishable from random, −1 is exactly backwards.
   */
  rankCorrelation: number | null;
  labelled: number;
  relevant: number;
  returned: number;
  status: "PASS" | "WEAK" | "FAIL" | "UNLABELLED" | "NOT_SCORED";
  note: string;
};

export type Scorecard = {
  queries: QueryScore[];
  /** How many queries each engine answered. `empty` is always a defect. */
  provenance: { gemini: number; fallback: number; empty: number };
  /** Parse latency against the 4,000 ms production budget. */
  parseLatency: { p50: number; p95: number; max: number; overBudget: number };
  /** Mean precision@10 over scored, labelled queries. */
  meanPrecision: number | null;
  parse: { pass: number; warn: number; fail: number };
  latency: { p50: number; p95: number; max: number };
  gate: "PASS" | "FAIL" | "UNLABELLED";
  unbindable: { id: string; note: string }[];
};

function precisionAt(rows: ResultRow[], labels: Record<string, 0 | 1 | null>, k: number): number | null {
  const head = rows.slice(0, k).filter((r) => labels[r.candidateRef] === 0 || labels[r.candidateRef] === 1);
  if (head.length === 0) return null;
  const good = head.filter((r) => labels[r.candidateRef] === 1).length;
  return good / head.length;
}

function somersD(rows: ResultRow[], labels: Record<string, 0 | 1 | null>): number | null {
  const judged = rows.filter((r) => labels[r.candidateRef] === 0 || labels[r.candidateRef] === 1);
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < judged.length; i += 1) {
    for (let j = i + 1; j < judged.length; j += 1) {
      const a = labels[judged[i].candidateRef];
      const b = labels[judged[j].candidateRef];
      if (a === b) continue;
      // judged[i] is ranked above judged[j] by construction.
      if (a === 1 && b === 0) concordant += 1;
      else discordant += 1;
    }
  }
  const pairs = concordant + discordant;
  if (pairs === 0) return null;
  return (concordant - discordant) / pairs;
}

export function scoreQuery(run: QueryRun, labels: Labels): QueryScore {
  const base = {
    id: run.id,
    kind: run.kind,
    labelled: 0,
    relevant: 0,
    returned: run.results.length,
    precisionAt10: null,
    recall: null,
    rankCorrelation: null,
  };

  if (run.kind === "unbindable") {
    return { ...base, status: "NOT_SCORED", note: "unbindable constraint — reported, not scored" };
  }
  if (run.kind === "non_brief") {
    const clean = run.results.length === 0;
    return {
      ...base,
      status: clean ? "PASS" : "FAIL",
      note: clean ? "correctly did not search" : `searched anyway and returned ${run.results.length}`,
    };
  }

  const forQuery = labels[run.id] ?? {};
  const judged = run.results.filter((r) => forQuery[r.candidateRef] === 0 || forQuery[r.candidateRef] === 1);
  const relevant = run.results.filter((r) => forQuery[r.candidateRef] === 1);

  if (judged.length === 0) {
    return { ...base, status: "UNLABELLED", note: "no labels yet for this query" };
  }

  const p10 = precisionAt(run.results, forQuery, 10);
  const inTop10 = run.results.slice(0, 10).filter((r) => forQuery[r.candidateRef] === 1).length;
  const recall = relevant.length === 0 ? null : inTop10 / relevant.length;
  const d = somersD(run.results, forQuery);

  let status: QueryScore["status"] = "PASS";
  let note = "";
  if (p10 == null) {
    status = "UNLABELLED";
    note = "nothing in the top 10 is labelled";
  } else if (p10 < PRECISION_GATE / 2) {
    status = "FAIL";
    note = `precision@10 ${(p10 * 100).toFixed(0)}% — most of what a recruiter sees is wrong`;
  } else if (p10 < PRECISION_GATE) {
    status = "WEAK";
    note = `precision@10 ${(p10 * 100).toFixed(0)}% — below the ${PRECISION_GATE * 100}% gate`;
  } else if (d != null && d < 0.2) {
    status = "WEAK";
    note = `precision@10 is fine but ordering is near-random (D=${d.toFixed(2)})`;
  } else {
    note = `precision@10 ${(p10 * 100).toFixed(0)}%`;
  }

  return {
    ...base,
    labelled: judged.length,
    relevant: relevant.length,
    precisionAt10: p10,
    recall,
    rankCorrelation: d,
    status,
    note,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function buildScorecard(runs: QueryRun[], labels: Labels): Scorecard {
  const queries = runs.map((r) => scoreQuery(r, labels));
  const scored = queries.filter((q) => q.precisionAt10 != null);
  const meanPrecision =
    scored.length === 0
      ? null
      : scored.reduce((sum, q) => sum + (q.precisionAt10 ?? 0), 0) / scored.length;

  const latencies = runs.filter((r) => r.latencyMs > 0).map((r) => r.latencyMs);
  const gate: Scorecard["gate"] =
    queries.some((q) => q.status === "FAIL")
      ? "FAIL"
      : scored.length === 0 && !queries.some((q) => q.kind === "non_brief" && q.status === "PASS")
        ? "UNLABELLED"
        : "PASS";

  const parseTimes = runs.filter((r) => r.parseMs > 0).map((r) => r.parseMs);
  return {
    queries,
    meanPrecision,
    provenance: {
      gemini: runs.filter((r) => r.provenance === "gemini").length,
      fallback: runs.filter((r) => r.provenance === "fallback").length,
      empty: runs.filter((r) => r.provenance === "empty" && r.kind !== "non_brief").length,
    },
    parseLatency: {
      p50: percentile(parseTimes, 50),
      p95: percentile(parseTimes, 95),
      max: parseTimes.length ? Math.max(...parseTimes) : 0,
      overBudget: parseTimes.filter((m) => m >= 4000).length,
    },
    parse: {
      pass: runs.filter((r) => r.parse.status === "PASS").length,
      warn: runs.filter((r) => r.parse.status === "WARN").length,
      fail: runs.filter((r) => r.parse.status === "FAIL").length,
    },
    latency: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies.length ? Math.max(...latencies) : 0,
    },
    gate,
    unbindable: runs
      .filter((r) => r.unbindable)
      .map((r) => ({ id: r.id, note: r.unbindable as string })),
  };
}

const pct = (v: number | null) => (v == null ? "   —" : `${(v * 100).toFixed(0).padStart(3)}%`);

export function formatScorecard(card: Scorecard): string {
  const L: string[] = [];
  L.push("");
  L.push("── scorecard ──────────────────────────────────────────────────────────");
  L.push(
    `parse checks: ${card.parse.pass} PASS · ${card.parse.warn} WARN · ${card.parse.fail} FAIL`,
  );
  L.push(
    `spec from:    gemini ${card.provenance.gemini} · deterministic fallback ${card.provenance.fallback} · ` +
      `NOTHING ${card.provenance.empty}${card.provenance.empty > 0 ? "  ← unconstrained searches" : ""}`,
  );
  L.push(
    `parse ms:     p50 ${card.parseLatency.p50} · p95 ${card.parseLatency.p95} · max ${card.parseLatency.max}` +
      `   (${card.parseLatency.overBudget} at or over the 4000 ms production budget)`,
  );
  L.push(
    `search ms:    p50 ${card.latency.p50} · p95 ${card.latency.p95} · max ${card.latency.max}`,
  );
  L.push("");
  L.push("query  kind                status        P@10  recall  rankD  note");
  for (const q of card.queries) {
    L.push(
      `${q.id.padEnd(6)} ${q.kind.padEnd(18)} ${q.status.padEnd(12)} ` +
        `${pct(q.precisionAt10)}   ${pct(q.recall)}  ` +
        `${(q.rankCorrelation == null ? "   —" : q.rankCorrelation.toFixed(2).padStart(5))}  ${q.note}`,
    );
  }
  L.push("");
  if (card.meanPrecision != null) {
    L.push(`mean precision@10 over ${card.queries.filter((q) => q.precisionAt10 != null).length} labelled queries: ${pct(card.meanPrecision)}`);
  } else {
    L.push("mean precision@10: not computable yet — nothing labelled.");
  }
  if (card.unbindable.length > 0) {
    L.push("");
    L.push("unbindable constraints (documented, never scored):");
    for (const u of card.unbindable) L.push(`  ${u.id}: ${u.note}`);
  }
  L.push("");
  L.push(`gate: ${card.gate}`);
  return L.join("\n");
}
