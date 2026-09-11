/**
 * Plan 129 (T-218) — candidate assessment taking. Covers TC-C-012 and TC-C-013.
 *   npm run test:assessment-attempts
 *
 * In-memory store (decision D-2): start / saveAnswer / submit check and write
 * with no `await` in between, so they are atomic the way the Postgres guards
 * are. findAttempt returns a snapshot, as a database read would.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  finishAttempt,
  listCandidateAttempts,
  loadAttempt,
  saveAnswer,
  startAttempt,
  submitAttempt,
  type AnswerRow,
  type AttemptListRow,
  type AttemptQuestionRow,
  type AttemptRow,
  type AttemptStatus,
  type AttemptStore,
  type FinishInput,
  type GradeQuestion,
  type SubmitOutcome,
} from "./service";

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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

/** The body of one method, from its signature to `endMarker`. */
function sliceBody(src: string, startMarker: string, endMarker: RegExp): string {
  const start = src.indexOf(startMarker);
  if (start < 0) throw new Error(`marker not found: ${startMarker}`);
  const rest = src.slice(start + startMarker.length);
  const end = rest.search(endMarker);
  return end < 0 ? rest : rest.slice(0, end);
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

type StoredAssessment = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
  passMarkPercent: number;
  durationMinutes: number | null;
  questions: AttemptQuestionRow[];
  /** The answer key, kept apart — findAttempt never reads it. */
  correct: Map<string, string[]>;
};

type StoredAssignment = {
  id: string;
  assessmentId: string;
  candidateUserId: string;
  status: AttemptStatus;
  assignedAt: Date;
  startedAt: Date | null;
  submittedAt: Date | null;
  scorePercent: number | null;
  passed: boolean | null;
};

