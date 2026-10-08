/**
 * Plan 185 — recruiter-owned assessment templates + import from JSON.
 *   npm run test:assessment-templates
 *
 * Three things are held here:
 *   1. the import parser refuses anything it cannot fully understand, and the
 *      shipped sample is importable exactly as downloaded;
 *   2. a template belongs to one recruiter, and another recruiter's id reads
 *      as "not found" on every path;
 *   3. admin has no template surface at all.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_TEMPLATES_PER_RECRUITER,
  assessmentContentSchema,
  assessmentDraftSchema,
  type AssessmentContent,
} from "@/lib/validations/assessment";
import {
  MAX_IMPORT_BYTES,
  parseAssessmentImport,
  stripJsonComments,
} from "@/lib/validations/assessment-import";
import type { Scope } from "./service";
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  renameTemplate,
  updateTemplateContent,
  type TemplateStore,
  type TemplateSummary,
} from "./templates";

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

function readSource(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const SCOPE_A: Scope = { organizationId: "org_a", createdByUserId: "user_a" };
const SCOPE_B: Scope = { organizationId: "org_b", createdByUserId: "user_b" };

type Stored = Scope & {
  id: string;
  name: string;
  description: string | null;
  content: unknown;
  questionCount: number;
  durationMinutes: number | null;
  updatedAt: Date;
};

/** A store that enforces the scope the way the Prisma one does: in the WHERE. */
function memoryStore(): TemplateStore & { rows: Map<string, Stored> } {
  const rows = new Map<string, Stored>();
  let seq = 0;
  const owned = (row: Stored | undefined, scope: Scope): row is Stored =>
    row !== undefined &&
    row.organizationId === scope.organizationId &&
    row.createdByUserId === scope.createdByUserId;

  return {
    rows,
    async count(scope) {
      return [...rows.values()].filter((r) => owned(r, scope)).length;
    },
    async list(scope): Promise<TemplateSummary[]> {
      return [...rows.values()]
        .filter((r) => owned(r, scope))
        .map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          questionCount: r.questionCount,
          durationMinutes: r.durationMinutes,
          updatedAt: r.updatedAt,
        }));
    },
    async find(templateId, scope) {
      const row = rows.get(templateId);
      if (!owned(row, scope)) return null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        content: row.content,
      };
    },
    async create(scope, input) {
      const id = `tpl_${++seq}`;
      rows.set(id, {
        ...scope,
        id,
        name: input.name,
        description: input.description,
        content: input.content,
        questionCount: input.content.questions.length,
        durationMinutes: input.content.durationMinutes,
        updatedAt: new Date(),
      });
      return { id };
    },
    async updateContent(templateId, scope, content) {
      const row = rows.get(templateId);
      if (!owned(row, scope)) return false;
      row.content = content;
      row.questionCount = content.questions.length;
      row.durationMinutes = content.durationMinutes;
      return true;
    },
    async rename(templateId, scope, input) {
      const row = rows.get(templateId);
      if (!owned(row, scope)) return false;
      row.name = input.name;
      row.description = input.description;
      return true;
    },
    async delete(templateId, scope) {
      if (!owned(rows.get(templateId), scope)) return false;
      rows.delete(templateId);
      return true;
    },
  };
}

function mcq(title = "Pick one") {
  return {
    type: "MULTIPLE_CHOICE" as const,
    title,
    helpText: null,
    isRequired: true,
    points: 1,
    allowMultipleCorrect: false,
    options: [
      { body: "A", isCorrect: true },
      { body: "B", isCorrect: false },
    ],
  };
}

function validContent(overrides: Partial<AssessmentContent> = {}): AssessmentContent {
  return {
    title: "Backend screen",
    subheading: null,
    instructions: null,
    durationMinutes: 30,
    passMarkPercent: 60,
    cameraRequired: false,
    questions: [mcq()],
    ...overrides,
  };
}

/** A minimal valid import file, as an object the tests then break. */
function validFile(): Record<string, unknown> {
  return {
    formatVersion: 1,
    title: "Imported screen",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        title: "Pick one",
        options: [{ body: "A", isCorrect: true }, { body: "B" }],
      },
      { type: "PARAGRAPH", title: "Explain" },
    ],
  };
}

