import "server-only";
import type { ResumeImportStatus } from "@prisma/client";
import {
  batchClaimStats,
  countImportsByStatus,
  countImportsMatched,
  countUnenrolledRegisteredImports,
  getCompletenessInputs,
  getOutreachForImports,
  importIdsForOutreachFilter,
  importUsageTotals,
  isWorkerLeaseLive,
  listBatchLabels,
  listImports,
  outreachFunnel,
  type ImportListRow,
  type ImportUsageTotals,
  type OutreachFilter,
  type OutreachFunnel,
  type OutreachRowSummary,
} from "@/repositories/resume-import";
import {
  profileCompleteness,
  type CompletenessKey,
} from "@/features/resume/import/outreach-steps";
import { isOutreachEnabled } from "@/features/resume/import/outreach";

/**
 * What the admin résumé-import page shows (plan 154). Plain module, NOT a
 * "use server" file: an exported function there becomes a callable action, and
 * this one has no guard of its own — callers (the page, the polled action)
 * check `requireAdmin` / `getAdminContext` first.
 *
 * Never includes the parsed document or the analysis.
 *
 * Plan 171 adds the claim-and-complete email state: a funnel, a per-row
 * outreach label, outreach and batch filters, and the backfill count.
 */

/** The attestation an admin confirms before registering imported students. */
export const CONSENT_ATTESTATION =
  "These students agreed to ABTalks creating their profile from their résumé and showing it to recruiters.";

export type ImportRowView = {
  id: string;
  originalFilename: string;
  email: string | null;
  emailCandidates: string[];
  status: ResumeImportStatus;
  registerRequested: boolean;
  attempts: number;
  lastError: string | null;
  overallScore: number | null;
  costMicroUsd: number;
  linkedExisting: boolean;
  createdAtIso: string;
  /** Admin-gated file route when a blob is stored. Never a blob pathname. */
  downloadHref: string | null;
  /** Plan 171. */
  batchLabel: string | null;
  /** Plan 171: the email sequence in one line, or null when not applicable. */
  outreachLabel: string | null;
};

export type ImportStatusView = {
  rows: ImportRowView[];
  nextCursor: string | null;
  /** All-time status totals — drives summary cards and Parse/Register-all labels. */
  counts: Record<ResumeImportStatus, number>;
  /** Rows matching the active status / search / date filters (all pages). */
  matchedTotal: number;
  usage: ImportUsageTotals;
  workerRunning: boolean;
  /** Plan 171. */
  outreach: {
    enabled: boolean;
    funnel: OutreachFunnel;
    /** REGISTERED imports with no email sequence yet (the backfill button). */
    unenrolled: number;
    batchLabels: string[];
    /** Claim rate for the selected batch, when one is selected. */
    batch: { label: string; registered: number; claimed: number } | null;
  };
};

export type ImportStatusQuery = {
  status?: ResumeImportStatus;
  cursor?: string;
  search?: string;
  date?: string;
  /** Plan 171. */
  outreach?: OutreachFilter;
  batchLabel?: string;
};

const MISSING_SHORT: Record<CompletenessKey, string> = {
  phone: "phone",
  education: "education",
  experience: "experience",
  skills: "skills",
  links: "GitHub/LinkedIn",
};

type CompletenessSource = Awaited<ReturnType<typeof getCompletenessInputs>> extends Map<string, infer V>
  ? V
  : never;

function completenessText(source: CompletenessSource | undefined): string {
  if (!source) return "";
  const c = profileCompleteness(source);
  return c.missing.length === 0
    ? ` · ${c.percent}%`
    : ` · ${c.percent}% · missing: ${c.missing.map((k) => MISSING_SHORT[k]).join(", ")}`;
}

const NEXT_EMAIL_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
});

/** " · next email 10 Oct", or " · next email due" once the date has passed. */
function nextEmailText(o: OutreachRowSummary, now: Date): string {
  if (o.stage === "STOPPED" || !o.nextSendAt) return "";
  return o.nextSendAt.getTime() <= now.getTime()
    ? " · next email due"
    : ` · next email ${NEXT_EMAIL_DATE.format(o.nextSendAt)}`;
}

