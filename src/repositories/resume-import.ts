import "server-only";
import { Prisma, type ResumeImportStatus } from "@prisma/client";
import { prisma, writeClient } from "@/lib/db";
import {
  RESUME_DOCUMENT_VERSION,
  readResumeAnalysis,
  readResumeDocument,
  resumeAnalysisSchema,
  resumeDocumentSchema,
} from "@/features/resume/document";
import type { ParsedResume, ResumeAnalysis } from "@/features/resume/types";

/**
 * The only reader and writer of `ResumeImport` (plan 154).
 *
 * The table is also the job queue: `status` says what a row is waiting for,
 * `nextAttemptAt` when it may run, `leaseUntil` who holds it. Leasing uses
 * `FOR UPDATE SKIP LOCKED`, so two workers can never take the same row, and a
 * worker that dies simply lets its leases expire (`requeueStale`).
 */

const LEASE_MS = 5 * 60_000;

/* ─── Upload ─────────────────────────────────────────────────────────────── */

export async function findImportByHash(
  contentHash: string,
): Promise<{ id: string; status: ResumeImportStatus } | null> {
  return prisma.resumeImport.findUnique({
    where: { contentHash },
    select: { id: true, status: true },
  });
}

/**
 * Create the import, or return the existing one for these bytes. A concurrent
 * upload of the same file loses the unique race and reads the winner.
 */
export async function createOrGetImport(input: {
  contentHash: string;
  originalFilename: string;
  fileSizeBytes: number;
  blobPathname: string;
  uploadedByUserId: string;
  /** Plan 171: the batch / college the admin named at upload. */
  batchLabel?: string | null;
}): Promise<{ id: string; duplicate: boolean }> {
  const existing = await findImportByHash(input.contentHash);
  if (existing) return { id: existing.id, duplicate: true };
  try {
    const row = await writeClient().resumeImport.create({
      data: input,
      select: { id: true },
    });
    return { id: row.id, duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await findImportByHash(input.contentHash);
      if (winner) return { id: winner.id, duplicate: true };
    }
    throw error;
  }
}

/* ─── Admin requests ─────────────────────────────────────────────────────── */

export type Selection = { ids: string[] } | { all: true };

function selectionWhere(sel: Selection): Prisma.ResumeImportWhereInput {
  return "ids" in sel ? { id: { in: sel.ids } } : {};
}

/**
 * Hard-delete import rows. Returns blob pathnames to clean up from storage and
 * user IDs of stub accounts that were created by the import but have no linked
 * Account (i.e. the student never signed in via Google), so the caller can
 * optionally delete those users too.
 *
 * CLAIMED rows are skipped — the student already signed in and owns the account.
 */
export async function deleteImports(sel: Selection): Promise<{
  deleted: number;
  blobPathnames: string[];
  stubUserIds: string[];
}> {
  const db = writeClient();

  // Fetch rows before deletion so we can return pathnames / user ids.
  const rows = await db.resumeImport.findMany({
    where: {
      ...selectionWhere(sel),
      // Never auto-delete a CLAIMED row — the student is a real user.
      status: { not: "CLAIMED" },
    },
    select: {
      id: true,
      blobPathname: true,
      registeredUserId: true,
    },
  });

  if (rows.length === 0) return { deleted: 0, blobPathnames: [], stubUserIds: [] };

  const ids = rows.map((r) => r.id);

  // Collect candidate stub user IDs (only REGISTERED imports have a userId).
  const candidateUserIds = [...new Set(
    rows.map((r) => r.registeredUserId).filter((id): id is string => id !== null),
  )];

  // Of those, only keep users with no linked Account (never signed in via Google).
  let stubUserIds: string[] = [];
  if (candidateUserIds.length > 0) {
    const stubs = await db.user.findMany({
      where: {
        id: { in: candidateUserIds },
        accounts: { none: {} },
      },
      select: { id: true },
    });
    stubUserIds = stubs.map((u) => u.id);
  }

  // Delete the import rows.
  const { count } = await db.resumeImport.deleteMany({ where: { id: { in: ids } } });

  const blobPathnames = rows
    .map((r) => r.blobPathname)
    .filter((p): p is string => p !== null);

  return { deleted: count, blobPathnames, stubUserIds };
}

/** UPLOADED / FAILED → QUEUED. `register` also asks for registration after the parse. */
export async function queueImports(
  sel: Selection,
  register: boolean,
  adminUserId: string,
): Promise<number> {
  const res = await writeClient().resumeImport.updateMany({
    where: { ...selectionWhere(sel), status: { in: ["UPLOADED", "FAILED"] } },
    data: {
      status: "QUEUED",
      nextAttemptAt: null,
      leaseUntil: null,
      lastError: null,
      attempts: 0,
      ...(register ? { registerRequested: true, registeredByUserId: adminUserId } : {}),
    },
  });
  return res.count;
}