function inMemoryStore() {
  const assessments = new Map<string, StoredAssessment>();
  const assignments = new Map<string, StoredAssignment>();
  const answers = new Map<string, AnswerRow>();
  let seq = 0;

  const key = (assignmentId: string, questionId: string) =>
    `${assignmentId}:${questionId}`;
  const owned = (assignmentId: string, userId: string) => {
    const a = assignments.get(assignmentId);
    return a && a.candidateUserId === userId ? a : undefined;
  };
  const answersFor = (assignmentId: string) =>
    [...answers.entries()]
      .filter(([k]) => k.startsWith(`${assignmentId}:`))
      .map(([, v]) => v);

  const store: AttemptStore = {
    async findAttempt(assignmentId, candidateUserId): Promise<AttemptRow | null> {
      const a = owned(assignmentId, candidateUserId);
      if (!a) return null;
      const s = assessments.get(a.assessmentId)!;
      return structuredClone({
        assignmentId: a.id,
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        assessment: {
          status: s.status,
          title: s.title,
          subheading: null,
          instructions: "Read carefully.",
          durationMinutes: s.durationMinutes,
          passMarkPercent: s.passMarkPercent,
        },
        questions: s.questions,
        answers: answersFor(a.id),
      });
    },
    async listAttempts(candidateUserId): Promise<AttemptListRow[]> {
      return [...assignments.values()]
        .filter(
          (a) =>
            a.candidateUserId === candidateUserId &&
            assessments.get(a.assessmentId)?.status === "PUBLISHED",
        )
        .sort((x, y) => y.assignedAt.getTime() - x.assignedAt.getTime())
        .map((a) => {
          const s = assessments.get(a.assessmentId)!;
          return {
            assignmentId: a.id,
            title: s.title,
            status: a.status,
            assignedAt: a.assignedAt,
            submittedAt: a.submittedAt,
            durationMinutes: s.durationMinutes,
            questionCount: s.questions.length,
          };
        });
    },
    async start(assignmentId, candidateUserId, at) {
      const a = owned(assignmentId, candidateUserId);
      if (!a || a.status !== "ASSIGNED") return false;
      a.status = "STARTED";
      a.startedAt = at;
      return true;
    },
    async saveAnswer(assignmentId, candidateUserId, questionId, value) {
      const a = owned(assignmentId, candidateUserId);
      if (!a || a.status !== "STARTED") return "NOT_OPEN";
      answers.set(key(assignmentId, questionId), { questionId, ...value });
      return "SAVED";
    },
    async submit(assignmentId, candidateUserId, at, finish): Promise<SubmitOutcome> {
      const a = owned(assignmentId, candidateUserId);
      if (!a || (a.status !== "ASSIGNED" && a.status !== "STARTED")) {
        return { outcome: "NOT_OPEN" };
      }
      const before = { status: a.status, submittedAt: a.submittedAt };
      a.status = "SUBMITTED";
      a.submittedAt = at;
      const s = assessments.get(a.assessmentId)!;
      const result = finish({
        passMarkPercent: s.passMarkPercent,
        answers: answersFor(a.id),
        questions: s.questions.map((q) => ({
          id: q.id,
          type: q.type,
          points: q.points,
          isRequired: q.isRequired,
          maxWords: q.maxWords,
          correctOptionIds: s.correct.get(q.id) ?? [],
        })),
      });
      if (!result.ok) {
        // Emulates the transaction rolling the flip back.
        a.status = before.status;
        a.submittedAt = before.submittedAt;
        return {
          outcome: "INCOMPLETE",
          missingRequired: result.missingRequired,
          overLimit: result.overLimit,
        };
      }
      a.scorePercent = result.scorePercent;
      a.passed = result.passed;
      return { outcome: "SUBMITTED" };
    },
  };

  function addAssessment(
    status: StoredAssessment["status"] = "PUBLISHED",
    title = "Backend screen",
  ): StoredAssessment {
    const id = `as_${++seq}`;
    const s: StoredAssessment = {
      id,
      status,
      title,
      passMarkPercent: 60,
      durationMinutes: 30,
      correct: new Map([
        [`${id}_q1`, [`${id}_o1a`]],
        [`${id}_q2`, [`${id}_o2a`, `${id}_o2b`]],
      ]),
      questions: [
        {
          id: `${id}_q1`,
          position: 0,
          type: "MULTIPLE_CHOICE",
          title: "Which structure is FIFO?",
          helpText: null,
          isRequired: true,
          points: 2,
          allowMultipleCorrect: false,
          maxWords: null,
          uploadDestinationUrl: null,
          options: [
            { id: `${id}_o1a`, position: 0, body: "Queue" },
            { id: `${id}_o1b`, position: 1, body: "Stack" },
          ],
        },
        {
          id: `${id}_q2`,
          position: 1,
          type: "MULTIPLE_CHOICE",
          title: "Which are HTTP methods?",
          helpText: null,
          isRequired: true,
          points: 3,
          allowMultipleCorrect: true,
          maxWords: null,
          uploadDestinationUrl: null,
          options: [
            { id: `${id}_o2a`, position: 0, body: "GET" },
            { id: `${id}_o2b`, position: 1, body: "POST" },
            { id: `${id}_o2c`, position: 2, body: "FETCH" },
          ],
        },
        {
          id: `${id}_q3`,
          position: 2,
          type: "PARAGRAPH",
          title: "Explain CAP briefly.",
          helpText: null,
          isRequired: true,
          points: 5,
          allowMultipleCorrect: false,
          maxWords: 20,
          uploadDestinationUrl: null,
          options: [],
        },
        {
          id: `${id}_q4`,
          position: 3,
          type: "FILE_UPLOAD",
          title: "Upload your design doc.",
          helpText: null,
          isRequired: true,
          points: 5,
          allowMultipleCorrect: false,
          maxWords: null,
          uploadDestinationUrl: "https://drive.example.com/upload",
          options: [],
        },
      ],
    };
    assessments.set(id, s);
    return s;
  }

  function addAssignment(assessmentId: string, candidateUserId: string, assignedAt = new Date()) {
    const id = `asg_${++seq}`;
    assignments.set(id, {
      id,
      assessmentId,
      candidateUserId,
      status: "ASSIGNED",
      assignedAt,
      startedAt: null,
      submittedAt: null,
      scorePercent: null,
      passed: null,
    });
    return id;
  }

  return { store, assessments, assignments, answers, addAssessment, addAssignment, key };
}

const C = "cand_c";
const D = "cand_d";

function fixture() {
  const mem = inMemoryStore();
  const s = mem.addAssessment();
  const aC = mem.addAssignment(s.id, C);
  const aD = mem.addAssignment(s.id, D);
  const q = (n: number) => `${s.id}_q${n}`;
  const o = (label: string) => `${s.id}_o${label}`;
  return { ...mem, s, aC, aD, q, o };
}

type Fixture = ReturnType<typeof fixture>;

