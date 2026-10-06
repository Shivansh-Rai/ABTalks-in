/**
 * Plan 166 — platform assessments: the text formatting parser and the rules
 * for editing a sent assessment.
 *   npm run test:platform-assessments
 */
import { parseInline, type FormatToken } from "@/lib/assessment-format";
import {
  addedGroups,
  editSentAssessment,
  structureChange,
  type PlatformAssessmentRow,
  type PlatformAudience,
  type PlatformStore,
  type SentEditInput,
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

/** Compact form of the tokens, e.g. `t:a|b:[t:x]|c:y`. */
function show(tokens: FormatToken[]): string {
  return tokens
    .map((t) =>
      t.kind === "text"
        ? `t:${t.text}`
        : t.kind === "code"
          ? `c:${t.text}`
          : `${t.kind[0]}:[${show(t.children)}]`,
    )
    .join("|");
}

// ---------------------------------------------------------------------------

const AUD = (a: Partial<PlatformAudience> = {}): PlatformAudience => ({
  all: false,
  domains: [],
  workshopEventIds: [],
  ...a,
});

function sentRow(): PlatformAssessmentRow {
  return {
    id: "pa_1",
    title: "Screen",
    subheading: null,
    instructions: null,
    status: "PUBLISHED",
    durationMinutes: 30,
    passMarkPercent: 60,
    strictMode: true,
    cameraRequired: false,
    deadlineAt: new Date(Date.now() + 3 * 86_400_000),
    audience: AUD({ domains: ["AI"] }),
    publishedAt: new Date(),
    updatedAt: new Date(),
    createdByLabel: "Admin",
    questions: [
      {
        id: "q1",
        position: 0,
        type: "MULTIPLE_CHOICE",
        title: "Which is FIFO?",
        helpText: null,
        isRequired: true,
        points: 2,
        allowMultipleCorrect: false,
        maxWords: null,
        uploadDestinationUrl: null,
        sectionId: null,
        options: [
          { id: "o1", position: 0, body: "Queue", isCorrect: true },
          { id: "o2", position: 1, body: "Stack", isCorrect: false },
        ],
      },
    ],
  };
}

/** The builder draft matching sentRow(), with overrides. */
function draft(over: Record<string, unknown> = {}) {
  return {
    assessmentId: "pa_1",
    title: "Screen",
    subheading: null,
    instructions: null,
    durationMinutes: 30,
    passMarkPercent: 60,
    cameraRequired: false,
    shortlistRefs: [],
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "Which is FIFO?",
        helpText: null,
        isRequired: true,
        points: 2,
        allowMultipleCorrect: false,
        options: [
          { body: "Queue", isCorrect: true },
          { body: "Stack", isCorrect: false },
        ],
      },
    ],
    ...over,
  };
}

function fakeStore(opts: { started: number; row?: PlatformAssessmentRow | null }) {
  const calls: { resolved: PlatformAudience[]; applied: SentEditInput[] } = {
    resolved: [],
    applied: [],
  };
  const row = opts.row === undefined ? sentRow() : opts.row;
  const store: PlatformStore = {
    async create() {
      return { id: "x" };
    },
    async replaceDraftContent() {
      return true;
    },
    async find() {
      return row;
    },
    async list() {
      return [];
    },
    async deleteDraft() {
      return true;
    },
    async resolveAudience(a) {
      calls.resolved.push(a);
      return ["u_new_1", "u_new_2"];
    },
    async publishAndAssign() {
      return { published: true, assigned: 0 };
    },
    async summarize() {
      return { sent: 0, started: 0, submitted: 0, missed: 0, passed: 0, failed: 0 };
    },
    async listAttempts() {
      return [];
    },
    async audienceOptions() {
      return { allCount: 0, domains: [], workshops: [] };
    },
    async countStarted() {
      return opts.started;
    },
    async applySentEdit(input) {
      calls.applied.push(input);
      return { ok: true, added: input.newRecipientIds.length };
    },
  };
  return { store, calls };
}

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

// ---------------------------------------------------------------------------