/** FAILED → QUEUED with a fresh attempt budget. */
export async function retryFailedImports(sel: Selection): Promise<number> {
  const res = await writeClient().resumeImport.updateMany({
    where: { ...selectionWhere(sel), status: "FAILED" },
    data: { status: "QUEUED", attempts: 0, nextAttemptAt: null, leaseUntil: null, lastError: null },
  });
  return res.count;
}

/** Mark PARSED rows for registration; the worker does the work. */
export async function requestRegistration(sel: Selection, adminUserId: string): Promise<number> {
  const res = await writeClient().resumeImport.updateMany({
    where: { ...selectionWhere(sel), status: "PARSED" },
    data: { registerRequested: true, registeredByUserId: adminUserId, lastError: null },
  });
  return res.count;
}

export type ResolveEmailResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_reviewable" | "duplicate" };

/** NEEDS_REVIEW (with a parsed document) → PARSED under the admin's chosen email. */
export async function resolveImportEmail(id: string, email: string): Promise<ResolveEmailResult> {
  const row = await prisma.resumeImport.findUnique({
    where: { id },
    select: { status: true, parsedData: true },
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "NEEDS_REVIEW" || row.parsedData === null) {
    return { ok: false, reason: "not_reviewable" };
  }
  try {
    await writeClient().resumeImport.update({
      where: { id },
      data: { status: "PARSED", normalizedEmail: email, lastError: null },
      select: { id: true },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }
}

/* ─── Admin reads ────────────────────────────────────────────────────────── */

export type ImportListRow = {
  id: string;
  originalFilename: string;
  sourceEmail: string | null;
  normalizedEmail: string | null;
  emailCandidates: string[];
  status: ResumeImportStatus;
  registerRequested: boolean;
  attempts: number;
  lastError: string | null;
  overallScore: number | null;
  costMicroUsd: number;
  linkedExisting: boolean;
  createdAt: Date;
  /** True when a private blob pathname is stored. Never expose the pathname. */
  hasFile: boolean;
  /** Plan 171. */
  batchLabel: string | null;
  registeredUserId: string | null;
};

type ImportListFilters = {
  status?: ResumeImportStatus;
  /** Matches file name or email, case-insensitive. */
  search?: string;
  /** `YYYY-MM-DD`: only imports created on that day in IST. */
  date?: string;
  /** Plan 171: exact batch label. */
  batchLabel?: string;
  /** Plan 171: restrict to these import ids (an outreach filter's result). */
  importIds?: string[];
};

/** Shared where clause for list + matched count (plan 172). */
function importListWhere(input: ImportListFilters): Prisma.ResumeImportWhereInput {
  const search = input.search?.trim();
  const dayStart = input.date ? new Date(`${input.date}T00:00:00+05:30`) : null;
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(search
      ? {
          OR: [
            { originalFilename: { contains: search, mode: "insensitive" as const } },
            { normalizedEmail: { contains: search, mode: "insensitive" as const } },
            { sourceEmail: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(dayStart
      ? {
          createdAt: {
            gte: dayStart,
            lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
          },
        }
      : {}),
    ...(input.batchLabel ? { batchLabel: input.batchLabel } : {}),
    ...(input.importIds ? { id: { in: input.importIds } } : {}),
  };
}

export async function listImports(
  input: ImportListFilters & {
    cursor?: string;
    take?: number;
    /** Plan 171: strongest profiles first (the "clicked, not claimed" list). */
    byScore?: boolean;
  },
): Promise<{ rows: ImportListRow[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(input.take ?? 100, 1), 200);
  const rows = await prisma.resumeImport.findMany({
    where: importListWhere(input),
    orderBy: input.byScore
      ? [{ overallScore: { sort: "desc", nulls: "last" } }, { id: "desc" }]
      : [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      originalFilename: true,
      sourceEmail: true,
      normalizedEmail: true,
      emailCandidates: true,
      status: true,
      registerRequested: true,
      attempts: true,
      lastError: true,
      overallScore: true,
      costMicroUsd: true,
      linkedExisting: true,
      createdAt: true,
      blobPathname: true,
      batchLabel: true,
      registeredUserId: true,
    },
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return {
    rows: page.map(({ blobPathname, ...row }) => ({
      ...row,
      hasFile: blobPathname != null && blobPathname.length > 0,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/** How many imports match the same filters as `listImports` (across all pages). */
export async function countImportsMatched(input: ImportListFilters): Promise<number> {
  return prisma.resumeImport.count({ where: importListWhere(input) });
}

/**
 * Resolve a stored import PDF for an admin download. Pathname stays
 * server-side — callers never pass or receive a blob path from the client.
 */
export async function getImportFilePath(
  importId: string,
): Promise<{ pathname: string; fileName: string } | null> {
  const row = await prisma.resumeImport.findUnique({
    where: { id: importId },
    select: { blobPathname: true, originalFilename: true },
  });
  if (!row?.blobPathname) return null;
  return { pathname: row.blobPathname, fileName: row.originalFilename };
}

export async function countImportsByStatus(): Promise<Record<ResumeImportStatus, number>> {
  const groups = await prisma.resumeImport.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<ResumeImportStatus, number> = {
    UPLOADED: 0,
    QUEUED: 0,
    PROCESSING: 0,
    PARSED: 0,
    NEEDS_REVIEW: 0,
    FAILED: 0,
    REGISTERED: 0,
    CLAIMED: 0,
  };
  for (const g of groups) out[g.status] = g._count._all;
  return out;
}

export type ImportUsageTotals = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costMicroUsd: number;
  rateLimitedLastHour: number;
  parsedLastHour: number;
};

/** Actual usage of the import path, from `ResumeParseUsage`. */
export async function importUsageTotals(now: Date = new Date()): Promise<ImportUsageTotals> {
  const hourAgo = new Date(now.getTime() - 60 * 60_000);
  const [sum, limited, parsed] = await Promise.all([
    prisma.resumeParseUsage.aggregate({
      where: { source: "IMPORT" },
      _count: { _all: true },
      _sum: { promptTokens: true, completionTokens: true, costMicroUsd: true },
    }),
    prisma.resumeParseUsage.count({
      where: { source: "IMPORT", outcome: "rate_limited", createdAt: { gte: hourAgo } },
    }),
    prisma.resumeImport.count({ where: { parsedAt: { gte: hourAgo } } }),
  ]);
  return {
    calls: sum._count._all,
    promptTokens: sum._sum.promptTokens ?? 0,
    completionTokens: sum._sum.completionTokens ?? 0,
    costMicroUsd: sum._sum.costMicroUsd ?? 0,
    rateLimitedLastHour: limited,
    parsedLastHour: parsed,
  };
}

/** Anything a worker could do right now or soon. */
export async function hasPendingImportWork(): Promise<boolean> {
  const n = await prisma.resumeImport.count({
    where: {
      OR: [
        { status: { in: ["QUEUED", "PROCESSING"] } },
        { status: "PARSED", registerRequested: true },
      ],
    },
  });
  return n > 0;
}

/* ─── Worker: leasing ────────────────────────────────────────────────────── */

export type LeasedParseJob = {
  id: string;
  blobPathname: string | null;
  originalFilename: string;
  attempts: number;
  registerRequested: boolean;
};

/** Take up to `n` due QUEUED rows. Each is PROCESSING with a 5-minute lease. */
export async function leaseParseJobs(n: number): Promise<LeasedParseJob[]> {
  if (n <= 0) return [];
  return writeClient().$queryRaw<LeasedParseJob[]>`
    UPDATE "ResumeImport"
       SET "status" = 'PROCESSING',
           "leaseUntil" = now() + (${LEASE_MS}::int * interval '1 millisecond'),
           "attempts" = "attempts" + 1,
           "updatedAt" = now()
     WHERE "id" IN (
       SELECT "id" FROM "ResumeImport"
        WHERE "status" = 'QUEUED'
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now())
        ORDER BY "createdAt"
        LIMIT ${n}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING "id", "blobPathname", "originalFilename", "attempts", "registerRequested"`;
}

/** Take up to `n` PARSED rows waiting for registration. The lease is the lock. */
export async function leaseRegisterJobs(n: number): Promise<{ id: string }[]> {
  if (n <= 0) return [];
  return writeClient().$queryRaw<{ id: string }[]>`
    UPDATE "ResumeImport"
       SET "leaseUntil" = now() + (${LEASE_MS}::int * interval '1 millisecond'),
           "updatedAt" = now()
     WHERE "id" IN (
       SELECT "id" FROM "ResumeImport"
        WHERE "status" = 'PARSED'
          AND "registerRequested" = true
          AND ("leaseUntil" IS NULL OR "leaseUntil" < now())
        ORDER BY "createdAt"
        LIMIT ${n}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING "id"`;
}

/** Leases whose worker died: PROCESSING goes back to QUEUED, PARSED is unlocked. */
export async function requeueStaleImports(): Promise<number> {
  const db = writeClient();
  const processing = await db.resumeImport.updateMany({
    where: { status: "PROCESSING", leaseUntil: { lt: new Date() } },
    data: { status: "QUEUED", leaseUntil: null },
  });
  await db.resumeImport.updateMany({
    where: { status: { not: "PROCESSING" }, leaseUntil: { lt: new Date() } },
    data: { leaseUntil: null },
  });
  return processing.count;
}

/* ─── Worker: outcomes ───────────────────────────────────────────────────── */

export async function addImportUsage(
  id: string,
  usage: { promptTokens: number; completionTokens: number; costMicroUsd: number; model: string },
): Promise<void> {
  await writeClient().resumeImport.update({
    where: { id },
    data: {
      promptTokens: { increment: usage.promptTokens },
      completionTokens: { increment: usage.completionTokens },
      costMicroUsd: { increment: usage.costMicroUsd },
      model: usage.model,
    },
    select: { id: true },
  });
}

function documentData(parsed: ParsedResume, analysis: ResumeAnalysis) {
  return {
    documentVersion: RESUME_DOCUMENT_VERSION,
    parsedData: resumeDocumentSchema.parse(parsed) as Prisma.InputJsonValue,
    analysis: resumeAnalysisSchema.parse(analysis) as Prisma.InputJsonValue,
    overallScore: analysis.overallScore,
    parsedAt: new Date(),
  };
}

/**
 * PARSED with a single email. If another open import already holds that email,
 * the partial unique index refuses it and the row goes to NEEDS_REVIEW instead —
 * the document is kept either way.
 */
export async function markImportParsed(
  id: string,
  input: {
    parsed: ParsedResume;
    analysis: ResumeAnalysis;
    sourceEmail: string;
    normalizedEmail: string;
    emailCandidates: string[];
  },
): Promise<"PARSED" | "NEEDS_REVIEW"> {
  const doc = documentData(input.parsed, input.analysis);
  const base = {
    ...doc,
    sourceEmail: input.sourceEmail,
    emailCandidates: input.emailCandidates,
    leaseUntil: null,
    nextAttemptAt: null,
  };
  try {
    await writeClient().resumeImport.update({
      where: { id },
      data: { ...base, status: "PARSED", normalizedEmail: input.normalizedEmail, lastError: null },
      select: { id: true },
    });
    return "PARSED";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await writeClient().resumeImport.update({
        where: { id },
        data: {
          ...base,
          status: "NEEDS_REVIEW",
          normalizedEmail: input.normalizedEmail,
          lastError: "Another import already uses this email.",
        },
        select: { id: true },
      });
      return "NEEDS_REVIEW";
    }
    throw error;
  }
}

/** NEEDS_REVIEW, keeping the parsed document so the admin can resolve it. */
export async function markImportNeedsReview(
  id: string,
  input: {
    reason: string;
    parsed?: ParsedResume;
    analysis?: ResumeAnalysis;
    sourceEmail?: string | null;
    emailCandidates?: string[];
  },
): Promise<void> {
  await writeClient().resumeImport.update({
    where: { id },
    data: {
      ...(input.parsed && input.analysis ? documentData(input.parsed, input.analysis) : {}),
      ...(input.sourceEmail !== undefined ? { sourceEmail: input.sourceEmail } : {}),
      ...(input.emailCandidates ? { emailCandidates: input.emailCandidates } : {}),
      status: "NEEDS_REVIEW",
      lastError: input.reason,
      leaseUntil: null,
      nextAttemptAt: null,
    },
    select: { id: true },
  });
}

/** Back to QUEUED, due at `at`. The lease is released so the slot frees now. */
export async function markImportRetry(id: string, at: Date, lastError: string): Promise<void> {
  await writeClient().resumeImport.update({
    where: { id },
    data: { status: "QUEUED", nextAttemptAt: at, leaseUntil: null, lastError },
    select: { id: true },
  });
}

export async function markImportFailed(id: string, lastError: string): Promise<void> {
  await writeClient().resumeImport.update({
    where: { id },
    data: { status: "FAILED", leaseUntil: null, nextAttemptAt: null, lastError },
    select: { id: true },
  });
}

/* ─── Registration / claim reads ─────────────────────────────────────────── */

export type ImportForRegistration = {
  id: string;
  status: ResumeImportStatus;
  normalizedEmail: string | null;
  originalFilename: string;
  fileSizeBytes: number;
  contentHash: string;
  blobPathname: string | null;
  parsedData: ParsedResume | null;
  analysis: ResumeAnalysis | null;
  overallScore: number | null;
  parsedAt: Date | null;
};

export async function getImportForRegistration(id: string): Promise<ImportForRegistration | null> {
  const row = await prisma.resumeImport.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      normalizedEmail: true,
      originalFilename: true,
      fileSizeBytes: true,
      contentHash: true,
      blobPathname: true,
      parsedData: true,
      analysis: true,
      overallScore: true,
      parsedAt: true,
      documentVersion: true,
    },
  });
  if (!row) return null;
  const { documentVersion, parsedData, analysis, ...rest } = row;
  return {
    ...rest,
    parsedData: readResumeDocument(parsedData, documentVersion),
    analysis: readResumeAnalysis(analysis),
  };
}

/* ─── The single-worker lease ────────────────────────────────────────────── */

/**
 * One `PlatformConfig` row holds the worker lease: `stringValue` is the ISO
 * expiry. Acquire / renew / release are compare-and-set on that value, so a
 * worker can only renew or release the lease it wrote. ISO-8601 UTC strings
 * compare correctly as text.
 */
const WORKER_LEASE_KEY = "resume_import.worker_lease";
const EPOCH_ISO = new Date(0).toISOString();

export async function acquireWorkerLease(ms: number): Promise<string | null> {
  const db = writeClient();
  const now = new Date();
  const expiry = new Date(now.getTime() + ms).toISOString();
  const res = await db.platformConfig.updateMany({
    where: {
      key: WORKER_LEASE_KEY,
      OR: [{ stringValue: null }, { stringValue: { lt: now.toISOString() } }],
    },
    data: { stringValue: expiry },
  });
  if (res.count === 1) return expiry;

  const exists = await db.platformConfig.findUnique({
    where: { key: WORKER_LEASE_KEY },
    select: { key: true },
  });
  if (exists) return null;
  try {
    await db.platformConfig.create({
      data: {
        key: WORKER_LEASE_KEY,
        stringValue: expiry,
        description:
          "Plan 154 résumé-import worker lease (ISO expiry). Managed by code; do not edit.",
      },
      select: { key: true },
    });
    return expiry;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

/** Extend a lease we hold. Returns the new token, or null if we lost it. */
export async function renewWorkerLease(token: string, ms: number): Promise<string | null> {
  const expiry = new Date(Date.now() + ms).toISOString();
  const res = await writeClient().platformConfig.updateMany({
    where: { key: WORKER_LEASE_KEY, stringValue: token },
    data: { stringValue: expiry },
  });
  return res.count === 1 ? expiry : null;
}

export async function releaseWorkerLease(token: string): Promise<void> {
  await writeClient().platformConfig.updateMany({
    where: { key: WORKER_LEASE_KEY, stringValue: token },
    data: { stringValue: EPOCH_ISO },
  });
}

export async function isWorkerLeaseLive(): Promise<boolean> {
  const row = await prisma.platformConfig.findUnique({
    where: { key: WORKER_LEASE_KEY },
    select: { stringValue: true },
  });
  return Boolean(row?.stringValue && row.stringValue > new Date().toISOString());
}

/* ─── Registration / claim writes ────────────────────────────────────────── */

/** Registration will not be retried automatically; the admin sees why. */
export async function clearRegisterRequest(id: string, lastError: string | null): Promise<void> {
  await writeClient().resumeImport.update({
    where: { id },
    data: { registerRequested: false, leaseUntil: null, lastError },
    select: { id: true },
  });
}

/**
 * PARSED → REGISTERED / CLAIMED inside the caller's transaction. Conditional on
 * the row still being PARSED, so two workers can never register it twice; the
 * caller rolls back when this returns false.
 */
export async function markImportRegisteredTx(
  tx: Prisma.TransactionClient,
  id: string,
  input: {
    status: "REGISTERED" | "CLAIMED";
    userId: string;
    linkedExisting: boolean;
    /** The document now lives in CandidateResume — drop the copy. */
    clearDocument: boolean;
  },
): Promise<boolean> {
  const now = new Date();
  const res = await tx.resumeImport.updateMany({
    where: { id, status: "PARSED" },
    data: {
      status: input.status,
      registeredUserId: input.userId,
      registeredAt: now,
      ...(input.status === "CLAIMED" ? { claimedAt: now } : {}),
      linkedExisting: input.linkedExisting,
      registerRequested: false,
      leaseUntil: null,
      lastError: null,
      ...(input.clearDocument ? { parsedData: Prisma.DbNull, analysis: Prisma.DbNull } : {}),
    },
  });
  return res.count === 1;
}

/** Is this user an admin-registered, not-yet-claimed import? */
export async function hasUnclaimedImportForUser(
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  const n = await db.resumeImport.count({
    where: { registeredUserId: userId, status: "REGISTERED" },
  });
  return n > 0;
}

/** REGISTERED → CLAIMED for this user. Returns how many rows moved (0 or 1). */
export async function claimRegisteredImportTx(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const res = await tx.resumeImport.updateMany({
    where: { registeredUserId: userId, status: "REGISTERED" },
    data: { status: "CLAIMED", claimedAt: new Date() },
  });
  return res.count;
}

/** The single PARSED (not yet registered) import for an email, if exactly one. */
export async function findParsedImportIdByEmail(email: string): Promise<string | null> {
  const rows = await prisma.resumeImport.findMany({
    where: { normalizedEmail: email, status: "PARSED" },
    select: { id: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0]!.id : null;
}

/** Of these users, which are admin-imported and not yet claimed (recruiter badge). */
export async function listUnclaimedImportUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.resumeImport.findMany({
    where: { registeredUserId: { in: userIds }, status: "REGISTERED" },
    select: { registeredUserId: true },
  });
  return new Set(rows.map((r) => r.registeredUserId).filter((id): id is string => id !== null));
}

/* ─── Outreach (plan 171) ────────────────────────────────────────────────── */

export type OutreachStage = "INVITE" | "ONBOARD" | "STOPPED";
export type OutreachStopReason =
  | "COMPLETE"
  | "FINISHED_SEQUENCE"
  | "NO_RESPONSE"
  | "UNSUBSCRIBED"
  | "REMOVED"
  | "BOUNCED"
  | "ADMIN";

/** Enter one import into the email sequence. Idempotent: never resets a row. */
export async function upsertOutreachEnrollment(importId: string, userId: string, now: Date): Promise<void> {
  await writeClient().resumeImportOutreach.upsert({
    where: { importId },
    create: { importId, userId, stage: "INVITE", step: 0, nextSendAt: now },
    update: {},
    select: { id: true },
  });
}

export type DueOutreachRow = {
  id: string;
  importId: string;
  userId: string;
  stage: OutreachStage;
  step: number;
  sentCount: number;
  failCount: number;
};

/** One import's sequence row, for sending its first email right after registration. */
export async function getOutreachRowByImportId(importId: string): Promise<DueOutreachRow | null> {
  return prisma.resumeImportOutreach.findUnique({
    where: { importId },
    select: {
      id: true,
      importId: true,
      userId: true,
      stage: true,
      step: true,
      sentCount: true,
      failCount: true,
    },
  });
}

export async function listDueOutreach(now: Date, limit: number): Promise<DueOutreachRow[]> {
  return prisma.resumeImportOutreach.findMany({
    where: { stage: { in: ["INVITE", "ONBOARD"] }, nextSendAt: { lte: now } },
    orderBy: [{ nextSendAt: "asc" }, { id: "asc" }],
    take: Math.max(0, Math.min(limit, 1000)),
    select: {
      id: true,
      importId: true,
      userId: true,
      stage: true,
      step: true,
      sentCount: true,
      failCount: true,
    },
  });
}

export type OutreachImportFacts = {
  status: ResumeImportStatus;
  registeredAt: Date | null;
  claimedAt: Date | null;
  linkedExisting: boolean;
  registeredUserId: string | null;
  normalizedEmail: string | null;
};

export async function getOutreachImportFacts(importId: string): Promise<OutreachImportFacts | null> {
  return prisma.resumeImport.findUnique({
    where: { id: importId },
    select: {
      status: true,
      registeredAt: true,
      claimedAt: true,
      linkedExisting: true,
      registeredUserId: true,
      normalizedEmail: true,
    },
  });
}

export type OutreachPerson = {
  email: string;
  name: string | null;
  deletedAt: Date | null;
  disabledAt: Date | null;
  profile: {
    fullName: string;
    headline: string | null;
    phoneVerified: boolean;
    hasNoWorkExperience: boolean;
    githubUsername: string | null;
    linkedinUrl: string | null;
    educationCount: number;
    experienceCount: number;
    skillCount: number;
    topSkills: string[];
  } | null;
};

export async function getOutreachPerson(userId: string): Promise<OutreachPerson | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      deletedAt: true,
      disabledAt: true,
      candidateProfile: {
        select: {
          fullName: true,
          headline: true,
          phoneVerified: true,
          hasNoWorkExperience: true,
          githubUsername: true,
          linkedinUrl: true,
          skills: { select: { skill: { select: { name: true } } }, take: 5 },
          _count: { select: { education: true, experience: true, skills: true } },
        },
      },
    },
  });
  if (!user) return null;
  const p = user.candidateProfile;
  return {
    email: user.email,
    name: user.name,
    deletedAt: user.deletedAt,
    disabledAt: user.disabledAt,
    profile: p
      ? {
          fullName: p.fullName,
          headline: p.headline,
          phoneVerified: p.phoneVerified,
          hasNoWorkExperience: p.hasNoWorkExperience,
          githubUsername: p.githubUsername,
          linkedinUrl: p.linkedinUrl,
          educationCount: p._count.education,
          experienceCount: p._count.experience,
          skillCount: p._count.skills,
          topSkills: p.skills.map((s) => s.skill.name),
        }
      : null,
  };
}

export async function markOutreachSent(
  id: string,
  input: {
    step: number;
    deliveryId: string;
    now: Date;
    nextSendAt: Date | null;
    stopReason: OutreachStopReason | null;
  },
): Promise<void> {
  await writeClient().resumeImportOutreach.update({
    where: { id },
    data: {
      step: input.step,
      sentCount: { increment: 1 },
      failCount: 0,
      lastSentAt: input.now,
      lastDeliveryId: input.deliveryId,
      ...(input.stopReason
        ? { stage: "STOPPED", stopReason: input.stopReason, stoppedAt: input.now, nextSendAt: null }
        : { nextSendAt: input.nextSendAt }),
    },
    select: { id: true },
  });
}

export async function setOutreachNextSendAt(id: string, at: Date): Promise<void> {
  await writeClient().resumeImportOutreach.update({
    where: { id },
    data: { nextSendAt: at },
    select: { id: true },
  });
}

/** A failed send: retry on the next run; stop as BOUNCED after `maxFails`. Returns true when stopped. */
export async function markOutreachFailed(id: string, now: Date, retryAt: Date, maxFails: number): Promise<boolean> {
  const row = await writeClient().resumeImportOutreach.update({
    where: { id },
    data: { failCount: { increment: 1 }, nextSendAt: retryAt },
    select: { failCount: true },
  });
  if (row.failCount < maxFails) return false;
  await stopOutreachRow(id, "BOUNCED", now);
  return true;
}

/** Stop by row id. Never reopens a stopped row. */
export async function stopOutreachRow(id: string, reason: OutreachStopReason, now: Date): Promise<void> {
  await writeClient().resumeImportOutreach.updateMany({
    where: { id, stage: { not: "STOPPED" } },
    data: { stage: "STOPPED", stopReason: reason, stoppedAt: now, nextSendAt: null },
  });
}

/**
 * Stop by import id (remove-my-data, webhook). REMOVED, UNSUBSCRIBED and
 * BOUNCED also override a sequence that already ended for another reason, so
 * a later claim can never restart mail to that person.
 */
export async function stopOutreachForImport(
  importId: string,
  reason: OutreachStopReason,
  now: Date,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const final = reason === "REMOVED" || reason === "UNSUBSCRIBED" || reason === "BOUNCED";
  const res = await (tx ?? writeClient()).resumeImportOutreach.updateMany({
    where: final
      ? { importId, NOT: { stopReason: { in: ["REMOVED", "UNSUBSCRIBED", "BOUNCED"] } } }
      : { importId, stage: { not: "STOPPED" } },
    data: { stage: "STOPPED", stopReason: reason, stoppedAt: now, nextSendAt: null },
  });
  return res.count;
}

/**
 * The claim happened: start onboarding now — from INVITE, or from a sequence
 * that ended unanswered (they claimed after the last reminder). Never restarts
 * someone who removed their data, unsubscribed or bounced.
 */
export async function moveOutreachToOnboardForUser(userId: string, now: Date): Promise<number> {
  const res = await writeClient().resumeImportOutreach.updateMany({
    where: {
      userId,
      OR: [{ stage: "INVITE" }, { stage: "STOPPED", stopReason: "NO_RESPONSE" }],
    },
    data: {
      stage: "ONBOARD",
      step: 0,
      stopReason: null,
      stoppedAt: null,
      failCount: 0,
      nextSendAt: now,
    },
  });
  return res.count;
}

export async function moveOutreachToOnboard(id: string, now: Date): Promise<void> {
  await writeClient().resumeImportOutreach.updateMany({
    where: { id, stage: "INVITE" },
    data: { stage: "ONBOARD", step: 0, failCount: 0, nextSendAt: now },
  });
}

/** First open of the claim link. Only the first one is kept. */
export async function recordOutreachClick(importId: string, now: Date): Promise<void> {
  await writeClient().resumeImportOutreach.updateMany({
    where: { importId, firstClickAt: null },
    data: { firstClickAt: now },
  });
}

/** The newest registered/claimed import for a recipient address (bounce webhook). */
export async function findLatestImportIdByEmail(email: string): Promise<string | null> {
  const row = await prisma.resumeImport.findFirst({
    where: { normalizedEmail: email, status: { in: ["REGISTERED", "CLAIMED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function enrolledImportIds(): Promise<string[]> {
  const rows = await prisma.resumeImportOutreach.findMany({ select: { importId: true } });
  return rows.map((r) => r.importId);
}

/** REGISTERED imports that never entered the sequence (the backfill button). */
export async function listUnenrolledRegisteredImports(limit: number): Promise<{ id: string; userId: string }[]> {
  const enrolled = await enrolledImportIds();
  const rows = await prisma.resumeImport.findMany({
    where: {
      status: "REGISTERED",
      registeredUserId: { not: null },
      ...(enrolled.length > 0 ? { id: { notIn: enrolled } } : {}),
    },
    orderBy: { registeredAt: "asc" },
    take: Math.max(0, Math.min(limit, 5000)),
    select: { id: true, registeredUserId: true },
  });
  return rows.flatMap((r) => (r.registeredUserId ? [{ id: r.id, userId: r.registeredUserId }] : []));
}

export async function countUnenrolledRegisteredImports(): Promise<number> {
  const enrolled = await enrolledImportIds();
  return prisma.resumeImport.count({
    where: {
      status: "REGISTERED",
      registeredUserId: { not: null },
      ...(enrolled.length > 0 ? { id: { notIn: enrolled } } : {}),
    },
  });
}

/* ─── Outreach: admin reads ──────────────────────────────────────────────── */

export const OUTREACH_FILTERS = [
  "CLICKED_NOT_CLAIMED",
  "CLAIMED_INCOMPLETE",
  "COMPLETED",
  "BOUNCED",
  "NO_RESPONSE",
  "REMOVED",
] as const;
export type OutreachFilter = (typeof OUTREACH_FILTERS)[number];

/** Import ids matching an outreach filter, for `listImports({ importIds })`. */
export async function importIdsForOutreachFilter(filter: OutreachFilter): Promise<string[]> {
  const where: Prisma.ResumeImportOutreachWhereInput =
    filter === "CLICKED_NOT_CLAIMED"
      ? { firstClickAt: { not: null }, stage: "INVITE" }
      : filter === "CLAIMED_INCOMPLETE"
        ? { OR: [{ stage: "ONBOARD" }, { stage: "STOPPED", stopReason: "FINISHED_SEQUENCE" }] }
        : filter === "COMPLETED"
          ? { stopReason: "COMPLETE" }
          : filter === "BOUNCED"
            ? { stopReason: "BOUNCED" }
            : filter === "NO_RESPONSE"
              ? { stopReason: "NO_RESPONSE" }
              : { stopReason: "REMOVED" };
  const rows = await prisma.resumeImportOutreach.findMany({ where, select: { importId: true } });
  return rows.map((r) => r.importId);
}

export type OutreachRowSummary = {
  importId: string;
  stage: OutreachStage;
  step: number;
  sentCount: number;
  firstClickAt: Date | null;
  stopReason: OutreachStopReason | null;
  lastSentAt: Date | null;
  nextSendAt: Date | null;
};

export async function getOutreachForImports(importIds: string[]): Promise<Map<string, OutreachRowSummary>> {
  if (importIds.length === 0) return new Map();
  const rows = await prisma.resumeImportOutreach.findMany({
    where: { importId: { in: importIds } },
    select: {
      importId: true,
      stage: true,
      step: true,
      sentCount: true,
      firstClickAt: true,
      stopReason: true,
      lastSentAt: true,
      nextSendAt: true,
    },
  });
  return new Map(rows.map((r) => [r.importId, r]));
}

export type OutreachFunnel = {
  invited: number;
  clicked: number;
  claimed: number;
  completed: number;
  removed: number;
  bounced: number;
};

export async function outreachFunnel(): Promise<OutreachFunnel> {
  const [invited, clicked, claimed, completed, removed, bounced] = await Promise.all([
    prisma.resumeImportOutreach.count({ where: { sentCount: { gt: 0 } } }),
    prisma.resumeImportOutreach.count({ where: { firstClickAt: { not: null } } }),
    prisma.resumeImportOutreach.count({
      where: {
        OR: [
          { stage: "ONBOARD" },
          { stage: "STOPPED", stopReason: { in: ["COMPLETE", "FINISHED_SEQUENCE"] } },
        ],
      },
    }),
    prisma.resumeImportOutreach.count({ where: { stopReason: "COMPLETE" } }),
    prisma.resumeImportOutreach.count({ where: { stopReason: "REMOVED" } }),
    prisma.resumeImportOutreach.count({ where: { stopReason: "BOUNCED" } }),
  ]);
  return { invited, clicked, claimed, completed, removed, bounced };
}

export async function listBatchLabels(): Promise<string[]> {
  const rows = await prisma.resumeImport.findMany({
    where: { batchLabel: { not: null } },
    distinct: ["batchLabel"],
    orderBy: { batchLabel: "asc" },
    take: 500,
    select: { batchLabel: true },
  });
  return rows.flatMap((r) => (r.batchLabel ? [r.batchLabel] : []));
}

/** Claim rate for one batch: registered-or-claimed imports, and how many claimed. */
export async function batchClaimStats(batchLabel: string): Promise<{ registered: number; claimed: number }> {
  const [registered, claimed] = await Promise.all([
    prisma.resumeImport.count({ where: { batchLabel, status: { in: ["REGISTERED", "CLAIMED"] } } }),
    prisma.resumeImport.count({ where: { batchLabel, status: "CLAIMED" } }),
  ]);
  return { registered, claimed };
}

export type CompletenessRow = {
  fullName: string;
  phone: string | null;
  phoneVerified: boolean;
  hasNoWorkExperience: boolean;
  githubUsername: string | null;
  linkedinUrl: string | null;
  educationCount: number;
  experienceCount: number;
  skillCount: number;
};

/** Completeness inputs for many users at once (the admin table, the CSV). */
export async function getCompletenessInputs(userIds: string[]): Promise<Map<string, CompletenessRow>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.candidateProfile.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      fullName: true,
      phone: true,
      phoneVerified: true,
      hasNoWorkExperience: true,
      githubUsername: true,
      linkedinUrl: true,
      _count: { select: { education: true, experience: true, skills: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.userId,
      {
        fullName: r.fullName,
        phone: r.phone,
        phoneVerified: r.phoneVerified,
        hasNoWorkExperience: r.hasNoWorkExperience,
        githubUsername: r.githubUsername,
        linkedinUrl: r.linkedinUrl,
        educationCount: r._count.education,
        experienceCount: r._count.experience,
        skillCount: r._count.skills,
      },
    ]),
  );
}
