import "server-only";

import {
  MAX_PARAGRAPH_WORDS,
  attemptActionSchema,
  countWords,
  incompleteMessage,
  isAnswerComplete,
  saveAnswerSchema,
} from "@/lib/validations/assessment";
import type {
  CandidateAnswer,
  CandidateAssessmentView,
  CandidateQuestion,
} from "@/components/hire/assessment/assessment-types";

/**
 * T-218 (plan 129) — a candidate taking a recruiter assessment.
 *
 * The candidate is always the caller's own session user: every function takes
 * `candidateUserId` from the action, never from the client. A foreign, unknown
 * or unpublished assignment is NOT_FOUND — never FORBIDDEN — so ids cannot be
 * enumerated.
 *
 * The status guards are the ones plan 128 §10 agreed with T-244:
 *   start  ASSIGNED → STARTED
 *   submit ASSIGNED|STARTED → SUBMITTED   (a second submit matches nothing)
 *
 * The candidate never sees the answer key, the score or pass/fail (decision
 * D-1): no type in this file that reaches a page carries them.
 */

export type AttemptStatus = "ASSIGNED" | "STARTED" | "SUBMITTED";
type QuestionType = "MULTIPLE_CHOICE" | "PARAGRAPH" | "FILE_UPLOAD";

/** A question as the candidate may see it. NO isCorrect — ever. */
export type AttemptQuestionRow = {
  id: string;
  position: number;
  type: QuestionType;
  title: string;
  helpText: string | null;
  isRequired: boolean;
  points: number;
  allowMultipleCorrect: boolean;
  maxWords: number | null;
  uploadDestinationUrl: string | null;
  options: { id: string; position: number; body: string }[];
};

export type AnswerRow = {
  questionId: string;
  selectedOptionIds: string[];
  text: string | null;
  fileUrl: string | null;
};

/** The candidate's own assignment. NO scorePercent, NO passed (D-1). */
export type AttemptRow = {
  assignmentId: string;
  status: AttemptStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
  assessment: {
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    title: string;
    subheading: string | null;
    instructions: string | null;
    durationMinutes: number | null;
    passMarkPercent: number;
  };
  questions: AttemptQuestionRow[];
  answers: AnswerRow[];
};

export type AttemptListRow = {
  assignmentId: string;
  title: string;
  status: AttemptStatus;
  assignedAt: Date;
  submittedAt: Date | null;
  durationMinutes: number | null;
  questionCount: number;
};

/** What is written for one answer — exactly one of the three is meaningful. */
export type AnswerValue = {
  selectedOptionIds: string[];
  text: string | null;
  fileUrl: string | null;
};

/** Read inside the submit transaction only — this is where isCorrect lives. */
export type GradeQuestion = {
  id: string;
  type: QuestionType;
  points: number;
  isRequired: boolean;
  maxWords: number | null;
  correctOptionIds: string[];
};

export type FinishInput = {
  questions: GradeQuestion[];
  answers: AnswerRow[];
  passMarkPercent: number;
};

export type FinishResult =
  | { ok: true; scorePercent: number; passed: boolean }
  | { ok: false; missingRequired: number; overLimit: number };

export type SubmitOutcome =
  | { outcome: "SUBMITTED" }
  | { outcome: "NOT_OPEN" }
  | { outcome: "INCOMPLETE"; missingRequired: number; overLimit: number };

