/**
 * Recruiter search audits — READ-ONLY against whatever database the env points at.
 *
 *   npm run audit:recruiter-search [-- --profile=production] [--lite] [--json=out.json] [--verbose]
 *   npm run audit:search-index     [-- --profile=production]
 *   npm run audit:candidate-data   [-- --batch=500]
 *   npm run audit:search-explain   -- --user=<userId> [--skills=React,Node.js] [--city=Pune]
 *                                     [--work-mode=REMOTE] [--employment=INTERNSHIP] [--open-to-work]
 *                                     [--salary-max=1000000] [--notice=30] [--tracks=PROFILE,HACKATHON]
 *                                     [--min-days=30] [--profile=production]
 *
 * Exit codes: 0 READY / READY WITH WARNINGS, 2 NOT READY, 1 the audit itself failed.
 * The session is forced read-only by ./read-only-env (imported first on purpose).
 */
import { assumedFlags, databaseHost } from "./read-only-env";

import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import {
  explainCandidate,
  runRecruiterSearchAudit,
  SEARCH_SECTIONS,
  type AuditSection,
} from "@/features/search-qa/audit";
import type { AppliedFilter } from "@/features/search-qa/filter-registry";
import { formatAuditReport } from "@/features/search-qa/report";

const argv = process.argv.slice(2);
const command = argv[0] ?? "search";
const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const has = (name: string) => argv.includes(`--${name}`);

async function assertReadOnly(): Promise<void> {
  const rows = await prisma.$queryRaw<{ default_transaction_read_only: string }[]>`SHOW default_transaction_read_only`;
  if (rows[0]?.default_transaction_read_only !== "on") {
    throw new Error("Refusing to run: the database session is not read-only.");
  }
}

async function main(): Promise<number> {
  await assertReadOnly();
  console.log(`search-qa · ${command} · database ${databaseHost} · read-only session verified`);
  if (assumedFlags.length) console.log(`search-qa · --profile=production assumed: ${assumedFlags.join(", ")}`);

  if (command === "explain") {
    const userId = flag("user");
    if (!userId) throw new Error("--user=<userId> is required");
    const filters: AppliedFilter[] = [];
    const skills = flag("skills");
    if (skills) filters.push({ id: "mustHaveStack", value: skills.split(",").map((s) => s.trim()).filter(Boolean) });
    if (flag("city")) filters.push({ id: "locationCity", value: flag("city")! });
    if (flag("work-mode")) filters.push({ id: "workMode", value: flag("work-mode")!.toUpperCase() });
    if (flag("employment")) filters.push({ id: "employmentType", value: flag("employment")!.toUpperCase() });
    if (has("open-to-work")) filters.push({ id: "openToWork", value: true });
    if (flag("salary-max")) filters.push({ id: "salaryMax", value: Number(flag("salary-max")) });
    if (flag("notice")) filters.push({ id: "noticePeriodDays", value: Number(flag("notice")) });
    const result = await explainCandidate({
      userId,
      filters,
      tracks: flag("tracks")?.split(",").filter(Boolean),
      minEvidenceDays: flag("min-days") ? Number(flag("min-days")) : 0,
    });
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n${result.summary}`);
    return 0;
  }

  const sections: AuditSection[] =
    command === "index"
      ? ["coverage", "index"]
      : command === "data"
        ? ["data", "normalization"]
        : command === "all"
          ? [...SEARCH_SECTIONS, "index", "data", "normalization"]
          : [...SEARCH_SECTIONS, "index"];

  const report = await runRecruiterSearchAudit({
    sections,
    batchSize: flag("batch") ? Number(flag("batch")) : undefined,
    seed: flag("seed") ? Number(flag("seed")) : undefined,
    randomCount: flag("random") ? Number(flag("random")) : undefined,
    latencyRounds: flag("rounds") ? Number(flag("rounds")) : undefined,
    lite: has("lite"),
    onProgress: (m) => console.log(`  … ${m}`),
  });
  if (assumedFlags.length) report.environment.notes.unshift(`--profile=production assumed ${assumedFlags.join(", ")}`);

  console.log("");
  console.log(formatAuditReport(report, { verbose: has("verbose") }));
  const json = flag("json");
  if (json) {
    writeFileSync(json, JSON.stringify(report, null, 2));
    console.log(`\nfull report written to ${json}`);
  }
  return report.readiness.readiness === "NOT_READY" ? 2 : 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (error) => {
    console.log(`search-qa failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    await prisma.$disconnect();
    process.exit(1);
  });