function importOf(file: unknown) {
  return parseAssessmentImport(JSON.stringify(file));
}

const SAMPLE = readSource("public/documents/assessment-import-format.json");

async function run() {
  console.log("\nPlan 185 — import from JSON\n");

  await suite("I1. the shipped sample imports exactly as downloaded", () => {
    const res = parseAssessmentImport(SAMPLE);
    assert(res.ok, `sample must import${res.ok ? "" : `: ${res.issues.join(" | ")}`}`);
    if (!res.ok) return;
    assert(res.data.questions.length === 4, "one question of each kind, two MCQs");
    const types = res.data.questions.map((q) => q.type).join(",");
    assert(
      types === "MULTIPLE_CHOICE,MULTIPLE_CHOICE,PARAGRAPH,FILE_UPLOAD",
      `all three types present, got ${types}`,
    );
    // Its optional fields are commented out, so the builder's defaults apply.
    assert(res.data.durationMinutes === null, "untimed by default");
    assert(res.data.passMarkPercent === 60, "pass mark defaults to 60");
    assert(res.data.cameraRequired === false, "camera defaults to off");
    assert(!("formatVersion" in res.data), "the version is not assessment content");
  });

  await suite("I2. every commented-out value in the sample is itself valid", () => {
    // Optional fields ship as `// "field": value,`. Enabling all of them at
    // once must still import, or the sample would teach a broken file.
    const enabled = SAMPLE.replace(/^(\s*)\/\/ (".*)$/gm, "$1$2");
    assert(enabled !== SAMPLE, "the sample has commented-out values to enable");
    const res = parseAssessmentImport(enabled);
    assert(res.ok, `must import${res.ok ? "" : `: ${res.issues.join(" | ")}`}`);
    if (!res.ok) return;
    assert(res.data.subheading === "A short screen for backend roles", "subheading read");
    assert(res.data.durationMinutes === 30, "duration read");
    assert(res.data.questions[0]!.helpText === "Pick one.", "help text read");
    const paragraph = res.data.questions[2]!;
    assert(paragraph.type === "PARAGRAPH" && paragraph.maxWords === 250, "word limit read");
  });

  await suite("I3. imported content is a draft the builder can save and publish", () => {
    const res = parseAssessmentImport(SAMPLE);
    assert(res.ok, "sample imports");
    if (!res.ok) return;
    const draft = assessmentDraftSchema.safeParse({ ...res.data, shortlistRefs: [] });
    assert(draft.success, "passes the same schema Save draft uses");
    assert(
      res.data.questions.some((q) => q.type === "MULTIPLE_CHOICE" && q.points > 0),
      "has a multiple-choice question worth points, so it can be published",
    );
    assert(assessmentContentSchema.safeParse(res.data).success, "and can be saved as a template");
  });

  await suite("I4. comments, trailing commas and a BOM are accepted; strings are never touched", () => {
    const text =
      "﻿// header\n" +
      '{ "formatVersion": 1, /* inline */ "title": "a, // not a comment /* nor this */",\n' +
      '  "questions": [\n' +
      '    { "type": "FILE_UPLOAD", "title": "Upload \\"it\\" here", "uploadDestinationUrl": "https://x.example/a//b", },\n' +
      '    { "type": "MULTIPLE_CHOICE", "title": "m", "options": [ { "body": "a", "isCorrect": true }, { "body": "b" }, ] },\n' +
      "  ],\n" +
      "}\n";
    const res = parseAssessmentImport(text);
    assert(res.ok, `must import${res.ok ? "" : `: ${res.issues.join(" | ")}`}`);
    if (!res.ok) return;
    assert(res.data.title === "a, // not a comment /* nor this */", "comment-like text in a string kept");
    const upload = res.data.questions[0]!;
    assert(
      upload.type === "FILE_UPLOAD" && upload.uploadDestinationUrl === "https://x.example/a//b",
      "a // inside a URL is data",
    );
    assert(upload.title === 'Upload "it" here', "escaped quotes do not end the string");
    // Comments are blanked, not removed, so parse errors keep their line numbers.
    assert(
      stripJsonComments("a // b\nc").split("\n").length === 2,
      "newlines survive stripping",
    );
  });

  await suite("I5. an unknown key is refused and named, at every level", () => {
    const top = importOf({ ...validFile(), assessmentId: "x" });
    assert(!top.ok && top.issues.some((i) => i.includes('"assessmentId"')), "top-level key named");

    const shortlist = importOf({ ...validFile(), shortlistRefs: ["PROGRAM:m1"] });
    assert(!shortlist.ok && shortlist.issues.some((i) => i.includes('"shortlistRefs"')), "a file cannot carry a shortlist");

    const q = validFile();
    (q.questions as Record<string, unknown>[])[1]!.isRequird = false;
    const question = importOf(q);
    assert(
      !question.ok && question.issues.some((i) => i.startsWith("Question 2") && i.includes('"isRequird"')),
      "question-level key named with its question",
    );

    // The option schema is not strict on its own: without the raw-file check
    // this typo is dropped and the file fails only as "no correct option".
    const o = validFile();
    (o.questions as { options: unknown[] }[])[0]!.options[0] = { body: "A", isCorect: true };
    const option = importOf(o);
    assert(!option.ok, "refused");
    if (option.ok) return;
    assert(
      option.issues[0] === 'Question 1, option 1: Unrecognized key: "isCorect"',
      `the typo is the first thing reported, got: ${option.issues[0]}`,
    );

    // Refused even when the rest of the file is valid.
    const extra = validFile();
    (extra.questions as { options: unknown[] }[])[0]!.options[1] = { body: "B", note: "hi" };
    const harmless = importOf(extra);
    assert(!harmless.ok && harmless.issues.some((i) => i.includes('"note"')), "an extra option key alone refuses the file");
  });

  await suite("I6. the format version is required and must be 1", () => {
    const { formatVersion: _v, ...noVersion } = validFile();
    void _v;
    const missing = importOf(noVersion);
    assert(!missing.ok && missing.issues.some((i) => i.startsWith("formatVersion")), "missing refused");
    const future = importOf({ ...validFile(), formatVersion: 2 });
    assert(!future.ok && future.issues.some((i) => i.startsWith("formatVersion")), "another version refused");
  });

  await suite("I7. between 1 and 100 questions", () => {
    const many = (n: number) => ({
      ...validFile(),
      questions: Array.from({ length: n }, (_, i) => ({
        type: "MULTIPLE_CHOICE",
        title: `Q${i + 1}`,
        options: [{ body: "A", isCorrect: true }, { body: "B" }],
      })),
    });
    assert(!importOf(many(0)).ok, "no questions refused");
    assert(importOf(many(100)).ok, "100 accepted");
    assert(!importOf(many(101)).ok, "101 refused");
  });

  await suite("I8. a multiple-choice question needs its correct option, and says which question", () => {
    const none = validFile();
    (none.questions as { options: unknown[] }[])[0]!.options = [{ body: "A" }, { body: "B" }];
    const res = importOf(none);
    assert(
      !res.ok && res.issues.some((i) => i === "Question 1, options: Mark at least one option as correct"),
      "no correct option named",
    );
    const two = validFile();
    (two.questions as { options: unknown[] }[])[0]!.options = [
      { body: "A", isCorrect: true },
      { body: "B", isCorrect: true },
    ];
    const res2 = importOf(two);
    assert(
      !res2.ok && res2.issues.some((i) => i.includes("Pick exactly one correct option")),
      "two correct without allowMultipleCorrect refused",
    );
  });

  await suite("I9. a missing or unknown question type is named", () => {
    const bad = validFile();
    (bad.questions as Record<string, unknown>[])[1]!.type = "ESSAY";
    const res = importOf(bad);
    assert(
      !res.ok && res.issues.some((i) => i.startsWith("Question 2") && i.includes("MULTIPLE_CHOICE")),
      "unknown type lists the allowed ones",
    );
    const none = validFile();
    delete (none.questions as Record<string, unknown>[])[1]!.type;
    const res2 = importOf(none);
    assert(!res2.ok && res2.issues.some((i) => i.startsWith("Question 2")), "missing type refused");
  });

  await suite("I10. junk never throws: empty, not JSON, not an object", () => {
    for (const text of ["", "   \n", "not json", "{", '{ "title": }', "[1,2]", "null", "42", '"text"']) {
      const res = parseAssessmentImport(text);
      assert(!res.ok, `refused: ${JSON.stringify(text)}`);
      if (!res.ok) assert(res.message.length > 0, "with a message");
    }
  });

  await suite("I11. all or nothing: one bad question refuses the whole file", () => {
    const file = validFile();
    (file.questions as Record<string, unknown>[]).push({ type: "FILE_UPLOAD", title: "x", uploadDestinationUrl: "not a link" });
    const res = importOf(file);
    assert(!res.ok, "refused");
    assert(!("data" in res), "no partial content is returned");
    if (!res.ok) assert(res.issues.some((i) => i.startsWith("Question 3")), "the bad one is named");
  });

  await suite("I12. the file is read in the browser, size-checked first, and never sent anywhere", () => {
    assert(MAX_IMPORT_BYTES === 1_000_000, "1 MB");
    const ui = readSource("src/components/hire/assessment/assessment-json-import.tsx");
    const sizeAt = ui.indexOf("file.size > MAX_IMPORT_BYTES");
    const readAt = ui.indexOf("file.text()");
    assert(sizeAt >= 0 && readAt > sizeAt, "the size is checked before the file is read");
    assert(!ui.includes("@/app/actions"), "the import control calls no server action");
    assert(!ui.includes("fetch("), "and makes no request");
    const parser = readSource("src/lib/validations/assessment-import.ts");
    assert(!parser.includes('"server-only"') && !parser.includes("@/lib/db"), "the parser is client-safe");
  });

  console.log("\nPlan 185 — a recruiter's own templates\n");

  await suite("T1. save, list and open a template", async () => {
    const store = memoryStore();
    const created = await createTemplate(store, SCOPE_A, {
      name: "  Backend round 1  ",
      description: "First screen",
      content: validContent(),
    });
    assert(created.ok, "created");
    if (!created.ok) return;
    const list = await listTemplates(store, SCOPE_A);
    assert(list.ok && list.data.length === 1, "listed");
    if (!list.ok) return;
    const card = list.data[0]!;
    assert(card.name === "Backend round 1", "name trimmed");
    assert(card.questionCount === 1 && card.durationMinutes === 30, "card facts mirror the content");
    assert(!("content" in card), "the list carries no question bodies");
    const got = await getTemplate(store, SCOPE_A, created.data.id);
    assert(got.ok && got.data.content.title === "Backend screen", "opens with its content");
  });

  await suite("T2. another recruiter cannot list, open, update, rename or delete it", async () => {
    const store = memoryStore();
    const created = await createTemplate(store, SCOPE_A, { name: "Mine", content: validContent() });
    assert(created.ok, "created");
    if (!created.ok) return;
    const id = created.data.id;

    const list = await listTemplates(store, SCOPE_B);
    assert(list.ok && list.data.length === 0, "B's list is empty");
    const get = await getTemplate(store, SCOPE_B, id);
    assert(!get.ok && get.code === "NOT_FOUND", "open → NOT_FOUND");
    const update = await updateTemplateContent(store, SCOPE_B, {
      templateId: id,
      content: validContent({ title: "Hijacked" }),
    });
    assert(!update.ok && update.code === "NOT_FOUND", "update → NOT_FOUND");
    const rename = await renameTemplate(store, SCOPE_B, { templateId: id, name: "Hijacked" });
    assert(!rename.ok && rename.code === "NOT_FOUND", "rename → NOT_FOUND");
    const del = await deleteTemplate(store, SCOPE_B, { templateId: id });
    assert(!del.ok && del.code === "NOT_FOUND", "delete → NOT_FOUND");

    const row = store.rows.get(id)!;
    assert(row.name === "Mine", "name untouched");
    assert((row.content as AssessmentContent).title === "Backend screen", "content untouched");
  });

  await suite("T3. both halves of the key matter: same workspace or same user alone is not enough", async () => {
    const store = memoryStore();
    const created = await createTemplate(store, SCOPE_A, { name: "Mine", content: validContent() });
    assert(created.ok, "created");
    if (!created.ok) return;
    const sameOrgOtherUser: Scope = { organizationId: "org_a", createdByUserId: "user_b" };
    const sameUserOtherOrg: Scope = { organizationId: "org_b", createdByUserId: "user_a" };
    for (const scope of [sameOrgOtherUser, sameUserOtherOrg]) {
      const get = await getTemplate(store, scope, created.data.id);
      assert(!get.ok && get.code === "NOT_FOUND", "NOT_FOUND");
      const list = await listTemplates(store, scope);
      assert(list.ok && list.data.length === 0, "not listed");
    }
  });

  await suite("T4. an owner named in the input is ignored: the scope is the session's", async () => {
    const store = memoryStore();
    const created = await createTemplate(store, SCOPE_A, {
      name: "Mine",
      content: validContent(),
      organizationId: "org_b",
      createdByUserId: "user_b",
    });
    assert(created.ok, "created");
    if (!created.ok) return;
    const row = store.rows.get(created.data.id)!;
    assert(row.organizationId === "org_a" && row.createdByUserId === "user_a", "stored under the caller");
    const asB = await listTemplates(store, SCOPE_B);
    assert(asB.ok && asB.data.length === 0, "B received nothing");
  });

  await suite("T5. Update template replaces the content and keeps the name", async () => {
    const store = memoryStore();
    const created = await createTemplate(store, SCOPE_A, {
      name: "Round 1",
      description: "Keep me",
      content: validContent(),
    });
    assert(created.ok, "created");
    if (!created.ok) return;
    const res = await updateTemplateContent(store, SCOPE_A, {
      templateId: created.data.id,
      content: validContent({
        title: "Round 1, revised",
        durationMinutes: null,
        questions: [mcq("One"), mcq("Two")],
      }),
    });
    assert(res.ok, "updated");
    const got = await getTemplate(store, SCOPE_A, created.data.id);
    assert(got.ok, "opens");
    if (!got.ok) return;
    assert(got.data.name === "Round 1" && got.data.description === "Keep me", "name and description kept");
    assert(got.data.content.title === "Round 1, revised", "content replaced");
    const list = await listTemplates(store, SCOPE_A);
    assert(
      list.ok && list.data[0]!.questionCount === 2 && list.data[0]!.durationMinutes === null,
      "the card's facts follow the content",
    );
  });

  await suite("T6. rename changes name and description only", async () => {
    const store = memoryStore();
    const created = await createTemplate(store, SCOPE_A, { name: "Old", content: validContent() });
    assert(created.ok, "created");
    if (!created.ok) return;
    const id = created.data.id;
    const ok = await renameTemplate(store, SCOPE_A, { templateId: id, name: " New ", description: "   " });
    assert(ok.ok, "renamed");
    const row = store.rows.get(id)!;
    assert(row.name === "New", "trimmed");
    assert(row.description === null, "a blank description is stored as none");
    assert((row.content as AssessmentContent).title === "Backend screen", "content untouched");

    const blank = await renameTemplate(store, SCOPE_A, { templateId: id, name: "   " });
    assert(!blank.ok && blank.code === "INVALID", "a blank name is refused");
    const long = await renameTemplate(store, SCOPE_A, { templateId: id, name: "x".repeat(121) });
    assert(!long.ok && long.code === "INVALID", "a 121-character name is refused");
    assert(store.rows.get(id)!.name === "New", "and nothing changed");
  });

  await suite("T7. delete removes it once", async () => {
    const store = memoryStore();
    const created = await createTemplate(store, SCOPE_A, { name: "Gone", content: validContent() });
    assert(created.ok, "created");
    if (!created.ok) return;
    const del = await deleteTemplate(store, SCOPE_A, { templateId: created.data.id });
    assert(del.ok && store.rows.size === 0, "deleted");
    const again = await deleteTemplate(store, SCOPE_A, { templateId: created.data.id });
    assert(!again.ok && again.code === "NOT_FOUND", "second delete → NOT_FOUND");
  });

  await suite(`T8. at most ${MAX_TEMPLATES_PER_RECRUITER} per recruiter, counted per recruiter`, async () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_TEMPLATES_PER_RECRUITER; i++) {
      const res = await createTemplate(store, SCOPE_A, { name: `T${i}`, content: validContent() });
      assert(res.ok, `template ${i + 1} saved`);
    }
    const over = await createTemplate(store, SCOPE_A, { name: "One more", content: validContent() });
    assert(!over.ok && over.code === "CONFLICT", "the next one is refused");
    const other = await createTemplate(store, SCOPE_B, { name: "B's first", content: validContent() });
    assert(other.ok, "another recruiter is not affected by A's count");
    // Same name twice is fine.
    const dup = await createTemplate(store, SCOPE_B, { name: "B's first", content: validContent() });
    assert(dup.ok, "duplicate names are allowed");
  });

  await suite("T9. invalid content is never stored", async () => {
    const store = memoryStore();
    const cases: [string, unknown][] = [
      ["no questions", validContent({ questions: [] })],
      [
        "no correct option",
        validContent({
          questions: [{ ...mcq(), options: [{ body: "A", isCorrect: false }, { body: "B", isCorrect: false }] }],
        }),
      ],
      ["a shortlist smuggled in", { ...validContent(), shortlistRefs: ["PROGRAM:m1"] }],
      ["an assessment id smuggled in", { ...validContent(), assessmentId: "x" }],
      ["no title", validContent({ title: "  " })],
    ];
    for (const [label, content] of cases) {
      const res = await createTemplate(store, SCOPE_A, { name: "Bad", content });
      assert(!res.ok && res.code === "INVALID", `${label} → INVALID`);
    }
    assert(store.rows.size === 0, "nothing was written");

    const good = await createTemplate(store, SCOPE_A, { name: "Good", content: validContent() });
    assert(good.ok, "setup");
    if (!good.ok) return;
    const bad = await updateTemplateContent(store, SCOPE_A, {
      templateId: good.data.id,
      content: validContent({ questions: [] }),
    });
    assert(!bad.ok && bad.code === "INVALID", "an invalid update is refused");
    assert(store.rows.get(good.data.id)!.questionCount === 1, "and the template is unchanged");
  });

  await suite("T10. stored content is checked again when a template is opened", async () => {
    const store = memoryStore();
    const created = await createTemplate(store, SCOPE_A, { name: "Old shape", content: validContent() });
    assert(created.ok, "created");
    if (!created.ok) return;
    // As if the content rules had tightened after it was saved.
    store.rows.get(created.data.id)!.content = { title: "x", questions: "not a list" };
    const got = await getTemplate(store, SCOPE_A, created.data.id);
    assert(!got.ok && got.code === "INVALID", "refused with a message, not a crash");
  });

  console.log("\nPlan 185 — who can reach what\n");

  await suite("G1. every template action is behind the recruiter workspace gate", () => {
    const src = readSource("src/app/actions/recruiter-assessment-template-actions.ts");
    const exported = (src.match(/export async function /g) ?? []).length;
    const gated = (src.match(/await requireRecruiterWorkspace\(\)/g) ?? []).length;
    assert(exported === 4, `four actions, found ${exported}`);
    assert(gated === exported, `every action calls the gate (${gated}/${exported})`);
    assert(!src.includes("requireAdmin"), "there is no admin path into templates");
    assert(src.includes("createdByUserId: workspace.userId"), "the owner is the session's user");
    assert(!/input\.(organizationId|createdByUserId|userId)/.test(src), "no owner is read from input");
    assert(!src.includes("console."), "no console");
  });

  await suite("G2. every template query carries the scope; none looks up by id alone", () => {
    const src = readSource("src/features/recruiter-assessments/template-prisma-store.ts");
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const unsafe of [".findUnique(", ".findUniqueOrThrow(", ".update(", ".delete(", ".upsert("]) {
      assert(!code.includes(unsafe), `${unsafe} takes a bare id and must not be used`);
    }
    const queries = (code.match(/recruiterAssessmentTemplate\.\w+\(/g) ?? []).length;
    const scoped = (code.match(/scopeWhere\(scope\)/g) ?? []).length;
    assert(queries === 7, `seven queries, found ${queries}`);
    assert(scoped === queries, `each one is scoped (${scoped}/${queries})`);
    // Reads name their columns; the create returns its id only.
    const selects = (code.match(/select:/g) ?? []).length;
    assert(selects >= 3, "findMany, findFirst and create each have a select");
  });

  await suite("G3. admin has no template surface", () => {
    for (const rel of [
      "src/app/actions/admin-assessment-actions.ts",
      "src/app/admin/assessments/page.tsx",
      "src/app/admin/assessments/new/page.tsx",
      "src/app/admin/assessments/[assessmentId]/page.tsx",
      "src/app/admin/assessments/[assessmentId]/edit/page.tsx",
      "src/features/platform-assessments/service.ts",
      "src/features/platform-assessments/prisma-store.ts",
      "src/features/admin/get-assessments-console.ts",
    ]) {
      const src = readSource(rel);
      // The table, the actions, the store, the service, the section and the
      // builder flag. Not the bare word "template", which an email template or
      // a comment may use with good reason.
      assert(
        !/recruiterAssessmentTemplate|template-actions|template-prisma-store|recruiter-assessments\/templates|MyAssessmentTemplates|canSaveTemplate/i.test(
          src,
        ),
        `${rel} must not reach recruiter templates`,
      );
    }
  });

  await suite("G4. the builder offers templates only to recruiters, and never on a locked preset", () => {
    const builder = readSource("src/components/hire/assessment/assessment-builder.tsx");
    assert(
      builder.includes("const showTemplateActions = canSaveTemplate && !platform && !presetLocked;"),
      "Save as template needs the recruiter flag, no platform, no locked preset",
    );
    assert(builder.includes("canSaveTemplate = false"), "off unless a page turns it on");
    assert(
      builder.includes("const canImport = !presetLocked && !sent;"),
      "import is off on a locked preset and on a sent assessment",
    );
    const page = readSource("src/app/hire/create-test/page.tsx");
    assert(page.includes("canSaveTemplate"), "the recruiter page turns it on");
    assert(
      page.includes("getTemplate(prismaTemplateStore(), templateScope, templateId)"),
      "a template opens through the session's scope",
    );
    assert(!/searchParams[\s\S]{0,200}organizationId/.test(page), "the scope never comes from the URL");
  });

  await suite("G5. ABTalks presets are untouched by personal templates", () => {
    const presets = readSource("src/features/recruiter-assessments/presets.ts");
    assert(!presets.includes("./templates") && !presets.includes("prisma"), "presets stay static code");
    const picker = readSource("src/components/hire/assessment/preset-picker.tsx");
    assert(!picker.includes("template-actions"), "the preset picker calls no template action");
    const own = readSource("src/components/hire/assessment/my-templates.tsx");
    assert(!own.includes("createAndSend"), "a personal template cannot be published from the landing");
    assert(own.includes("template: id"), "it is used through Customize");
  });

  await suite("G6. the schema, the migration and account deletion agree", () => {
    const schema = readSource("prisma/schema.prisma");
    const model = schema.slice(schema.indexOf("model RecruiterAssessmentTemplate {"));
    const body = model.slice(0, model.indexOf("\n}\n"));
    assert(body.includes("organizationId  String") && body.includes("createdByUserId String"), "both owner columns, required");
    assert(body.includes("@@index([organizationId, createdByUserId"), "indexed on the scope");

    const sql = readSource(
      "prisma/migrations/20261007150000_recruiter_assessment_templates/migration.sql",
    )
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    assert(sql.includes('CREATE TABLE "RecruiterAssessmentTemplate"'), "creates the table");
    assert(!/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/.test(sql.replace(/ON (DELETE|UPDATE) CASCADE/g, "")), "and is additive only");
    assert(!/ALTER TABLE "(?!RecruiterAssessmentTemplate")/.test(sql), "it alters no existing table");

    const purge = readSource("src/features/hire/delete-recruiter-account.ts");
    assert(
      purge.includes("tx.recruiterAssessmentTemplate.deleteMany({ where: { organizationId } })"),
      "deleting a recruiter account deletes their templates",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
