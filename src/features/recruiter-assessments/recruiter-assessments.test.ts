/**
 * Plan 121 recruiter assessment builder acceptance tests.
 *   npm run test:recruiter-assessments
 */
import {
  createAssessment,
  saveAssessmentDraft,
  getAssessment,
  deleteAssessment,
  listAssessments,
  type AssessmentListRow,
  type AssessmentRow,
  type AssessmentStore,
  type ContentInput,
  type Scope,
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

const SCOPE_A: Scope = {
  organizationId: "org_a",
  createdByUserId: "user_a",
};
const SCOPE_B: Scope = {
  organizationId: "org_b",
  createdByUserId: "user_b",
};

function validMcqDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: "Backend screen",
    subheading: null,
    instructions: null,
    durationMinutes: 30,
    passMarkPercent: 70,
    shortlistRefs: ["AB-1001"],
    questions: [
      {
        type: "MULTIPLE_CHOICE" as const,
        title: "Which is a queue?",
        helpText: null,
        isRequired: true,
        points: 2,
        allowMultipleCorrect: false,
        options: [
          { body: "FIFO", isCorrect: true },
          { body: "LIFO", isCorrect: false },
        ],
      },
    ],
    ...overrides,
  };
}

function inMemoryStore(): AssessmentStore & {
  rows: Map<string, AssessmentRow>;
} {
  const rows = new Map<string, AssessmentRow>();
  let seq = 0;
  let qSeq = 0;
  let oSeq = 0;

  function buildQuestions(
    assessmentId: string,
    questions: ContentInput["questions"],
  ) {
    return questions.map((q, i) => {
      const id = `q_${++qSeq}`;
      const base = {
        id,
        position: i,
        title: q.title,
        helpText: q.helpText ?? null,
        isRequired: q.isRequired,
        points: q.points,
        sectionId: null as string | null,
      };
      if (q.type === "MULTIPLE_CHOICE") {
        return {
          ...base,
          type: "MULTIPLE_CHOICE" as const,
          allowMultipleCorrect: q.allowMultipleCorrect,
          maxWords: null,
          uploadDestinationUrl: null,
          options: q.options.map((o, j) => ({
            id: `o_${++oSeq}`,
            position: j,
            body: o.body,
            isCorrect: o.isCorrect,
          })),
        };
      }
      if (q.type === "PARAGRAPH") {
        return {
          ...base,
          type: "PARAGRAPH" as const,
          allowMultipleCorrect: false,
          maxWords: q.maxWords,
          uploadDestinationUrl: null,
          options: [],
        };
      }
      return {
        ...base,
        type: "FILE_UPLOAD" as const,
        allowMultipleCorrect: false,
        maxWords: null,
        uploadDestinationUrl: q.uploadDestinationUrl,
        options: [],
      };
    });
  }

  return {
    rows,
    async create(scope, input) {
      const id = `ra_${++seq}`;
      const now = new Date();
      rows.set(id, {
        id,
        organizationId: scope.organizationId,
        createdByUserId: scope.createdByUserId,
        title: input.title,
        subheading: input.subheading,
        instructions: input.instructions,
        status: "DRAFT",
        durationMinutes: input.durationMinutes,
        passMarkPercent: input.passMarkPercent,
        shortlistRefs: input.shortlistRefs,
        publishedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        questions: buildQuestions(id, input.questions),
      });
      return { id };
    },
    async replaceContent(assessmentId, scope, input) {
      const row = rows.get(assessmentId);
      if (
        !row ||
        row.organizationId !== scope.organizationId ||
        row.createdByUserId !== scope.createdByUserId
      ) {
        throw new Error("not owned");
      }
      rows.set(assessmentId, {
        ...row,
        title: input.title,
        subheading: input.subheading,
        instructions: input.instructions,
        durationMinutes: input.durationMinutes,
        passMarkPercent: input.passMarkPercent,
        shortlistRefs: input.shortlistRefs,
        updatedAt: new Date(),
        questions: buildQuestions(assessmentId, input.questions),
      });
    },
    async findOwned(assessmentId, scope) {
      const row = rows.get(assessmentId);
      if (!row) return null;
      if (
        row.organizationId !== scope.organizationId ||
        row.createdByUserId !== scope.createdByUserId
      ) {
        return null;
      }
      return row;
    },
    async listOwned(scope): Promise<AssessmentListRow[]> {
      return [...rows.values()]
        .filter(
          (r) =>
            r.organizationId === scope.organizationId &&
            r.createdByUserId === scope.createdByUserId,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          durationMinutes: r.durationMinutes,
          passMarkPercent: r.passMarkPercent,
          questionCount: r.questions.length,
          updatedAt: r.updatedAt,
        }));
    },
    async delete(assessmentId, scope) {
      const row = rows.get(assessmentId);
      if (
        !row ||
        row.organizationId !== scope.organizationId ||
        row.createdByUserId !== scope.createdByUserId
      ) {
        return false;
      }
      rows.delete(assessmentId);
      return true;
    },
  };
}