async function save(f: Fixture, questionId: string, answer: unknown, user = C, assignmentId = f.aC) {
  return saveAnswer(f.store, user, { assignmentId, questionId, answer });
}

/** Every required question answered correctly, within limits. */
async function answerAll(f: Fixture) {
  await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1a")] });
  await save(f, f.q(2), { kind: "choice", selectedOptionIds: [f.o("2a"), f.o("2b")] });
  await save(f, f.q(3), { kind: "text", text: "Consistency, availability, partition tolerance." });
  await save(f, f.q(4), { kind: "file", fileUrl: "https://drive.example.com/f/1" });
}

async function started(): Promise<Fixture> {
  const f = fixture();
  const res = await startAttempt(f.store, C, { assignmentId: f.aC });
  if (!res.ok) throw new Error("setup start failed");
  return f;
}

function gradeInput(overrides: Partial<FinishInput> = {}): FinishInput {
  const questions: GradeQuestion[] = [
    { id: "m1", type: "MULTIPLE_CHOICE", points: 2, isRequired: false, maxWords: null, correctOptionIds: ["a"] },
    { id: "m2", type: "MULTIPLE_CHOICE", points: 3, isRequired: false, maxWords: null, correctOptionIds: ["x", "y"] },
    { id: "p1", type: "PARAGRAPH", points: 10, isRequired: false, maxWords: 50, correctOptionIds: [] },
    { id: "f1", type: "FILE_UPLOAD", points: 10, isRequired: false, maxWords: null, correctOptionIds: [] },
  ];
  return { questions, answers: [], passMarkPercent: 60, ...overrides };
}

const pick = (questionId: string, ids: string[]): AnswerRow => ({
  questionId,
  selectedOptionIds: ids,
  text: null,
  fileUrl: null,
});

// ---------------------------------------------------------------------------