export type AttemptStore = {
  /** Only when candidateUserId owns it. Never selects isCorrect/scorePercent/passed. */
  findAttempt(assignmentId: string, candidateUserId: string): Promise<AttemptRow | null>;
  /** This candidate's assignments on PUBLISHED assessments, newest first. */
  listAttempts(candidateUserId: string): Promise<AttemptListRow[]>;
  /** ASSIGNED → STARTED in one guarded write. False when nothing moved. */
  start(assignmentId: string, candidateUserId: string, at: Date): Promise<boolean>;
  /** Upsert one answer under the row lock, only while STARTED. */
  saveAnswer(
    assignmentId: string,
    candidateUserId: string,
    questionId: string,
    value: AnswerValue,
  ): Promise<"SAVED" | "NOT_OPEN">;
  /** Guarded flip, read answers under the lock, finish(), write the score.
   *  finish() returning ok:false rolls the flip back. */
  submit(
    assignmentId: string,
    candidateUserId: string,
    at: Date,
    finish: (input: FinishInput) => FinishResult,
  ): Promise<SubmitOutcome>;
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

const NOT_FOUND_MSG = "Assessment not found";
const ALREADY_SUBMITTED_MSG = "This assessment has already been submitted.";
const LOCKED_MSG =
  "This assessment has been submitted — answers can no longer change.";
const MISMATCH_MSG = "That answer doesn't match this question type.";

/** Nothing moves a PUBLISHED assessment back (no unpublish exists and nothing
 *  writes ARCHIVED), so this read-time check is sufficient. */
function isOpen(row: AttemptRow | null): row is AttemptRow {
  return row !== null && row.assessment.status === "PUBLISHED";
}

/** A stored answer in the shape the screen holds it. */
export function toCandidateAnswer(
  type: QuestionType,
  row: AnswerRow | undefined,
): CandidateAnswer | undefined {
  if (!row) return undefined;
  if (type === "MULTIPLE_CHOICE") {
    return { kind: "choice", selectedOptionIds: row.selectedOptionIds };
  }
  if (type === "PARAGRAPH") return { kind: "text", text: row.text ?? "" };
  return { kind: "file", fileUrl: row.fileUrl ?? "" };
}

/**
 * Required check, word caps, then the score plan 128 §10 defined:
 * round(100 × MCQ points earned ÷ total MCQ points). PARAGRAPH and FILE_UPLOAD
 * are not auto-scored. A question earns its points only when the selected set
 * EQUALS the correct set — the same rule for single- and multi-select.
 */
export function finishAttempt(input: FinishInput): FinishResult {
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a]));

  let missingRequired = 0;
  let overLimit = 0;
  for (const q of input.questions) {
    const row = byQuestion.get(q.id);
    if (q.isRequired && !isAnswerComplete(q.type, toCandidateAnswer(q.type, row))) {
      missingRequired++;
    }
    if (
      q.type === "PARAGRAPH" &&
      row?.text &&
      countWords(row.text) > (q.maxWords ?? MAX_PARAGRAPH_WORDS)
    ) {
      overLimit++;
    }
  }
  if (missingRequired > 0 || overLimit > 0) {
    return { ok: false, missingRequired, overLimit };
  }

  let total = 0;
  let earned = 0;
  for (const q of input.questions) {
    if (q.type !== "MULTIPLE_CHOICE" || q.points <= 0) continue;
    total += q.points;
    const picked = new Set(byQuestion.get(q.id)?.selectedOptionIds ?? []);
    const correct = new Set(q.correctOptionIds);
    const exact =
      correct.size > 0 &&
      picked.size === correct.size &&
      [...correct].every((id) => picked.has(id));
    if (exact) earned += q.points;
  }
  const scorePercent = total === 0 ? 0 : Math.round((100 * earned) / total);
  return { ok: true, scorePercent, passed: scorePercent >= input.passMarkPercent };
}

/** Field by field on purpose: spreading a row is how an answer key leaks. */
function toCandidateQuestion(q: AttemptQuestionRow): CandidateQuestion {
  const base = {
    id: q.id,
    title: q.title,
    helpText: q.helpText,
    isRequired: q.isRequired,
    points: q.points,
  };
  if (q.type === "MULTIPLE_CHOICE") {
    return {
      ...base,
      type: "MULTIPLE_CHOICE",
      allowMultipleCorrect: q.allowMultipleCorrect,
      options: q.options.map((o) => ({ id: o.id, body: o.body })),
    };
  }
  if (q.type === "PARAGRAPH") {
    return { ...base, type: "PARAGRAPH", maxWords: q.maxWords };
  }
  return { ...base, type: "FILE_UPLOAD", uploadDestinationUrl: q.uploadDestinationUrl };
}

function toView(row: AttemptRow): CandidateAssessmentView {
  return {
    title: row.assessment.title,
    subheading: row.assessment.subheading,
    instructions: row.assessment.instructions,
    durationMinutes: row.assessment.durationMinutes,
    passMarkPercent: row.assessment.passMarkPercent,
    questions: row.questions.map(toCandidateQuestion),
  };
}

export type LoadedAttempt = {
  assignmentId: string;
  status: AttemptStatus;
  submittedAt: Date | null;
  view: CandidateAssessmentView;
  answers: Record<string, CandidateAnswer>;
};

export async function loadAttempt(
  store: AttemptStore,
  candidateUserId: string,
  assignmentId: string,
): Promise<Result<LoadedAttempt>> {
  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);

  const byQuestion = new Map(row.answers.map((a) => [a.questionId, a]));
  const answers: Record<string, CandidateAnswer> = {};
  for (const q of row.questions) {
    const answer = toCandidateAnswer(q.type, byQuestion.get(q.id));
    if (answer) answers[q.id] = answer;
  }

  return OK({
    assignmentId: row.assignmentId,
    status: row.status,
    submittedAt: row.submittedAt,
    view: toView(row),
    answers,
  });
}