async function run() {
  console.log("\nPlan 121 recruiter assessments acceptance tests\n");

  await suite("create returns an id", async () => {
    const store = inMemoryStore();
    const res = await createAssessment(store, SCOPE_A, validMcqDraft());
    assert(res.ok, "create must succeed");
    if (!res.ok) return;
    assert(typeof res.data.id === "string" && res.data.id.length > 0, "id set");
    assert(store.rows.get(res.data.id)?.status === "DRAFT", "saved as DRAFT");
  });

  await suite("save replaces questions and renumbers positions from 0", async () => {
    const store = inMemoryStore();
    const created = await createAssessment(store, SCOPE_A, validMcqDraft());
    assert(created.ok, "setup create");
    if (!created.ok) return;

    const res = await saveAssessmentDraft(store, SCOPE_A, {
      ...validMcqDraft(),
      assessmentId: created.data.id,
      questions: [
        {
          type: "PARAGRAPH",
          title: "Explain CAP",
          helpText: null,
          isRequired: true,
          points: 5,
          maxWords: 250,
        },
        {
          type: "MULTIPLE_CHOICE",
          title: "Pick one",
          helpText: null,
          isRequired: true,
          points: 1,
          allowMultipleCorrect: false,
          options: [
            { body: "A", isCorrect: true },
            { body: "B", isCorrect: false },
            { body: "C", isCorrect: false },
          ],
        },
      ],
    });
    assert(res.ok, "save must succeed");
    if (!res.ok) return;
    const row = store.rows.get(created.data.id)!;
    assert(row.questions.length === 2, "two questions");
    assert(row.questions[0]?.position === 0, "first at 0");
    assert(row.questions[1]?.position === 1, "second at 1");
    assert(row.questions[0]?.type === "PARAGRAPH", "order replaced");
  });

  await suite(
    "foreign workspace id resolves to NOT_FOUND on read, save and delete",
    async () => {
      const store = inMemoryStore();
      const created = await createAssessment(store, SCOPE_A, validMcqDraft());
      assert(created.ok, "setup");
      if (!created.ok) return;
      const id = created.data.id;

      const got = await getAssessment(store, SCOPE_B, id);
      assert(!got.ok && got.code === "NOT_FOUND", "read NOT_FOUND");

      const saved = await saveAssessmentDraft(store, SCOPE_B, {
        ...validMcqDraft(),
        assessmentId: id,
      });
      assert(!saved.ok && saved.code === "NOT_FOUND", "save NOT_FOUND");

      const deleted = await deleteAssessment(store, SCOPE_B, id);
      assert(!deleted.ok && deleted.code === "NOT_FOUND", "delete NOT_FOUND");

      assert(store.rows.has(id), "row still owned by A");
      const listB = await listAssessments(store, SCOPE_B);
      assert(listB.ok && listB.data.length === 0, "B list empty");
    },
  );

  await suite("saving a PUBLISHED row is refused", async () => {
    const store = inMemoryStore();
    const created = await createAssessment(store, SCOPE_A, validMcqDraft());
    assert(created.ok, "setup");
    if (!created.ok) return;
    const row = store.rows.get(created.data.id)!;
    row.status = "PUBLISHED";

    const saved = await saveAssessmentDraft(store, SCOPE_A, {
      ...validMcqDraft(),
      assessmentId: created.data.id,
    });
    assert(!saved.ok, "must refuse");
    if (saved.ok) return;
    assert(saved.code === "CONFLICT", `expected CONFLICT, got ${saved.code}`);
    assert(
      saved.message.includes("published"),
      "message mentions published",
    );
  });

  await suite("MCQ with zero correct options is rejected", async () => {
    const store = inMemoryStore();
    const res = await createAssessment(
      store,
      SCOPE_A,
      validMcqDraft({
        questions: [
          {
            type: "MULTIPLE_CHOICE",
            title: "No correct",
            helpText: null,
            isRequired: true,
            points: 1,
            allowMultipleCorrect: false,
            options: [
              { body: "A", isCorrect: false },
              { body: "B", isCorrect: false },
            ],
          },
        ],
      }),
    );
    assert(!res.ok && res.code === "INVALID", "rejected as INVALID");
  });

  await suite(
    "single-correct MCQ with two correct options is rejected",
    async () => {
      const store = inMemoryStore();
      const res = await createAssessment(
        store,
        SCOPE_A,
        validMcqDraft({
          questions: [
            {
              type: "MULTIPLE_CHOICE",
              title: "Two correct",
              helpText: null,
              isRequired: true,
              points: 1,
              allowMultipleCorrect: false,
              options: [
                { body: "A", isCorrect: true },
                { body: "B", isCorrect: true },
              ],
            },
          ],
        }),
      );
      assert(!res.ok && res.code === "INVALID", "rejected as INVALID");
    },
  );

  await suite("paragraph question carrying options is rejected", async () => {
    const store = inMemoryStore();
    const res = await createAssessment(
      store,
      SCOPE_A,
      validMcqDraft({
        questions: [
          {
            type: "PARAGRAPH",
            title: "Write about queues",
            helpText: null,
            isRequired: true,
            points: 3,
            maxWords: 250,
            options: [
              { body: "should not be here", isCorrect: false },
              { body: "nor this", isCorrect: false },
            ],
          },
        ],
      }),
    );
    assert(!res.ok && res.code === "INVALID", "rejected as INVALID");
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
