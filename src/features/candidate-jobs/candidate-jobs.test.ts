/**
 * TC-C-007 / TC-C-008 acceptance tests for T-246 candidate jobs.
 *   npm run test:candidate-jobs
 * or:
 *   npx tsx src/features/candidate-jobs/candidate-jobs.test.ts
 *
 * Tests exercise the pure service against in-memory JobStore + ApplicationStore
 * fakes. The ApplicationStore fake enforces the composite unique constraint
 * by throwing `{ code: "P2002" }` — the same shape Prisma surfaces — so the
 * production error-mapping code path is exercised end to end without needing
 * a live database.
 */
import type { JobApplicationStatus, JobStatus, JobType, JobWorkMode } from "@prisma/client";
import { createRecruiterJob, transitionJob } from "@/features/recruiter-jobs/service";
import type { JobRow, JobStore } from "@/features/recruiter-jobs/service";
import {
  applyToPublishedJob,
  browsePublishedJobs,
  listMyApplications,
  DUPLICATE_APPLICATION_MESSAGE,
  CLOSED_JOB_MESSAGE,
  type ApplicationRow,
  type ApplicationStore,
  type ApplicationWithJob,
} from "./service";
import { isPrismaUniqueViolation } from "./lifecycle";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function suite(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

function inMemoryJobStore(): JobStore & { rows: Map<string, JobRow> } {
  const rows = new Map<string, JobRow>();
  let seq = 0;
  return {
    rows,
    async create({ data }) {
      const id = `job_${++seq}`;
      const now = new Date();
      const row: JobRow = { id, createdAt: now, updatedAt: now, ...data };
      rows.set(id, row);
      return row;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async update(id, patch) {
      const existing = rows.get(id);
      if (!existing) throw new Error(`no row ${id}`);
      const updated: JobRow = { ...existing, ...patch, updatedAt: new Date() };
      rows.set(id, updated);
      return updated;
    },
    async listByRecruiter(recruiterId) {
      return [...rows.values()]
        .filter((r) => r.recruiterId === recruiterId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };
}

/**
 * Enforces the `@@unique([userId, jobId])` composite the way Postgres does —
 * a second insert throws with `code: "P2002"`, matching Prisma's real error
 * shape so the caller's mapping is exercised.
 */
function inMemoryApplicationStore(
  jobs: JobStore & { rows: Map<string, JobRow> },
): ApplicationStore & { rows: Map<string, ApplicationRow> } {
  const rows = new Map<string, ApplicationRow>();
  const uniqIx = new Set<string>();
  let seq = 0;
  const uk = (u: string, j: string) => `${u}::${j}`;
  return {
    rows,
    async create(input) {
      const key = uk(input.userId, input.jobId);
      if (uniqIx.has(key)) {
        // Shape mirrors Prisma's PrismaClientKnownRequestError for a
        // unique-constraint violation. We only carry the fields the
        // production code actually reads (`code`).
        const err = new Error("Unique constraint failed on (userId, jobId)") as Error & {
          code: string;
          meta?: unknown;
        };
        err.code = "P2002";
        err.meta = { target: ["userId", "jobId"] };
        throw err;
      }
      const id = `app_${++seq}`;
      const now = new Date();
      const row: ApplicationRow = {
        id,
        jobId: input.jobId,
        userId: input.userId,
        status: "APPLIED" as JobApplicationStatus,
        resumeUrl: input.resumeUrl ?? null,
        coverLetter: input.coverLetter ?? null,
        note: input.note ?? null,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(id, row);
      uniqIx.add(key);
      return row;
    },
    async findByCandidateAndJob(userId, jobId) {
      for (const r of rows.values()) {
        if (r.userId === userId && r.jobId === jobId) return r;
      }
      return null;
    },
    async listByCandidate(userId): Promise<ApplicationWithJob[]> {
      return [...rows.values()]
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((r) => {
          const j = jobs.rows.get(r.jobId)!;
          return {
            ...r,
            job: {
              id: j.id,
              title: j.title,
              company: j.company,
              location: j.location,
              workMode: j.workMode,
              type: j.type,
              status: j.status,
              isOpen: j.isOpen,
            },
          };
        });
    },
    async listPublishedJobsFiltered(filter) {
      const out: JobRow[] = [];
      for (const j of jobs.rows.values()) {
        if (j.status !== "PUBLISHED") continue;
        if (filter.location) {
          const loc = (j.location ?? "").toLowerCase();
          if (!loc.includes(filter.location.toLowerCase())) continue;
        }
        if (filter.workMode && j.workMode !== filter.workMode) continue;
        if (filter.opportunityType && j.type !== filter.opportunityType) continue;
        if (filter.skills && filter.skills.length > 0) {
          const set = new Set(j.skills.map((s) => s.toLowerCase()));
          const wanted = filter.skills.map((s) => s.toLowerCase());
          if (!wanted.some((s) => set.has(s))) continue;
        }
        out.push(j);
      }
      return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };
}

const RECRUITER = { userId: "rec_1" };
const CANDIDATE_A = { userId: "cand_a" };
const CANDIDATE_B = { userId: "cand_b" };

function draftInput() {
  return {
    title: "Senior Backend Engineer",
    company: "ExampleCo",
    description: "Own the ledger service.",
    location: "Bengaluru",
    workMode: "HYBRID" as JobWorkMode,
    opportunityType: "FULL_TIME" as JobType,
    skills: ["Go", "Postgres"],
  };
}

async function seedPublishedJob(jobs: JobStore, overrides: Partial<ReturnType<typeof draftInput>> = {}) {
  const create = await createRecruiterJob(
    { jobs },
    RECRUITER,
    { ...draftInput(), ...overrides },
  );
  if (!create.ok) throw new Error("seed: create");
  const pub = await transitionJob({ jobs }, RECRUITER, create.data.id, "publish");
  if (!pub.ok) throw new Error("seed: publish");
  return create.data.id;
}

async function seedClosedJob(jobs: JobStore) {
  const id = await seedPublishedJob(jobs);
  const close = await transitionJob({ jobs }, RECRUITER, id, "close");
  if (!close.ok) throw new Error("seed: close");
  return id;
}

async function seedDraftJob(jobs: JobStore) {
  const create = await createRecruiterJob({ jobs }, RECRUITER, draftInput());
  if (!create.ok) throw new Error("seed: draft");
  return create.data.id;
}

async function run() {
  console.log("\nTC-C-007 / TC-C-008 candidate jobs acceptance tests\n");

  // Pure lifecycle ---------------------------------------------------------
  await suite("DUPLICATE_APPLICATION_MESSAGE matches ticket copy", () => {
    assert(
      DUPLICATE_APPLICATION_MESSAGE ===
        "You have already submitted an application for this position",
      "copy must match the ticket exactly",
    );
  });

  await suite("isPrismaUniqueViolation matches P2002 and only P2002", () => {
    assert(isPrismaUniqueViolation({ code: "P2002" }), "matches P2002");
    assert(!isPrismaUniqueViolation({ code: "P2003" }), "rejects other codes");
    assert(!isPrismaUniqueViolation(null), "rejects null");
    assert(!isPrismaUniqueViolation("P2002"), "rejects raw string");
    assert(!isPrismaUniqueViolation(new Error("boom")), "rejects plain Error");
  });

  // TC-C-007 — single-apply server-side guard ------------------------------
  await suite(
    "TC-C-007-1: candidate applies to a PUBLISHED job → success, row is APPLIED",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const jobId = await seedPublishedJob(jobs);

      const res = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId },
      );
      assert(res.ok, `apply must succeed, got ${JSON.stringify(res)}`);
      if (!res.ok) return;
      assert(res.data.status === "APPLIED", "default status is APPLIED");

      const row = applications.rows.get(res.data.id)!;
      assert(row.userId === CANDIDATE_A.userId, "row owned by the candidate");
      assert(row.jobId === jobId, "row references the job");
    },
  );

  await suite(
    "TC-C-007-2: second application to the same job → 409 with readable message",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const jobId = await seedPublishedJob(jobs);

      const first = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId },
      );
      assert(first.ok, "setup: first apply must succeed");

      const second = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId },
      );
      assert(!second.ok, "second apply must be rejected");
      if (second.ok) return;
      assert(second.status === 409, `expected 409, got ${second.status}`);
      assert(
        second.message === DUPLICATE_APPLICATION_MESSAGE,
        `expected duplicate copy, got: ${second.message}`,
      );
      assert(second.code === "CONFLICT", "code is CONFLICT");
      assert(applications.rows.size === 1, "no second row was written");
    },
  );

  await suite(
    "TC-C-007-3: apply to a CLOSED job → rejected with readable closed message",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const jobId = await seedClosedJob(jobs);

      const res = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId },
      );
      assert(!res.ok, "apply must be rejected");
      if (res.ok) return;
      assert(
        res.message === CLOSED_JOB_MESSAGE,
        `expected closed message, got: ${res.message}`,
      );
      assert(res.status === 409, `expected 409, got ${res.status}`);
      assert(applications.rows.size === 0, "no row was written");
    },
  );

  await suite(
    "TC-C-007-4: apply to a DRAFT job → 404 with 'Job not found' (no enumeration)",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const jobId = await seedDraftJob(jobs);

      const draft = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId },
      );
      const unknown = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId: "does_not_exist" },
      );
      assert(!draft.ok && !unknown.ok, "both must be rejected");
      if (draft.ok || unknown.ok) return;
      assert(draft.status === 404, "draft returns 404");
      assert(unknown.status === 404, "unknown id returns 404");
      assert(
        draft.message === unknown.message,
        "draft and unknown id return byte-identical messages",
      );
      assert(applications.rows.size === 0, "nothing written on 404 path");
    },
  );

  await suite(
    "TC-C-007-5: two different candidates can both apply to the same PUBLISHED job",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const jobId = await seedPublishedJob(jobs);

      const a = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId },
      );
      const b = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_B,
        { jobId },
      );
      assert(a.ok, "A must succeed");
      assert(b.ok, "B must succeed");
      assert(applications.rows.size === 2, "unique key is per candidate, not per job");
    },
  );

  // TC-C-008 — tracking & multi-device persistence -------------------------
  await suite(
    "TC-C-008-1: tracking list returns the candidate's applications, newest first, all APPLIED",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const j1 = await seedPublishedJob(jobs, { title: "Role 1" });
      // ensure createdAt separation for deterministic ordering
      await new Promise((r) => setTimeout(r, 5));
      const j2 = await seedPublishedJob(jobs, { title: "Role 2" });

      const r1 = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId: j1 },
      );
      await new Promise((r) => setTimeout(r, 5));
      const r2 = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId: j2 },
      );
      assert(r1.ok && r2.ok, "both applies must succeed");

      const list = await listMyApplications({ jobs, applications }, CANDIDATE_A);
      assert(list.ok, "list must succeed");
      if (!list.ok) return;
      assert(list.data.length === 2, `expected 2 rows, got ${list.data.length}`);
      assert(
        list.data.every((row) => row.status === "APPLIED"),
        "every row is APPLIED",
      );
      assert(list.data[0].jobId === j2, "newest first (j2 was applied later)");
      assert(list.data[0].job.title === "Role 2", "join carries the job title");
    },
  );

  await suite(
    "TC-C-008-2: a fresh session for the same candidate sees the same rows unchanged",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const jobId = await seedPublishedJob(jobs);
      const applied = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId },
      );
      assert(applied.ok, "setup: apply must succeed");

      // Simulate a new session / new device: a fresh actor object carrying
      // the same userId. Persistence is a property of the store, not the
      // in-memory session — the second read returns the same row.
      const freshActor = { userId: CANDIDATE_A.userId };
      const first = await listMyApplications({ jobs, applications }, CANDIDATE_A);
      const second = await listMyApplications({ jobs, applications }, freshActor);
      assert(first.ok && second.ok, "both reads must succeed");
      if (!first.ok || !second.ok) return;
      assert(second.data.length === 1, "one row present across sessions");
      assert(
        second.data[0].id === first.data[0].id,
        "same application id across sessions",
      );
      assert(second.data[0].status === "APPLIED", "status preserved");
    },
  );

  await suite(
    "TC-C-008-3: browse strictly excludes DRAFT and CLOSED jobs",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const draft = await seedDraftJob(jobs);
      const closed = await seedClosedJob(jobs);
      const open = await seedPublishedJob(jobs, { title: "Live Role" });

      const res = await browsePublishedJobs({ jobs, applications });
      assert(res.ok, "browse must succeed");
      if (!res.ok) return;
      const ids = res.data.map((j) => j.id);
      assert(ids.includes(open), "PUBLISHED job present");
      assert(!ids.includes(draft), "DRAFT excluded");
      assert(!ids.includes(closed), "CLOSED excluded");
      assert(
        res.data.every((j) => j.status === ("PUBLISHED" as JobStatus)),
        "every returned row is PUBLISHED",
      );
    },
  );

  await suite(
    "TC-C-008-4: browse filters (location, workMode, opportunityType, skills) never leak DRAFT/CLOSED",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      await seedPublishedJob(jobs, {
        title: "BLR Remote Go",
        location: "Bengaluru",
        workMode: "REMOTE" as JobWorkMode,
        skills: ["Go"],
      });
      await seedPublishedJob(jobs, {
        title: "DEL Hybrid Python",
        location: "Delhi",
        workMode: "HYBRID" as JobWorkMode,
        skills: ["Python"],
      });
      await seedClosedJob(jobs); // location Bengaluru, HYBRID, Go — must not leak
      await seedDraftJob(jobs); // location Bengaluru, HYBRID, Go — must not leak

      const byLocation = await browsePublishedJobs(
        { jobs, applications },
        { location: "Bengaluru" },
      );
      assert(byLocation.ok, "location filter");
      if (!byLocation.ok) return;
      assert(byLocation.data.length === 1, "only the live BLR row matches");
      assert(byLocation.data[0].title === "BLR Remote Go", "correct row");

      const byWorkMode = await browsePublishedJobs(
        { jobs, applications },
        { workMode: "HYBRID" as JobWorkMode },
      );
      assert(byWorkMode.ok, "workMode filter");
      if (!byWorkMode.ok) return;
      assert(byWorkMode.data.length === 1, "HYBRID matches only DEL");
      assert(byWorkMode.data[0].title === "DEL Hybrid Python", "correct row");

      const bySkills = await browsePublishedJobs(
        { jobs, applications },
        { skills: ["Python"] },
      );
      assert(bySkills.ok, "skills filter");
      if (!bySkills.ok) return;
      assert(bySkills.data.length === 1, "Python matches only DEL");

      const byType = await browsePublishedJobs(
        { jobs, applications },
        { opportunityType: "FULL_TIME" as JobType },
      );
      assert(byType.ok, "opportunityType filter");
      if (!byType.ok) return;
      // Both PUBLISHED live rows are FULL_TIME; CLOSED and DRAFT excluded.
      assert(byType.data.length === 2, "FULL_TIME matches both live rows");
      assert(
        byType.data.every((j) => j.status === ("PUBLISHED" as JobStatus)),
        "no CLOSED/DRAFT leakage",
      );
    },
  );

  await suite(
    "TC-C-008-5: tracking list is per-candidate — B never sees A's applications",
    async () => {
      const jobs = inMemoryJobStore();
      const applications = inMemoryApplicationStore(jobs);
      const jobId = await seedPublishedJob(jobs);

      const a = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_A,
        { jobId },
      );
      const b = await applyToPublishedJob(
        { jobs, applications },
        CANDIDATE_B,
        { jobId },
      );
      assert(a.ok && b.ok, "both applies must succeed");

      const listA = await listMyApplications({ jobs, applications }, CANDIDATE_A);
      const listB = await listMyApplications({ jobs, applications }, CANDIDATE_B);
      assert(listA.ok && listB.ok, "both reads must succeed");
      if (!listA.ok || !listB.ok) return;
      assert(listA.data.length === 1, "A sees exactly A's row");
      assert(listB.data.length === 1, "B sees exactly B's row");
      assert(
        listA.data.every((r) => r.userId === CANDIDATE_A.userId),
        "A's rows are A's",
      );
      assert(
        listB.data.every((r) => r.userId === CANDIDATE_B.userId),
        "B's rows are B's",
      );
      assert(
        listA.data[0].id !== listB.data[0].id,
        "the two candidates' rows are distinct",
      );
    },
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
