import "server-only";
import type { ResumeImportStatus } from "@prisma/client";
import {
  countImportsByStatus,
  countImportsMatched,
  importUsageTotals,
  isWorkerLeaseLive,
  listImports,
  type ImportUsageTotals,
} from "@/repositories/resume-import";

/**
 * What the admin résumé-import page shows (plan 154). Plain module, NOT a
 * "use server" file: an exported function there becomes a callable action, and
 * this one has no guard of its own — callers (the page, the polled action)
 * check `requireAdmin` / `getAdminContext` first.
 *
 * Never includes the parsed document or the analysis.
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
};

export async function loadImportStatus(input: {
  status?: ResumeImportStatus;
  cursor?: string;
  search?: string;
  date?: string;
}): Promise<ImportStatusView> {
  const filters = {
    status: input.status,
    search: input.search,
    date: input.date,
  };
  const [list, counts, matchedTotal, usage, workerRunning] = await Promise.all([
    listImports({
      ...filters,
      cursor: input.cursor,
      take: 100,
    }),
    countImportsByStatus(),
    countImportsMatched(filters),
    importUsageTotals(),
    isWorkerLeaseLive(),
  ]);
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
    })),
    nextCursor: list.nextCursor,
    counts,
    matchedTotal,
    usage,
    workerRunning,
  };
}
