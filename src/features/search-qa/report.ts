/**
 * The audit report as text a developer and a product owner can both read.
 *
 * Never "test failed": every failing line carries counts, a classification, the
 * cause and the candidate ids to open in explain mode.
 *
 * PURE.
 */
import type { AuditReport, CheckRow } from "@/features/search-qa/audit";
import { KNOWN_ISSUES } from "@/features/search-qa/known-issues";
import type { QaFinding } from "@/features/search-qa/types";

const ICON: Record<string, string> = { PASS: "✅", FAIL: "❌", WARN: "⚠️ ", XFAIL: "🟠", SKIPPED: "⏭️ ", "N/A": "—" };

function ids(list: string[], total?: number): string {
  if (list.length === 0) return "";
  const more = total != null && total > list.length ? ` … +${total - list.length} more` : "";
  return `[${list.join(", ")}${more}]`;
}

function checks(title: string, rows: CheckRow[]): string[] {
  if (rows.length === 0) return [];
  return [
    "",
    title,
    ...rows.map((r) => `  ${ICON[r.status] ?? r.status} ${r.label} — ${r.detail}`),
  ];
}

function findingLine(f: QaFinding): string {
  const ki = f.knownIssue ? ` ${f.knownIssue}` : "";
  const pd = f.productDecision ? " PRODUCT DECISION" : "";
  return `  [${f.severity}] ${f.category}${ki}${pd} · ${f.affected} affected · ${f.message}${f.userIds.length ? `\n      ids ${ids(f.userIds, f.affected)}` : ""}`;
}