export async function startAttempt(
  store: AttemptStore,
  candidateUserId: string,
  input: unknown,
): Promise<Result<{ alreadyStarted: boolean }>> {
  const parsed = attemptActionSchema.safeParse(input);
  if (!parsed.success) return INVALID("Invalid input");
  const { assignmentId } = parsed.data;

  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  if (row.status === "SUBMITTED") {
    return CONFLICT("You've already submitted this assessment.");
  }
  if (row.status === "STARTED") return OK({ alreadyStarted: true });

  const moved = await store.start(assignmentId, candidateUserId, new Date());
  if (!moved) {
    // Another tab or device started it first; that is still a start.
    const again = await store.findAttempt(assignmentId, candidateUserId);
    if (again?.status === "STARTED") return OK({ alreadyStarted: true });
    if (again?.status === "SUBMITTED") {
      return CONFLICT("You've already submitted this assessment.");
    }
    return NOT_FOUND(NOT_FOUND_MSG);
  }
  return OK({ alreadyStarted: false });
}

export async function saveAnswer(
  store: AttemptStore,
  candidateUserId: string,
  input: unknown,
): Promise<Result<{ savedAt: Date }>> {
  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) {
    return INVALID(parsed.error.issues[0]?.message ?? "Invalid answer");
  }
  const { assignmentId, questionId, answer } = parsed.data;

  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  if (row.status === "SUBMITTED") return CONFLICT(LOCKED_MSG);
  if (row.status === "ASSIGNED") {
    return CONFLICT("Start the assessment before answering.");
  }

  const q = row.questions.find((x) => x.id === questionId);
  if (!q) return NOT_FOUND("Question not found");

  let value: AnswerValue;
  if (q.type === "MULTIPLE_CHOICE") {
    if (answer.kind !== "choice") return INVALID(MISMATCH_MSG);
    const ids = [...new Set(answer.selectedOptionIds)];
    const valid = new Set(q.options.map((o) => o.id));
    if (ids.some((id) => !valid.has(id))) {
      return INVALID("That option isn't part of this question.");
    }
    if (!q.allowMultipleCorrect && ids.length > 1) {
      return INVALID("Pick one option for this question.");
    }
    value = { selectedOptionIds: ids, text: null, fileUrl: null };
  } else if (q.type === "PARAGRAPH") {
    if (answer.kind !== "text") return INVALID(MISMATCH_MSG);
    // No word-cap check here: an over-limit draft is saved, never lost.
    // Submit refuses it until it is shortened.
    value = { selectedOptionIds: [], text: answer.text, fileUrl: null };
  } else {
    if (answer.kind !== "file") return INVALID(MISMATCH_MSG);
    value = {
      selectedOptionIds: [],
      text: null,
      fileUrl: answer.fileUrl === "" ? null : answer.fileUrl,
    };
  }

  const saved = await store.saveAnswer(assignmentId, candidateUserId, questionId, value);
  if (saved === "NOT_OPEN") {
    const again = await store.findAttempt(assignmentId, candidateUserId);
    if (again?.status === "SUBMITTED") return CONFLICT(LOCKED_MSG);
    return NOT_FOUND(NOT_FOUND_MSG);
  }
  return OK({ savedAt: new Date() });
}

export async function submitAttempt(
  store: AttemptStore,
  candidateUserId: string,
  input: unknown,
): Promise<Result<{ submittedAt: Date }>> {
  const parsed = attemptActionSchema.safeParse(input);
  if (!parsed.success) return INVALID("Invalid input");
  const { assignmentId } = parsed.data;

  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  // TC-C-013: the duplicate refusal, as a message rather than an error.
  if (row.status === "SUBMITTED") return CONFLICT(ALREADY_SUBMITTED_MSG);

  const at = new Date();
  const out = await store.submit(assignmentId, candidateUserId, at, finishAttempt);
  if (out.outcome === "NOT_OPEN") {
    // Lost a race: another tab's or device's submit won the guard.
    const again = await store.findAttempt(assignmentId, candidateUserId);
    if (again?.status === "SUBMITTED") return CONFLICT(ALREADY_SUBMITTED_MSG);
    return NOT_FOUND(NOT_FOUND_MSG);
  }
  if (out.outcome === "INCOMPLETE") {
    return INVALID(incompleteMessage(out.missingRequired, out.overLimit));
  }
  // No score in the result: the candidate sees "Submitted" only (D-1).
  return OK({ submittedAt: at });
}

export async function listCandidateAttempts(
  store: AttemptStore,
  candidateUserId: string,
): Promise<Result<AttemptListRow[]>> {
  return OK(await store.listAttempts(candidateUserId));
}
