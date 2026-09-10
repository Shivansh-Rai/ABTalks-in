/**
 * TC-R-015 acceptance tests for T-245 recruiter jobs.
 *   npm run test:recruiter-jobs
 * or:
 *   npx tsx src/features/recruiter-jobs/recruiter-jobs.test.ts
 *
 * The tests exercise the pure service module against an in-memory JobStore.
 * This isolates the lifecycle + authorization logic from Prisma so the suite
 * runs without a database. The Prisma-backed store in `prisma-store.ts` is
 * exercised by the app itself; every rule enforced here is enforced there
 * because both go through the same service functions.
 */
import type { JobStatus, JobType, JobWorkMode } from "@prisma/client";
import {
  createRecruiterJob,
  transitionJob,
  updateRecruiterJob,
  getJobForCandidate,
  getRecruiterJob,
  listRecruiterJobs,
  assertApplyAllowed,
  CLOSED_JOB_MESSAGE,
  type JobRow,
  type JobStore,
} from "./service";
import { lifecyclePatch, nextStatus, normalizeSkills } from "./lifecycle";

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

function inMemoryStore(): JobStore & { rows: Map<string, JobRow> } {
  const rows = new Map<string, JobRow>();
  let seq = 0;
  return {
    rows,
    async create({ data }) {
      const id = `job_${++seq}`;
      const now = new Date();
      const row: JobRow = {
        id,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      rows.set(id, row);
      return row;
    },
    async findById(id) {
      const row = rows.get(id);
      return row ?? null;
    },
    async update(id, patch) {
      const existing = rows.get(id);
      if (!existing) throw new Error(`no row ${id}`);
      const updated: JobRow = {
        ...existing,
        ...patch,
        updatedAt: new Date(),
      };
      rows.set(id, updated);
      return updated;
    },
    async listByRecruiter(recruiterId) {
      const owned = [...rows.values()].filter(
        (r) => r.recruiterId === recruiterId,
      );
      return owned.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    },
  };
}

const RECRUITER_A = { userId: "rec_a" };
const RECRUITER_B = { userId: "rec_b" };

function draftInput() {
  return {
    title: "Staff AI Engineer",
    company: "ExampleCo",
    description: "Own the recommendation pipeline end to end.",
    location: "Bengaluru",
    workMode: "HYBRID" as JobWorkMode,
    opportunityType: "FULL_TIME" as JobType,
    skills: ["Python", "PyTorch", "  Python  ", "  "],
  };
}

async function run() {
  console.log("\nTC-R-015 recruiter jobs acceptance tests\n");

  // Pure lifecycle ---------------------------------------------------------
  await suite("nextStatus: publish DRAFT → PUBLISHED", () => {
    assert(nextStatus("DRAFT", "publish") === "PUBLISHED", "publish DRAFT");
    assert(nextStatus("PUBLISHED", "publish") === null, "already published");
    assert(nextStatus("CLOSED", "publish") === "PUBLISHED", "reopen via publish");
  });

  await suite("nextStatus: close PUBLISHED → CLOSED, else null", () => {
    assert(nextStatus("PUBLISHED", "close") === "CLOSED", "close published");
    assert(nextStatus("DRAFT", "close") === null, "cannot close a draft");
    assert(nextStatus("CLOSED", "close") === null, "already closed");
  });

  await suite("nextStatus: reopen CLOSED → PUBLISHED only", () => {
    assert(nextStatus("CLOSED", "reopen") === "PUBLISHED", "reopen closed");
    assert(nextStatus("DRAFT", "reopen") === null, "reopen draft is invalid");
    assert(nextStatus("PUBLISHED", "reopen") === null, "reopen published is invalid");
  });

  await suite("lifecyclePatch stamps publishedAt once and closedAt on every close", () => {
    const t1 = new Date("2026-01-01T00:00:00Z");
    const p1 = lifecyclePatch(
      { status: "DRAFT" as JobStatus, isOpen: false, publishedAt: null, closedAt: null },
      "publish",
      t1,
    );
    assert(p1.ok && p1.data.status === "PUBLISHED", "first publish stamps");
    if (!p1.ok) throw new Error("");
    assert(p1.data.publishedAt?.toISOString() === t1.toISOString(), "publishedAt = t1");
    assert(p1.data.isOpen === true, "isOpen mirrors PUBLISHED");

    const t2 = new Date("2026-02-01T00:00:00Z");
    const p2 = lifecyclePatch(
      { status: "CLOSED" as JobStatus, isOpen: false, publishedAt: t1, closedAt: t2 },
      "reopen",
      t2,
    );
    assert(p2.ok, "reopen ok");
    if (!p2.ok) throw new Error("");
    assert(p2.data.publishedAt === undefined, "reopen keeps original publishedAt");
    assert(p2.data.isOpen === true, "reopen flips isOpen back true");
  });

  await suite("normalizeSkills trims, dedupes case-insensitively, drops empties", () => {
    const out = normalizeSkills(["A", " a ", "b", "", "  ", "C", "c"]);
    assert(out.length === 3, `expected 3, got ${out.length}`);
    assert(out[0] === "A" && out[1] === "b" && out[2] === "C", "kept originals");
  });

  // Integration through the service ---------------------------------------
  await suite(
    "TC-R-015-1: recruiter creates a job → saved as DRAFT with recruiterId set",
    async () => {
      const store = inMemoryStore();
      const res = await createRecruiterJob({ jobs: store }, RECRUITER_A, draftInput());
      assert(res.ok, "create must succeed");
      if (!res.ok) return;
      assert(res.data.status === "DRAFT", "new job is DRAFT");
      const row = store.rows.get(res.data.id)!;
      assert(row.recruiterId === RECRUITER_A.userId, "ownership recorded");
      assert(row.publishedAt === null, "no publishedAt yet");
      assert(row.closedAt === null, "no closedAt yet");
      assert(row.isOpen === false, "isOpen false while draft");
      assert(
        row.skills.length === 2 && row.skills[0] === "Python",
        "skills normalized",
      );
    },
  );

  await suite(
    "TC-R-015-2: candidate fetches a DRAFT by id → 404 (not 403, no existence leak)",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      assert(create.ok, "create must succeed");
      if (!create.ok) return;

      const visible = await getJobForCandidate({ jobs: store }, create.data.id);
      assert(!visible.ok, "draft must not be visible");
      if (visible.ok) return;
      assert(visible.code === "NOT_FOUND", `expected NOT_FOUND, got ${visible.code}`);
      assert(visible.message === "Job not found", "candidate sees generic 404 copy");

      const missing = await getJobForCandidate({ jobs: store }, "no_such_id");
      assert(!missing.ok && missing.code === "NOT_FOUND", "unknown id is also 404");
      assert(
        !missing.ok && missing.message === visible.message,
        "draft id and unknown id give identical response — cannot distinguish",
      );
    },
  );

  await suite(
    "TC-R-015-3: recruiter publishes → candidate fetch returns the job",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      assert(create.ok, "create must succeed");
      if (!create.ok) return;
      const jobId = create.data.id;

      const pub = await transitionJob({ jobs: store }, RECRUITER_A, jobId, "publish");
      assert(pub.ok, "publish must succeed");
      if (!pub.ok) return;
      assert(pub.data.status === "PUBLISHED", "status is PUBLISHED");

      const visible = await getJobForCandidate({ jobs: store }, jobId);
      assert(visible.ok, "candidate must see it now");
      if (!visible.ok) return;
      assert(visible.data.isOpen === true, "isOpen is true after publish");
      assert(visible.data.publishedAt !== null, "publishedAt is set");
    },
  );

  await suite(
    "TC-R-015-4: recruiter closes → candidate apply fails with readable closed message",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      if (!create.ok) throw new Error("setup: create");
      const jobId = create.data.id;
      const pub = await transitionJob({ jobs: store }, RECRUITER_A, jobId, "publish");
      if (!pub.ok) throw new Error("setup: publish");

      const close = await transitionJob(
        { jobs: store },
        RECRUITER_A,
        jobId,
        "close",
      );
      assert(close.ok, "close must succeed");
      if (!close.ok) return;
      assert(close.data.status === "CLOSED", "status is CLOSED");

      const apply = await assertApplyAllowed({ jobs: store }, jobId);
      assert(!apply.ok, "apply must be refused");
      if (apply.ok) return;
      assert(apply.message === CLOSED_JOB_MESSAGE, "readable closed message");

      // Closed jobs stay visible so an applicant with a stale link sees the
      // closed banner instead of a 404.
      const visible = await getJobForCandidate({ jobs: store }, jobId);
      assert(visible.ok, "closed job is still visible");
    },
  );

  await suite(
    "TC-R-015-5: recruiter reopens → status flips to PUBLISHED and apply is allowed",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      if (!create.ok) throw new Error("setup: create");
      const jobId = create.data.id;
      if (!(await transitionJob({ jobs: store }, RECRUITER_A, jobId, "publish")).ok)
        throw new Error("setup: publish");
      if (!(await transitionJob({ jobs: store }, RECRUITER_A, jobId, "close")).ok)
        throw new Error("setup: close");

      const reopen = await transitionJob(
        { jobs: store },
        RECRUITER_A,
        jobId,
        "reopen",
      );
      assert(reopen.ok && reopen.data.status === "PUBLISHED", "reopen → PUBLISHED");

      const apply = await assertApplyAllowed({ jobs: store }, jobId);
      assert(apply.ok, "reopened job accepts applications");
    },
  );

  await suite(
    "TC-R-015-6: non-owning recruiter update/close is rejected 403",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      if (!create.ok) throw new Error("setup: create");
      const jobId = create.data.id;
      const pub = await transitionJob({ jobs: store }, RECRUITER_A, jobId, "publish");
      if (!pub.ok) throw new Error("setup: publish");

      const foreignClose = await transitionJob(
        { jobs: store },
        RECRUITER_B,
        jobId,
        "close",
      );
      assert(!foreignClose.ok, "foreign recruiter must not close");
      if (foreignClose.ok) return;
      assert(foreignClose.code === "FORBIDDEN", "code is FORBIDDEN");

      const foreignUpdate = await updateRecruiterJob(
        { jobs: store },
        RECRUITER_B,
        jobId,
        { title: "Pwned" },
      );
      assert(!foreignUpdate.ok, "foreign recruiter must not update");
      if (foreignUpdate.ok) return;
      assert(foreignUpdate.code === "FORBIDDEN", "update also FORBIDDEN");

      const row = store.rows.get(jobId)!;
      assert(row.title === "Staff AI Engineer", "title unchanged");
      assert(row.status === "PUBLISHED", "status unchanged");
    },
  );

  await suite(
    "invalid transitions are rejected with CONFLICT (not silently ignored)",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      if (!create.ok) throw new Error("setup");
      const jobId = create.data.id;

      const closeDraft = await transitionJob(
        { jobs: store },
        RECRUITER_A,
        jobId,
        "close",
      );
      assert(!closeDraft.ok, "cannot close a draft");
      if (closeDraft.ok) return;
      assert(closeDraft.code === "CONFLICT", "code is CONFLICT");

      const reopenDraft = await transitionJob(
        { jobs: store },
        RECRUITER_A,
        jobId,
        "reopen",
      );
      assert(!reopenDraft.ok && reopenDraft.code === "CONFLICT", "reopen draft blocked");
    },
  );

  await suite(
    "admin actor can transition any recruiter's job",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      if (!create.ok) throw new Error("setup");
      const admin = { userId: "admin_1", isAdmin: true };
      const pub = await transitionJob({ jobs: store }, admin, create.data.id, "publish");
      assert(pub.ok, "admin can publish another recruiter's job");
    },
  );

  // T-226 alignment — same-domain independence -----------------------------
  await suite(
    "T-226: listRecruiterJobs returns only the caller's own jobs (same-domain independence)",
    async () => {
      const store = inMemoryStore();
      // Same company string simulates two recruiters on the same email
      // domain. T-226 requires they stay independent — the filter is by
      // recruiterId, not by company.
      const shared = { ...draftInput(), company: "SharedCo" };
      const a1 = await createRecruiterJob({ jobs: store }, RECRUITER_A, shared);
      const a2 = await createRecruiterJob({ jobs: store }, RECRUITER_A, shared);
      const b1 = await createRecruiterJob({ jobs: store }, RECRUITER_B, shared);
      assert(a1.ok && a2.ok && b1.ok, "setup: three jobs across two recruiters");

      const forA = await listRecruiterJobs({ jobs: store }, RECRUITER_A);
      const forB = await listRecruiterJobs({ jobs: store }, RECRUITER_B);
      assert(forA.ok && forB.ok, "both lists must succeed");
      if (!forA.ok || !forB.ok) return;
      assert(forA.data.length === 2, `A expected 2, got ${forA.data.length}`);
      assert(forB.data.length === 1, `B expected 1, got ${forB.data.length}`);
      assert(
        forA.data.every((j) => j.recruiterId === RECRUITER_A.userId),
        "A's list contains only A's rows",
      );
      assert(
        forB.data.every((j) => j.recruiterId === RECRUITER_B.userId),
        "B's list contains only B's rows",
      );
    },
  );

  await suite(
    "T-226: getRecruiterJob returns NOT_FOUND (not FORBIDDEN) for a foreign row",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      if (!create.ok) throw new Error("setup");

      const asOwner = await getRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        create.data.id,
      );
      assert(asOwner.ok, "owner sees their own DRAFT");

      const asForeign = await getRecruiterJob(
        { jobs: store },
        RECRUITER_B,
        create.data.id,
      );
      assert(!asForeign.ok, "foreign recruiter must not see the row");
      if (asForeign.ok) return;
      // NOT_FOUND (not FORBIDDEN) so id enumeration cannot distinguish
      // "someone else owns this" from "no such id" on the read side either.
      assert(
        asForeign.code === "NOT_FOUND",
        `expected NOT_FOUND, got ${asForeign.code}`,
      );

      const asMissing = await getRecruiterJob(
        { jobs: store },
        RECRUITER_B,
        "no_such_id",
      );
      assert(!asMissing.ok && asMissing.code === "NOT_FOUND", "unknown id also 404");
      assert(
        !asMissing.ok && asMissing.message === asForeign.message,
        "foreign id and unknown id give identical response",
      );
    },
  );

  await suite(
    "T-226: recruiter B's list excludes A's DRAFT even after A publishes it",
    async () => {
      const store = inMemoryStore();
      const create = await createRecruiterJob(
        { jobs: store },
        RECRUITER_A,
        draftInput(),
      );
      if (!create.ok) throw new Error("setup");
      const pub = await transitionJob(
        { jobs: store },
        RECRUITER_A,
        create.data.id,
        "publish",
      );
      assert(pub.ok, "publish must succeed");

      const bList = await listRecruiterJobs({ jobs: store }, RECRUITER_B);
      assert(bList.ok && bList.data.length === 0, "B's workspace stays empty");
      // Candidates DO see it — that is the point of publishing.
      const asCandidate = await getJobForCandidate({ jobs: store }, create.data.id);
      assert(asCandidate.ok, "candidate view shows published job");
    },
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
