import "server-only";

import type {
  AssessmentDraftInput,
  AssessmentQuestionInput,
} from "@/lib/validations/assessment";
import { assessmentDraftSchema } from "@/lib/validations/assessment";

export type Scope = { organizationId: string; createdByUserId: string };

export type AssessmentOptionRow = {
  id: string;
  position: number;
  body: string;
  isCorrect: boolean;
};

export type AssessmentQuestionRow = {
  id: string;
  position: number;
  type: "MULTIPLE_CHOICE" | "PARAGRAPH" | "FILE_UPLOAD";
  title: string;
  helpText: string | null;
  isRequired: boolean;
  points: number;
  allowMultipleCorrect: boolean;
  maxWords: number | null;
  uploadDestinationUrl: string | null;
  sectionId: string | null;
  options: AssessmentOptionRow[];
};

export type AssessmentRow = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  title: string;
  subheading: string | null;
  instructions: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  durationMinutes: number | null;
  passMarkPercent: number;
  shortlistRefs: string[];
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  questions: AssessmentQuestionRow[];
};

export type AssessmentListRow = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  durationMinutes: number | null;
  passMarkPercent: number;
  questionCount: number;
  updatedAt: Date;
};

export type ContentInput = {
  title: string;
  subheading: string | null;
  instructions: string | null;
  durationMinutes: number | null;
  passMarkPercent: number;
  shortlistRefs: string[];
  questions: AssessmentQuestionInput[];
};

export type CreateInput = ContentInput;

export type AssessmentStore = {
  create(scope: Scope, input: CreateInput): Promise<{ id: string }>;
  replaceContent(
    assessmentId: string,
    scope: Scope,
    input: ContentInput,
  ): Promise<void>;
  findOwned(assessmentId: string, scope: Scope): Promise<AssessmentRow | null>;
  listOwned(scope: Scope): Promise<AssessmentListRow[]>;
  delete(assessmentId: string, scope: Scope): Promise<boolean>;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: "NOT_FOUND" | "INVALID" | "CONFLICT"; message: string };

const OK = <T>(data: T): Result<T> => ({ ok: true, data });
const NOT_FOUND = (msg: string): Result<never> => ({
  ok: false,
  code: "NOT_FOUND",
  message: msg,
});
const INVALID = (msg: string): Result<never> => ({
  ok: false,
  code: "INVALID",
  message: msg,
});
const CONFLICT = (msg: string): Result<never> => ({
  ok: false,
  code: "CONFLICT",
  message: msg,
});

function toContent(input: AssessmentDraftInput): ContentInput {
  return {
    title: input.title,
    subheading: input.subheading ?? null,
    instructions: input.instructions ?? null,
    durationMinutes: input.durationMinutes,
    passMarkPercent: input.passMarkPercent,
    shortlistRefs: input.shortlistRefs,
    questions: input.questions,
  };
}

export async function createAssessment(
  store: AssessmentStore,
  scope: Scope,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = assessmentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return INVALID(parsed.error.issues[0]?.message ?? "Invalid assessment");
  }
  const created = await store.create(scope, toContent(parsed.data));
  return OK({ id: created.id });
}

export async function saveAssessmentDraft(
  store: AssessmentStore,
  scope: Scope,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = assessmentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return INVALID(parsed.error.issues[0]?.message ?? "Invalid assessment");
  }
  const assessmentId = parsed.data.assessmentId;
  if (!assessmentId) {
    return INVALID("Assessment id is required to update a draft");
  }

  const existing = await store.findOwned(assessmentId, scope);
  if (!existing) return NOT_FOUND("Assessment not found");
  if (existing.status !== "DRAFT") {
    return CONFLICT(
      "This assessment has already been published and can no longer be edited.",
    );
  }

  await store.replaceContent(assessmentId, scope, toContent(parsed.data));
  return OK({ id: assessmentId });
}

export async function listAssessments(
  store: AssessmentStore,
  scope: Scope,
): Promise<Result<AssessmentListRow[]>> {
  return OK(await store.listOwned(scope));
}

export async function getAssessment(
  store: AssessmentStore,
  scope: Scope,
  assessmentId: string,
): Promise<Result<AssessmentRow>> {
  const row = await store.findOwned(assessmentId, scope);
  if (!row) return NOT_FOUND("Assessment not found");
  return OK(row);
}

export async function deleteAssessment(
  store: AssessmentStore,
  scope: Scope,
  assessmentId: string,
): Promise<Result<{ id: string }>> {
  const removed = await store.delete(assessmentId, scope);
  if (!removed) return NOT_FOUND("Assessment not found");
  return OK({ id: assessmentId });
}