async function run() {
  console.log("\nPlan 129 (T-218) assessment taking\n");

  // ---- start --------------------------------------------------------------

  await suite("1. start: ASSIGNED → STARTED, startedAt set", async () => {
    const f = fixture();
    const res = await startAttempt(f.store, C, { assignmentId: f.aC });
    assert(res.ok && res.data.alreadyStarted === false, "start ok");
    const a = f.assignments.get(f.aC)!;
    assert(a.status === "STARTED", `status STARTED, got ${a.status}`);
    assert(a.startedAt instanceof Date, "startedAt set");
  });

  await suite("2. start twice → alreadyStarted, startedAt unchanged", async () => {
    const f = await started();
    const first = f.assignments.get(f.aC)!.startedAt!.getTime();
    const again = await startAttempt(f.store, C, { assignmentId: f.aC });
    assert(again.ok && again.data.alreadyStarted === true, "second start is a no-op");
    assert(f.assignments.get(f.aC)!.startedAt!.getTime() === first, "startedAt unchanged");
  });

  await suite("3. start after submit → CONFLICT", async () => {
    const f = await started();
    await answerAll(f);
    const sub = await submitAttempt(f.store, C, { assignmentId: f.aC });
    assert(sub.ok, "setup submit");
    const res = await startAttempt(f.store, C, { assignmentId: f.aC });
    assert(!res.ok && res.code === "CONFLICT", "CONFLICT");
  });

  // ---- isolation ------------------------------------------------------------

  await suite(
    "4. another candidate's assignment → NOT_FOUND on load, start, save and submit",
    async () => {
      const f = fixture();
      const load = await loadAttempt(f.store, D, f.aC);
      const start = await startAttempt(f.store, D, { assignmentId: f.aC });
      const put = await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1a")] }, D, f.aC);
      const sub = await submitAttempt(f.store, D, { assignmentId: f.aC });
      for (const [name, r] of [["load", load], ["start", start], ["save", put], ["submit", sub]] as const) {
        assert(!r.ok && r.code === "NOT_FOUND", `${name} must be NOT_FOUND`);
      }
      assert(f.assignments.get(f.aC)!.status === "ASSIGNED", "C's attempt untouched");
      assert(f.answers.size === 0, "nothing written");
    },
  );

  await suite("5. DRAFT or ARCHIVED assessment → NOT_FOUND on load and start", async () => {
    for (const status of ["DRAFT", "ARCHIVED"] as const) {
      const mem = inMemoryStore();
      const s = mem.addAssessment(status);
      const id = mem.addAssignment(s.id, C);
      const load = await loadAttempt(mem.store, C, id);
      const start = await startAttempt(mem.store, C, { assignmentId: id });
      assert(!load.ok && load.code === "NOT_FOUND", `${status} load NOT_FOUND`);
      assert(!start.ok && start.code === "NOT_FOUND", `${status} start NOT_FOUND`);
      assert(mem.assignments.get(id)!.status === "ASSIGNED", `${status} not started`);
    }
  });

  await suite("6. unknown question, or one from another assessment → NOT_FOUND", async () => {
    const f = await started();
    const other = f.addAssessment("PUBLISHED", "Other");
    const unknown = await save(f, "nope", { kind: "text", text: "x" });
    const foreign = await save(f, `${other.id}_q3`, { kind: "text", text: "x" });
    assert(!unknown.ok && unknown.code === "NOT_FOUND", "unknown NOT_FOUND");
    assert(!foreign.ok && foreign.code === "NOT_FOUND", "foreign NOT_FOUND");
    assert(f.answers.size === 0, "nothing written");
  });

  // ---- save -----------------------------------------------------------------

  await suite("7. save before start → CONFLICT, nothing written", async () => {
    const f = fixture();
    const res = await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1a")] });
    assert(!res.ok && res.code === "CONFLICT", "CONFLICT");
    assert(f.answers.size === 0, "nothing written");
  });

  await suite("8. invalid choices and a mismatched kind → INVALID", async () => {
    const f = await started();
    const two = await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1a"), f.o("1b")] });
    const alien = await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("2a")] });
    const kind = await save(f, f.q(1), { kind: "text", text: "Queue" });
    assert(!two.ok && two.code === "INVALID", "single-select with two options");
    assert(!alien.ok && alien.code === "INVALID", "option from another question");
    assert(!kind.ok && kind.code === "INVALID", "text for an MCQ");
    assert(f.answers.size === 0, "nothing written");
  });

  await suite("9. an over-limit paragraph is saved, then submit refuses it", async () => {
    const f = await started();
    await answerAll(f);
    const long = Array.from({ length: 25 }, (_, i) => `word${i}`).join(" ");
    const put = await save(f, f.q(3), { kind: "text", text: long });
    assert(put.ok, "over-limit draft is saved, not lost");
    assert(f.answers.get(f.key(f.aC, f.q(3)))?.text === long, "stored in full");
    const sub = await submitAttempt(f.store, C, { assignmentId: f.aC });
    assert(!sub.ok && sub.code === "INVALID", "submit refused");
    if (!sub.ok) assert(sub.message.includes("Shorten 1 answer"), `message: ${sub.message}`);
    assert(f.assignments.get(f.aC)!.status === "STARTED", "still STARTED");
  });

  await suite("10. file links: javascript: and data: refused, empty clears, https trimmed", async () => {
    const f = await started();
    const js = await save(f, f.q(4), { kind: "file", fileUrl: "javascript:alert(1)" });
    const data = await save(f, f.q(4), { kind: "file", fileUrl: "data:text/html,x" });
    assert(!js.ok && js.code === "INVALID", "javascript: refused");
    assert(!data.ok && data.code === "INVALID", "data: refused");
    const ok = await save(f, f.q(4), { kind: "file", fileUrl: "  https://drive.example.com/f  " });
    assert(ok.ok, "https saved");
    assert(
      f.answers.get(f.key(f.aC, f.q(4)))?.fileUrl === "https://drive.example.com/f",
      "stored trimmed",
    );
    const clear = await save(f, f.q(4), { kind: "file", fileUrl: "" });
    assert(clear.ok, "clearing saved");
    assert(f.answers.get(f.key(f.aC, f.q(4)))?.fileUrl === null, "cleared to null");
  });

  await suite("11. saving a question twice keeps one row with the second value", async () => {
    const f = await started();
    await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1b")] });
    await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1a")] });
    const rows = [...f.answers.keys()].filter((k) => k.endsWith(f.q(1)));
    assert(rows.length === 1, "one row");
    assert(
      f.answers.get(f.key(f.aC, f.q(1)))?.selectedOptionIds.join() === f.o("1a"),
      "second value",
    );
  });

  // ---- TC-C-012 -------------------------------------------------------------

  await suite("12. TC-C-012: every answer survives a device change", async () => {
    const f = await started();
    const paragraph = "  line one\n\tline two — ünïcode, kept exactly  ";
    const link = "https://drive.example.com/f/42";
    // Device A: answer all four types.
    await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1a")] });
    await save(f, f.q(2), { kind: "choice", selectedOptionIds: [f.o("2b"), f.o("2a")] });
    await save(f, f.q(3), { kind: "text", text: paragraph });
    await save(f, f.q(4), { kind: "file", fileUrl: link });

    // Device B: nothing from device A is reused — only the user and the id.
    const loaded = await loadAttempt(f.store, C, f.aC);
    assert(loaded.ok, "load ok");
    if (!loaded.ok) return;
    const a = loaded.data.answers;
    const q1 = a[f.q(1)];
    const q2 = a[f.q(2)];
    const q3 = a[f.q(3)];
    const q4 = a[f.q(4)];
    assert(q1?.kind === "choice" && q1.selectedOptionIds.join() === f.o("1a"), "single-select restored");
    assert(
      q2?.kind === "choice" &&
        new Set(q2.selectedOptionIds).size === 2 &&
        q2.selectedOptionIds.includes(f.o("2a")) &&
        q2.selectedOptionIds.includes(f.o("2b")),
      "multi-select restored as the same set",
    );
    assert(q3?.kind === "text" && q3.text === paragraph, "paragraph byte-identical, not trimmed");
    assert(q4?.kind === "file" && q4.fileUrl === link, "file link restored");
    assert(loaded.data.status === "STARTED", "resumes in progress");
  });

  await suite("13. the candidate view never carries the answer key, score or result", async () => {
    const f = await started();
    await answerAll(f);
    await submitAttempt(f.store, C, { assignmentId: f.aC });
    const loaded = await loadAttempt(f.store, C, f.aC);
    assert(loaded.ok, "load ok");
    const json = JSON.stringify(loaded.ok ? loaded.data : null);
    for (const word of ["isCorrect", "scorePercent", "passed", "correctOptionIds"]) {
      assert(!json.includes(word), `view must not contain ${word}`);
    }
  });

  // ---- submit — TC-C-013 ----------------------------------------------------

  await suite("14. TC-C-013: a duplicate submission is refused server-side", async () => {
    const f = await started();
    await answerAll(f);
    const first = await submitAttempt(f.store, C, { assignmentId: f.aC });
    assert(first.ok, "first submit ok");
    const row = f.assignments.get(f.aC)!;
    const snapshot = { ...row };
    const second = await submitAttempt(f.store, C, { assignmentId: f.aC });
    assert(!second.ok && second.code === "CONFLICT", "second submit refused");
    if (!second.ok) {
      assert(
        second.message === "This assessment has already been submitted.",
        `message: ${second.message}`,
      );
    }
    assert(row.submittedAt === snapshot.submittedAt, "one submittedAt");
    assert(row.scorePercent === snapshot.scorePercent && row.passed === snapshot.passed, "one result");
    assert(row.scorePercent === 100 && row.passed === true, "scored from the saved answers");
  });

  await suite("15. two concurrent submits → exactly one succeeds", async () => {
    const f = await started();
    await answerAll(f);
    const results = await Promise.all([
      submitAttempt(f.store, C, { assignmentId: f.aC }),
      submitAttempt(f.store, C, { assignmentId: f.aC }),
    ]);
    const oks = results.filter((r) => r.ok).length;
    const conflicts = results.filter((r) => !r.ok && r.code === "CONFLICT").length;
    assert(oks === 1 && conflicts === 1, `expected 1 ok + 1 conflict, got ${oks} + ${conflicts}`);
  });

  await suite("16. save after submit → CONFLICT; the stored answer is unchanged", async () => {
    const f = await started();
    await answerAll(f);
    await submitAttempt(f.store, C, { assignmentId: f.aC });
    const before = f.answers.get(f.key(f.aC, f.q(1)))?.selectedOptionIds.join();
    const late = await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1b")] });
    assert(!late.ok && late.code === "CONFLICT", "late save refused");
    assert(
      f.answers.get(f.key(f.aC, f.q(1)))?.selectedOptionIds.join() === before,
      "answer unchanged",
    );
  });

  await suite("17. a required question left blank refuses submit and rolls back", async () => {
    const f = await started();
    await save(f, f.q(1), { kind: "choice", selectedOptionIds: [f.o("1a")] });
    await save(f, f.q(2), { kind: "choice", selectedOptionIds: [f.o("2a")] });
    await save(f, f.q(3), { kind: "text", text: "An answer." });
    const refused = await submitAttempt(f.store, C, { assignmentId: f.aC });
    assert(!refused.ok && refused.code === "INVALID", "INVALID");
    if (!refused.ok) {
      assert(
        refused.message === "Answer the 1 required question left before submitting.",
        `message: ${refused.message}`,
      );
    }
    const a = f.assignments.get(f.aC)!;
    assert(a.status === "STARTED" && a.submittedAt === null, "flip rolled back");
    await save(f, f.q(4), { kind: "file", fileUrl: "https://drive.example.com/f" });
    const ok = await submitAttempt(f.store, C, { assignmentId: f.aC });
    assert(ok.ok, "submits once complete");
  });

  await suite("18. a whitespace-only paragraph counts as unanswered", async () => {
    const f = await started();
    await answerAll(f);
    await save(f, f.q(3), { kind: "text", text: "   \n\t  " });
    const res = await submitAttempt(f.store, C, { assignmentId: f.aC });
    assert(!res.ok && res.code === "INVALID", "refused");
  });

  await suite("19. the submit response carries no score (D-1)", async () => {
    const f = await started();
    await answerAll(f);
    const res = await submitAttempt(f.store, C, { assignmentId: f.aC });
    assert(res.ok, "ok");
    if (res.ok) {
      assert(
        JSON.stringify(Object.keys(res.data)) === JSON.stringify(["submittedAt"]),
        `keys: ${Object.keys(res.data).join()}`,
      );
    }
  });

  // ---- scoring (finishAttempt) ---------------------------------------------

  await suite("20. single-select: right earns its points, wrong earns 0", () => {
    const right = finishAttempt(gradeInput({ answers: [pick("m1", ["a"])] }));
    const wrong = finishAttempt(gradeInput({ answers: [pick("m1", ["b"])] }));
    assert(right.ok && right.scorePercent === 40, "2 of 5 → 40");
    assert(wrong.ok && wrong.scorePercent === 0, "wrong → 0");
  });

  await suite("21. multi-select: only the exact set earns — subset and superset get 0", () => {
    const exact = finishAttempt(gradeInput({ answers: [pick("m2", ["y", "x"])] }));
    const subset = finishAttempt(gradeInput({ answers: [pick("m2", ["x"])] }));
    const superset = finishAttempt(gradeInput({ answers: [pick("m2", ["x", "y", "z"])] }));
    assert(exact.ok && exact.scorePercent === 60, "3 of 5 → 60");
    assert(subset.ok && subset.scorePercent === 0, "subset → 0");
    assert(superset.ok && superset.scorePercent === 0, "superset → 0");
  });

  await suite("22. PARAGRAPH and FILE_UPLOAD never change the score", () => {
    const res = finishAttempt(
      gradeInput({
        answers: [
          pick("m1", ["a"]),
          pick("m2", ["x", "y"]),
          { questionId: "p1", selectedOptionIds: [], text: "anything at all", fileUrl: null },
          { questionId: "f1", selectedOptionIds: [], text: null, fileUrl: "https://x.example" },
        ],
      }),
    );
    assert(res.ok && res.scorePercent === 100, "all MCQ right → 100 regardless");
  });

  await suite("23. weighting and rounding", () => {
    const three = (earnedPoints: number) => {
      const questions: GradeQuestion[] = [
        { id: "a", type: "MULTIPLE_CHOICE", points: 1, isRequired: false, maxWords: null, correctOptionIds: ["1"] },
        { id: "b", type: "MULTIPLE_CHOICE", points: 1, isRequired: false, maxWords: null, correctOptionIds: ["1"] },
        { id: "c", type: "MULTIPLE_CHOICE", points: 1, isRequired: false, maxWords: null, correctOptionIds: ["1"] },
      ];
      const answers = questions.slice(0, earnedPoints).map((q) => pick(q.id, ["1"]));
      return finishAttempt({ questions, answers, passMarkPercent: 60 });
    };
    const twoOfThree = three(2);
    const oneOfThree = three(1);
    assert(twoOfThree.ok && twoOfThree.scorePercent === 67, "2 of 3 → 67");
    assert(oneOfThree.ok && oneOfThree.scorePercent === 33, "1 of 3 → 33");
  });

  await suite("24. pass mark boundary: equal passes, one below does not", () => {
    const at = finishAttempt(gradeInput({ answers: [pick("m1", ["a"])], passMarkPercent: 40 }));
    const below = finishAttempt(gradeInput({ answers: [pick("m1", ["a"])], passMarkPercent: 41 }));
    assert(at.ok && at.passed === true, "40 ≥ 40 passes");
    assert(below.ok && below.passed === false, "40 < 41 fails");
  });

  await suite("25. an unanswered multiple-choice question earns 0", () => {
    const res = finishAttempt(gradeInput());
    assert(res.ok && res.scorePercent === 0 && res.passed === false, "nothing answered → 0, not passed");
  });

  // ---- list -----------------------------------------------------------------

  await suite("26. the list is this candidate's published assignments, newest first, no score", async () => {
    const mem = inMemoryStore();
    const older = mem.addAssessment("PUBLISHED", "Older");
    const newer = mem.addAssessment("PUBLISHED", "Newer");
    const draft = mem.addAssessment("DRAFT", "Draft");
    mem.addAssignment(older.id, C, new Date("2026-09-01T10:00:00Z"));
    mem.addAssignment(newer.id, C, new Date("2026-09-10T10:00:00Z"));
    mem.addAssignment(draft.id, C);
    mem.addAssignment(newer.id, D);
    const listed = await listCandidateAttempts(mem.store, C);
    assert(listed.ok, "ok");
    if (!listed.ok) return;
    assert(
      listed.data.map((r) => r.title).join() === "Newer,Older",
      `got ${listed.data.map((r) => r.title).join()}`,
    );
    const json = JSON.stringify(listed.data);
    assert(!json.includes("scorePercent") && !json.includes("passed"), "no score fields");
  });

  // ---- source scans ---------------------------------------------------------

  await suite("27. the candidate queries never select the answer key or the result", () => {
    const src = read("src/features/assessment-attempts/prisma-store.ts");
    const find = sliceBody(src, "async findAttempt(", /\n {4}async /);
    const list = sliceBody(src, "async listAttempts(", /\n {4}async /);
    for (const [name, body] of [["findAttempt", find], ["listAttempts", list]] as const) {
      for (const word of ["isCorrect", "scorePercent", "passed:"]) {
        assert(!body.includes(word), `${name} must not mention ${word}`);
      }
    }
    assert(find.includes("candidateUserId"), "findAttempt scopes by candidate");
    assert(
      list.includes("candidateUserId") && list.includes('status: "PUBLISHED"'),
      "listAttempts scopes by candidate and to PUBLISHED",
    );
    const submitAt = src.indexOf("async submit(");
    const firstKey = src.indexOf("isCorrect");
    assert(submitAt > 0 && firstKey > submitAt, "the answer key is read only inside submit");
  });

  await suite("28. guarded writes use plan 128 §10's guards and no relation filter", () => {
    const src = read("src/features/assessment-attempts/prisma-store.ts");
    const wheres = [...src.matchAll(/updateMany\(\{([\s\S]*?)data:/g)].map((m) => m[1] ?? "");
    assert(wheres.length === 3, `expected 3 guarded updateMany, found ${wheres.length}`);
    assert(
      wheres.every((w) => w.includes("candidateUserId") && !w.includes("assessment:")),
      "every guard scopes by candidate and carries no relation filter",
    );
    assert(wheres.some((w) => w.includes('status: "ASSIGNED"')), "start guards on ASSIGNED");
    assert(wheres.some((w) => w.includes('status: "STARTED"')), "save guards on STARTED");
    assert(
      wheres.some((w) => /status:\s*\{\s*in:\s*\["ASSIGNED",\s*"STARTED"\]\s*\}/.test(w)),
      "submit guards on ASSIGNED | STARTED",
    );
  });

  await suite("29. actions take the candidate from the session, never from input", () => {
    const src = read("src/app/actions/assessment-attempt-actions.ts");
    const exported = (src.match(/export async function /g) ?? []).length;
    const gated = (src.match(/await sessionUserId\(\)/g) ?? []).length;
    assert(exported === 3 && gated === 3, `every action calls sessionUserId() (${gated}/${exported})`);
    assert(!src.includes("candidateUserId"), "no user id is read from input");
    assert(!src.includes("console."), "no console");
    assert(!src.includes("scorePercent") && !/\bpassed\b/.test(src), "no score in responses");
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
