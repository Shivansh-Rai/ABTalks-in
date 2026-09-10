import type {
  JobApplicationStatus,
  JobType,
  JobWorkMode,
} from "@prisma/client";
import {
  assertApplyAllowed,
  CLOSED_JOB_MESSAGE,
} from "@/features/recruiter-jobs/service";
import type { JobRow, JobStore } from "@/features/recruiter-jobs/service";
import {
  DUPLICATE_APPLICATION_MESSAGE,
  isPrismaUniqueViolation,
  type Result,
} from "./lifecycle";

/**
 * Minimal application row shape the service consumes. Matches the columns
 * added in Plan 120 §5 and only those columns — keeps `select` narrow and
 * the in-memory test store easy to keep in sync.
 */
export type ApplicationRow = {
  id: string;
  jobId: string;
  userId: string;
  status: JobApplicationStatus;
  resumeUrl: string | null;
  coverLetter: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Joined tracking-list row. */
export type ApplicationWithJob = ApplicationRow & {
  job: Pick<
    JobRow,
    | "id"
    | "title"
    | "company"
    | "location"
    | "workMode"
    | "type"
    | "status"
    | "isOpen"
  >;
};

export type ApplicationCreateInput = {
  jobId: string;
  userId: string;
  note?: string | null;
  resumeUrl?: string | null;
  coverLetter?: string | null;
};

export type JobFilterInput = {
  location?: string;
  workMode?: JobWorkMode;
  opportunityType?: JobType;
  skills?: string[];
};

export type ApplicationStore = {
  create(input: ApplicationCreateInput): Promise<ApplicationRow>;
  findByCandidateAndJob(
    userId: string,
    jobId: string,
  ): Promise<ApplicationRow | null>;
  listByCandidate(userId: string): Promise<ApplicationWithJob[]>;
  listPublishedJobsFiltered(filter: JobFilterInput): Promise<JobRow[]>;
};

export type ServiceDeps = {
  jobs: JobStore;
  applications: ApplicationStore;
  now?: () => Date;
};

const OK = <T>(data: T): Result<T> => ({ ok: true, data });

/**
 * Candidate browse — always filters to PUBLISHED and applies the optional
 * filters on top. DRAFT and CLOSED are strictly excluded (enforced by the
 * store — the service never asks for anything else).
 */
export async function browsePublishedJobs(
  deps: ServiceDeps,
  filter: JobFilterInput = {},
): Promise<Result<JobRow[]>> {
  const rows = await deps.applications.listPublishedJobsFiltered(filter);
  return OK(rows);
}

/**
 * Server-side apply guard + write. Order matters:
 *   1. Auth is the caller's responsibility (the action layer).
 *   2. `assertApplyAllowed` reuses the T-245 rules — DRAFT is 404
 *      indistinguishable from unknown id, CLOSED is a readable
 *      "position is closed" message.
 *   3. On write, a P2002 unique-constraint violation is mapped to the
 *      duplicate-application 409 envelope. The mapping lives in the
 *      service so a future non-action caller still returns the right
 *      shape.
 */
export async function applyToPublishedJob(
  deps: ServiceDeps,
  actor: { userId: string },
  input: { jobId: string; note?: string; resumeUrl?: string; coverLetter?: string },
): Promise<Result<{ id: string; status: JobApplicationStatus }>> {
  const jobId = input.jobId?.trim();
  if (!jobId) {
    return { ok: false, code: "INVALID", message: "jobId is required", status: 400 };
  }

  const guard = await assertApplyAllowed({ jobs: deps.jobs }, jobId);
  if (!guard.ok) {
    const status =
      guard.message === CLOSED_JOB_MESSAGE
        ? 409
        : guard.code === "NOT_FOUND"
          ? 404
          : 400;
    return { ok: false, message: guard.message, status };
  }

  try {
    const row = await deps.applications.create({
      jobId,
      userId: actor.userId,
      note: input.note?.trim() || null,
      resumeUrl: input.resumeUrl?.trim() || null,
      coverLetter: input.coverLetter?.trim() || null,
    });
    return OK({ id: row.id, status: row.status });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return {
        ok: false,
        code: "CONFLICT",
        message: DUPLICATE_APPLICATION_MESSAGE,
        status: 409,
      };
    }
    throw err;
  }
}

/**
 * Candidate-scoped tracking list. Rows are the caller's own applications
 * only, newest first — the store enforces the `userId` filter (the actor's
 * id comes from the session, never the client).
 */
export async function listMyApplications(
  deps: ServiceDeps,
  actor: { userId: string },
): Promise<Result<ApplicationWithJob[]>> {
  const rows = await deps.applications.listByCandidate(actor.userId);
  return OK(rows);
}

export { DUPLICATE_APPLICATION_MESSAGE, CLOSED_JOB_MESSAGE };