/** One line for the admin table. Pure apart from its inputs. */
export function outreachLabelFor(
  status: ResumeImportStatus,
  o: OutreachRowSummary | undefined,
  completeness: CompletenessSource | undefined,
  now: Date = new Date(),
): string | null {
  if (!o) return status === "REGISTERED" ? "Not invited yet" : null;
  if (o.stage === "INVITE") {
    if (o.sentCount === 0) return "Invite queued";
    return `Invited · ${o.step} of 2 sent · ${o.firstClickAt ? "clicked, not claimed" : "not clicked"}${nextEmailText(o, now)}`;
  }
  if (o.stage === "ONBOARD") return `Claimed${completenessText(completeness)}${nextEmailText(o, now)}`;
  switch (o.stopReason) {
    case "COMPLETE":
      return "Completed";
    case "FINISHED_SEQUENCE":
      return `Claimed${completenessText(completeness)} · emails done`;
    case "NO_RESPONSE":
      return o.firstClickAt ? "No response (clicked)" : "No response";
    case "REMOVED":
      return "Removed their data";
    case "BOUNCED":
      return "Bounced";
    case "UNSUBSCRIBED":
      return "Stopped (spam report)";
    default:
      return "Emails stopped";
  }
}

export async function rowsWithOutreach(rows: ImportListRow[]): Promise<{
  outreach: Map<string, OutreachRowSummary>;
  completeness: Map<string, CompletenessSource>;
}> {
  const outreach = await getOutreachForImports(rows.map((r) => r.id));
  const userIds = rows
    .filter((r) => r.registeredUserId && outreach.has(r.id))
    .map((r) => r.registeredUserId as string);
  const completeness = await getCompletenessInputs(userIds);
  return { outreach, completeness };
}

export async function loadImportStatus(input: ImportStatusQuery): Promise<ImportStatusView> {
  const importIds = input.outreach ? await importIdsForOutreachFilter(input.outreach) : undefined;
  const filters = {
    status: input.status,
    search: input.search,
    date: input.date,
    batchLabel: input.batchLabel,
    importIds,
  };
  const [list, counts, matchedTotal, usage, workerRunning, funnel, unenrolled, batchLabels, batch] =
    await Promise.all([
      listImports({
        ...filters,
        cursor: input.cursor,
        take: 100,
        byScore: input.outreach === "CLICKED_NOT_CLAIMED",
      }),
      countImportsByStatus(),
      countImportsMatched(filters),
      importUsageTotals(),
      isWorkerLeaseLive(),
      outreachFunnel(),
      countUnenrolledRegisteredImports(),
      listBatchLabels(),
      input.batchLabel ? batchClaimStats(input.batchLabel) : Promise.resolve(null),
    ]);
  const { outreach, completeness } = await rowsWithOutreach(list.rows);
  return {
    rows: list.rows.map((r) => ({
      id: r.id,
      originalFilename: r.originalFilename,
      email: r.normalizedEmail ?? r.sourceEmail,
      emailCandidates: r.emailCandidates,
      status: r.status,
      registerRequested: r.registerRequested,
      attempts: r.attempts,
      lastError: r.lastError,
      overallScore: r.overallScore,
      costMicroUsd: r.costMicroUsd,
      linkedExisting: r.linkedExisting,
      createdAtIso: r.createdAt.toISOString(),
      downloadHref: r.hasFile
        ? `/api/admin/resume-imports/${r.id}/file`
        : null,
      batchLabel: r.batchLabel,
      outreachLabel: outreachLabelFor(
        r.status,
        outreach.get(r.id),
        r.registeredUserId ? completeness.get(r.registeredUserId) : undefined,
      ),
    })),
    nextCursor: list.nextCursor,
    counts,
    matchedTotal,
    usage,
    workerRunning,
    outreach: {
      enabled: isOutreachEnabled(),
      funnel,
      unenrolled,
      batchLabels,
      batch: input.batchLabel && batch ? { label: input.batchLabel, ...batch } : null,
    },
  };
}