export function formatAuditReport(r: AuditReport, opts: { verbose?: boolean } = {}): string {
  const out: string[] = [];
  out.push("RECRUITER SEARCH AUDIT");
  out.push(`generated ${r.generatedAt} in ${(r.durationMs / 1000).toFixed(1)}s`);
  out.push(
    `flags: ENABLE_NEW_TALENT=${r.environment.flags.newTalentRead} · HIRE_CHALLENGE_POOL=${r.environment.flags.challengePool.enabled ? r.environment.flags.challengePool.minDays : "off"} · HIRE_OPEN_COHORT_IDS=${Array.isArray(r.environment.flags.openCohortIds) ? r.environment.flags.openCohortIds.join(",") : r.environment.flags.openCohortIds ?? "unset"}`,
  );
  out.push(`pipeline: page ${r.environment.pipeline.pageLimit}, rank window ${r.environment.pipeline.rankWindow}, min results ${r.environment.pipeline.minResults}; tracks searched: ${r.environment.enabledTracks.join(", ") || "—"}`);
  for (const n of r.environment.notes) out.push(`note: ${n}`);

  if (r.population) {
    const p = r.population;
    out.push("", "POPULATION");
    out.push(`  users ${p.users} · candidate users (STUDENT, not deleted) ${p.candidateUsers} · profiles ${p.withProfile}`);
    out.push(`  visibility rows ${p.visibilityRows} · searchable ${p.searchableRows} · deleted ${p.deleted} · disabled ${p.disabled}`);
  }

  if (r.coverage) {
    const c = r.coverage;
    out.push("", "SEARCH COVERAGE");
    out.push(`  Eligible candidates:   ${c.eligible}`);
    out.push(`  Indexed (loaded):      ${c.indexed}`);
    out.push(`  Coverage:              ${c.coveragePct}%  (${c.eligibleIndexed}/${c.eligible})`);
    out.push(`  Missing:               ${c.missing.count} ${Object.keys(c.missing.byCause).length ? JSON.stringify(c.missing.byCause) : ""} ${ids(c.missing.userIds, c.missing.count)}`);
    out.push(`  Duplicates:            ${c.duplicates.count} ${ids(c.duplicates.userIds, c.duplicates.count)}`);
    out.push(`  Stale documents:       ${c.stale.count} ${Object.keys(c.stale.byCause).length ? JSON.stringify(c.stale.byCause) : ""}`);
    out.push(`  Invalid indexed:       ${c.invalidIndexed.count} ${Object.keys(c.invalidIndexed.byReason).length ? JSON.stringify(c.invalidIndexed.byReason) : ""} ${ids(c.invalidIndexed.userIds, c.invalidIndexed.count)}`);
    out.push(`  Wrong track:           ${c.wrongTrack.count} ${ids(c.wrongTrack.userIds, c.wrongTrack.count)}`);
    out.push(`  Usable profile, no visibility row (hidden, product decision): ${c.usableProfileNoVisibilityRow.count} ${ids(c.usableProfileNoVisibilityRow.userIds, c.usableProfileNoVisibilityRow.count)}`);
    out.push("  per track: " + c.perTrack.map((t) => `${t.slug} expected ${t.expected} / loaded ${t.uniqueLoaded}${t.loaded !== t.uniqueLoaded ? ` (${t.loaded} documents)` : ""}${t.cap ? ` (cap ${t.cap}${t.truncated ? ", TRUNCATED" : ""})` : ""}`).join(" · "));
  }

  if (r.filters.length) {
    out.push("", "FILTER TESTS (inventory from the implementation)");
    for (const f of r.filters) {
      if (f.kind === "NOT_IMPLEMENTED") continue;
      const ki = f.knownIssues.length ? ` · ${f.knownIssues.join(", ")}` : "";
      const counts = f.cases ? ` · ${f.cases} case(s), expected ${f.expected} / actual ${f.actual}, FP ${f.falsePositives}, FN ${f.falseNegatives}` : "";
      out.push(`  ${ICON[f.status] ?? f.status} ${f.label} [${f.kind}${f.criticality === "CORE" ? ", core" : ""}]${counts}${ki}`);
    }
    const missing = r.filters.filter((f) => f.kind === "NOT_IMPLEMENTED");
    if (missing.length) out.push(`  not implemented by recruiter search: ${missing.map((f) => f.label).join(", ")}`);
  }

  const failing = r.cases.filter((c) => c.status === "FAIL" || c.status === "XFAIL");
  if (r.cases.length) {
    out.push("", "CASE RESULTS (expected vs actual)");
    const shown = opts.verbose ? r.cases : failing.slice(0, 25);
    for (const c of shown) {
      out.push(`  ${ICON[c.status]} ${c.id} ${c.label}`);
      out.push(`      expected ${c.expected} · actual ${c.actual} · TP ${c.truePositives} · FP ${c.falsePositives} · FN ${c.falseNegatives} · ambiguous ${c.ambiguous} · accuracy ${(c.accuracy * 100).toFixed(1)}%`);
      if (c.falsePositiveIds.length) out.push(`      unexpected ${ids(c.falsePositiveIds, c.falsePositives)}`);
      if (c.falseNegativeIds.length) out.push(`      missing    ${ids(c.falseNegativeIds, c.falseNegatives)}`);
      for (const f of c.findings.filter((x) => x.searchVerdict === "FAIL")) {
        out.push(`      → ${f.category}${f.knownIssue ? ` ${f.knownIssue}` : ""} (${String(f.detail?.cause ?? "")}): ${f.affected} — ${f.message.split(" — ").slice(-1)[0]}`);
      }
    }
    if (!opts.verbose && failing.length > shown.length) out.push(`  … ${failing.length - shown.length} more failing case(s); run with --verbose or --json`);
  }

  if (r.combinations.length) {
    out.push("", "COMBINATION TESTS");
    for (const k of r.combinations) {
      out.push(`  ${k.kind.padEnd(12)} ${k.pass + k.warn}/${k.total} passed · ${k.warn} with warnings · ${k.xfail} known-issue failures · ${k.fail} unexplained failures`);
    }
  }

  out.push(...checks("PAGINATION", r.checks.pagination));
  out.push(...checks("SORT", r.checks.sort));
  out.push(...checks("PRIVACY / VISIBILITY", r.checks.privacy));
  out.push(...checks("RANKING", r.checks.ranking));

  if (r.indexConsistency) {
    const i = r.indexConsistency;
    out.push("", "SEARCH DOCUMENT CONSISTENCY (no separate index — documents are built per request)");
    out.push(`  documents checked ${i.documents} · drifted ${i.drifted}`);
    for (const b of i.byCause) out.push(`  ${b.category} ${b.cause}: ${b.count} ${ids(b.userIds, b.count)}\n      e.g. ${b.example}`);
    if (i.persisted) {
      const p = i.persisted;
      out.push(`  saved matches ${p.matches} · for now-unsearchable candidates ${p.matchesForUnsearchable} (re-gated on read) · PROFILE-source ${p.profileSourceMatches} · sessions with duplicate ids ${p.sessionsWithDuplicateIds} · score-tie groups ${p.scoreTieGroups}`);
    }
    out.push("  sync jobs: none exist — search reads live tables, so there is no pending / failed sync queue to report.");
  }

  if (r.dataQuality) {
    const d = r.dataQuality;
    out.push("", `DATA QUALITY (${d.scope === "profiles" ? "every candidate profile" : "searchable candidates only"}) — never a search verdict`);
    out.push(`  Healthy ${d.healthy} · Warnings ${d.warnings} · Invalid ${d.invalid} · of ${d.profiles}`);
    for (const rule of d.rules.slice(0, opts.verbose ? 50 : 20)) {
      out.push(`  [${rule.severity}] ${rule.rule}: ${rule.count} — ${rule.example} ${ids(rule.userIds.slice(0, 8), rule.count)}`);
    }
    for (const g of d.duplicateAccounts) out.push(`  DUPLICATE_ACCOUNT by ${g.kind}: ${g.groups} group(s) ${ids(g.userIds.slice(0, 8))}`);
    if (d.orphanCollegeRefs) out.push(`  orphan College references: ${d.orphanCollegeRefs.count} ${ids(d.orphanCollegeRefs.userIds)}`);
  }

  if (r.normalization) {
    out.push("", "NORMALIZATION");
    for (const e of r.normalization.entities) {
      out.push(`  ${e.entity} — ${e.distinct} distinct value(s), ${e.clusters.length} multi-spelling cluster(s)${e.searchImpact ? " · AFFECTS SEARCH" : ""}`);
      if (e.note) out.push(`      ${e.note}`);
      for (const c of e.clusters.slice(0, opts.verbose ? 40 : 8)) {
        out.push(`      ${c.safety.padEnd(9)} ${c.canonical} ← ${c.variants.map((v) => `"${v.raw}" ${v.count}`).join(", ")}`);
      }
    }
  }

  const p = r.performance;
  out.push("", "PERFORMANCE");
  out.push(`  searchCandidates latency: p50 ${p.searchLatencyMs.p50 ?? "—"}ms · p95 ${p.searchLatencyMs.p95 ?? "—"}ms · p99 ${p.searchLatencyMs.p99 ?? "—"}ms (${p.searchLatencyMs.samples} calls)`);
  if (p.poolLoadMs.length) out.push(`  pool load: ${p.poolLoadMs.map((t) => `${t.slug} ${t.ms}ms/${t.count}`).join(" · ")}`);
  if (p.canonicalBatchMs.batches) out.push(`  canonical DB batches: p50 ${p.canonicalBatchMs.p50}ms · p95 ${p.canonicalBatchMs.p95}ms · ${p.canonicalBatchMs.batches} batches / ${p.canonicalBatchMs.rows} rows`);
  if (p.slowestCases.length) out.push(`  slowest in-memory evaluations: ${p.slowestCases.map((s) => `${s.id} ${s.ms}ms`).join(" · ")}`);

  const blocking = r.findings.filter((f) => f.searchVerdict === "FAIL" && !f.productDecision && f.severity !== "INFO");
  const decisions = r.findings.filter((f) => f.productDecision);
  out.push("", "FINDINGS THAT FAIL RECRUITER SEARCH");
  out.push(...(blocking.length ? dedupeFindings(blocking).map(findingLine) : ["  none"]));
  out.push("", "PRODUCT DECISIONS REQUIRED");
  out.push(...(decisions.length ? dedupeFindings(decisions).map(findingLine) : ["  none"]));

  const pinned = [...new Set(r.findings.map((f) => f.knownIssue).filter((x): x is keyof typeof KNOWN_ISSUES => Boolean(x)))];
  if (pinned.length) {
    out.push("", "KNOWN ISSUES OBSERVED IN THIS DATA");
    for (const id of pinned) out.push(`  ${id} [${KNOWN_ISSUES[id].severity}] ${KNOWN_ISSUES[id].title} — ${KNOWN_ISSUES[id].location}`);
  }

  out.push("", `OVERALL STATUS: ${r.readiness.readiness.replace(/_/g, " ")}`);
  for (const reason of r.readiness.reasons) out.push(`  - ${reason}`);
  return out.join("\n");
}

/** Case-level findings repeat per case; the summary lists each (category, cause, issue) once with the widest reach. */
function dedupeFindings(list: QaFinding[]): QaFinding[] {
  const best = new Map<string, QaFinding & { cases: number }>();
  for (const f of list) {
    const key = `${f.category}|${String(f.detail?.cause ?? f.check)}|${f.knownIssue ?? ""}`;
    const cur = best.get(key);
    if (!cur) best.set(key, { ...f, cases: 1 });
    else {
      cur.cases += 1;
      if (f.affected > cur.affected) Object.assign(cur, f, { cases: cur.cases });
    }
  }
  return [...best.values()]
    .sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || b.affected - a.affected)
    .map((f) => ({ ...f, message: f.cases > 1 ? `${f.message} (seen in ${f.cases} checks)` : f.message }));
}

function sevRank(s: string): number {
  return s === "CRITICAL" ? 3 : s === "ERROR" ? 2 : s === "WARNING" ? 1 : 0;
}