async function run() {
  console.log("\nPlan 166 — platform assessments\n");

  // ---- formatting ---------------------------------------------------------

  await suite("F1. *bold*, _italic_ and `code`", () => {
    assert(show(parseInline("a *b* c")) === "t:a |b:[t:b]|t: c", show(parseInline("a *b* c")));
    assert(show(parseInline("_i_")) === "i:[t:i]", show(parseInline("_i_")));
    assert(show(parseInline("use `x`")) === "t:use |c:x", show(parseInline("use `x`")));
  });

  await suite("F2. nothing inside backticks is formatted", () => {
    assert(show(parseInline("`a *b* _c_`")) === "c:a *b* _c_", show(parseInline("`a *b* _c_`")));
  });

  await suite("F3. snake_case, 2*3*4, spaced markers and lone markers stay literal", () => {
    for (const s of ["snake_case_name", "2*3*4", "* not bold *", "_ nope _", "a * b", "5 * 3"]) {
      assert(show(parseInline(s)) === `t:${s}`, `${s} → ${show(parseInline(s))}`);
    }
  });

  await suite("F4. line breaks are kept; markers never span them", () => {
    assert(show(parseInline("one\ntwo")) === "t:one\ntwo", "newline kept");
    assert(show(parseInline("a *b\nc* d")) === "t:a *b\nc* d", "no bold across lines");
  });

  await suite("F5. italic inside bold", () => {
    const out = show(parseInline("*bold _and italic_*"));
    assert(out === "b:[t:bold |i:[t:and italic]]", out);
  });

  // ---- editing a sent assessment -----------------------------------------

  await suite("E1. nobody started → full edit (questions may change)", async () => {
    const { store, calls } = fakeStore({ started: 0 });
    const res = await editSentAssessment(store, "admin", {
      assessmentId: "pa_1",
      draft: draft({ passMarkPercent: 80 }),
      audience: AUD({ domains: ["AI"] }),
      deadlineAt: inDays(5),
    });
    assert(res.ok && res.data.mode === "FULL", JSON.stringify(res));
    assert(calls.applied[0]?.change.mode === "FULL", "FULL applied");
  });

  await suite("E2. someone started → structural change refused with a reason", async () => {
    const { store, calls } = fakeStore({ started: 3 });
    const res = await editSentAssessment(store, "admin", {
      assessmentId: "pa_1",
      draft: draft({ passMarkPercent: 80 }),
      audience: AUD({ domains: ["AI"] }),
      deadlineAt: inDays(5),
    });
    assert(!res.ok && res.code === "CONFLICT", JSON.stringify(res));
    assert(!res.ok && res.message.includes("3 candidates have started"), res.ok ? "" : res.message);
    assert(!res.ok && res.message.includes("pass mark"), "names what changed");
    assert(calls.applied.length === 0, "nothing written");
  });

  await suite("E3. someone started → wording edit saved in place", async () => {
    const { store, calls } = fakeStore({ started: 1 });
    const d = draft({ title: "Screen v2", instructions: "Read *carefully*" });
    (d.questions as { title: string; options: { body: string }[] }[])[0].title = "Which one is FIFO?";
    (d.questions as { title: string; options: { body: string }[] }[])[0].options[1].body = "A stack";
    const res = await editSentAssessment(store, "admin", {
      assessmentId: "pa_1",
      draft: d,
      audience: AUD({ domains: ["AI"] }),
      deadlineAt: inDays(5),
    });
    assert(res.ok && res.data.mode === "WORDING", JSON.stringify(res));
    const change = calls.applied[0]?.change;
    assert(change?.mode === "WORDING", "WORDING applied");
    if (change?.mode === "WORDING") {
      assert(change.wording.title === "Screen v2", "title");
      assert(change.wording.questions[0].title === "Which one is FIFO?", "question");
      assert(change.wording.questions[0].options[1] === "A stack", "option");
    }
  });

  await suite("E4. a group that already received it can't be removed", async () => {
    const { store } = fakeStore({ started: 0 });
    const res = await editSentAssessment(store, "admin", {
      assessmentId: "pa_1",
      draft: draft(),
      audience: AUD({ domains: ["DS"] }),
      deadlineAt: inDays(5),
    });
    assert(!res.ok && res.code === "INVALID", JSON.stringify(res));
  });

  await suite("E5. added groups only are resolved and sent", async () => {
    const { store, calls } = fakeStore({ started: 2 });
    const res = await editSentAssessment(store, "admin", {
      assessmentId: "pa_1",
      draft: draft(),
      audience: AUD({ domains: ["AI", "DS"], workshopEventIds: ["w1"] }),
      deadlineAt: inDays(5),
    });
    assert(res.ok && res.data.added === 2, JSON.stringify(res));
    const asked = calls.resolved[0];
    assert(
      asked && !asked.all && asked.domains.join() === "DS" && asked.workshopEventIds.join() === "w1",
      `resolved ${JSON.stringify(asked)}`,
    );
  });

  await suite("E6. deadline must be at least 15 minutes out", async () => {
    const { store } = fakeStore({ started: 0 });
    const res = await editSentAssessment(store, "admin", {
      assessmentId: "pa_1",
      draft: draft(),
      audience: AUD({ domains: ["AI"] }),
      deadlineAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    assert(!res.ok && res.code === "INVALID", JSON.stringify(res));
  });

  await suite("E6b. no deadline (null) is allowed when editing", async () => {
    const { store, calls } = fakeStore({ started: 1 });
    const res = await editSentAssessment(store, "admin", {
      assessmentId: "pa_1",
      draft: draft(),
      audience: AUD({ domains: ["AI"] }),
      deadlineAt: null,
    });
    assert(res.ok, JSON.stringify(res));
    assert(calls.applied[0]?.deadlineAt === null, "null deadline written");
  });

  await suite("E7. drafts can't be edited through the sent-edit path", async () => {
    const row = { ...sentRow(), status: "DRAFT" as const };
    const { store } = fakeStore({ started: 0, row });
    const res = await editSentAssessment(store, "admin", {
      assessmentId: "pa_1",
      draft: draft(),
      audience: AUD({ domains: ["AI"] }),
      deadlineAt: inDays(5),
    });
    assert(!res.ok && res.code === "CONFLICT", JSON.stringify(res));
  });

  await suite("E8. structureChange: correct answer and option count are structural", () => {
    const row = sentRow();
    const swap = draft();
    const q = (swap.questions as { options: { isCorrect: boolean }[] }[])[0];
    q.options[0].isCorrect = false;
    q.options[1].isCorrect = true;
    // structureChange takes the parsed draft shape; the literal matches it.
    assert(
      structureChange(row, swap as never) === "question 1's correct answer",
      "correct answer",
    );
    const more = draft();
    (more.questions as { options: { body: string; isCorrect: boolean }[] }[])[0].options.push({
      body: "Heap",
      isCorrect: false,
    });
    assert(structureChange(row, more as never) === "question 1's options", "option count");
    assert(structureChange(row, draft() as never) === null, "identical → null");
  });

  await suite("E9. addedGroups: switching to All counts as adding", () => {
    const out = addedGroups(AUD({ domains: ["AI"] }), AUD({ all: true, domains: ["AI"] }));
    assert(out.all && out.domains.length === 0, JSON.stringify(out));
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
