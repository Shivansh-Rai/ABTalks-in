import "server-only";

import {
  CAMERA_EVENT_TYPES,
  CLIPBOARD_EVENT_TYPES,
  FILE_LINK_EVENT_TYPES,
  MAX_EVENTS_PER_ATTEMPT,
  MAX_PARAGRAPH_WORDS,
  MAX_SESSIONS_PER_ATTEMPT,
  STRIKE_LIMIT,
  attemptActionSchema,
  attemptEventBatchSchema,
  countWords,
  endAttemptSchema,
  incompleteMessage,
  isAnswerComplete,
  saveAnswerSchema,
  type AssessmentEndReason,
  type AttemptEventType,
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
  /** How it closed; null while open. Not a score — safe for the candidate. */
  endReason: AssessmentEndReason | null;
  assessment: {
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    title: string;
    subheading: string | null;
    instructions: string | null;
    durationMinutes: number | null;
    passMarkPercent: number;
    strictMode: boolean;
    cameraRequired: boolean;
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
  strictMode: boolean;
  cameraRequired: boolean;
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

export type DeviceHint = { mobile: boolean };

/** Strict-mode strikes, counted from the attempt's recorded activity:
 *  a tab switch is a return to the page (VISIBILITY_VISIBLE, so a reload or a
 *  closed tab is not one); a fullscreen exit is FULLSCREEN_EXITED. */
export type StrikeCounts = { tabSwitches: number; fullscreenExits: number };

export type EventContext = {
  status: AttemptStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
  assessment: {
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    strictMode: boolean;
    cameraRequired: boolean;
    questions: { id: string; type: QuestionType }[];
  };
  eventCount: number;
  sessionExists: boolean;
  sessionCount: number;
};

export type EventWrite = {
  seq: number;
  type: AttemptEventType;
  occurredAt: Date;
  clientOccurredAt: Date;
  receivedAt: Date;
  questionId: string | null;
  count: number;
};

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
  /**
   * Plan 141 leave-finalize: same guarded flip as submit, but finish must always
   * succeed (use finishAttemptForced). Already SUBMITTED → ALREADY.
   */
  submitForced(
    assignmentId: string,
    candidateUserId: string,
    at: Date,
    finish: (input: FinishInput) => FinishResult,
    reason: AssessmentEndReason,
  ): Promise<SubmitOutcome | { outcome: "ALREADY" }>;
  /** Tab switches and fullscreen exits recorded for this attempt, all sessions. */
  countStrikes(assignmentId: string, candidateUserId: string): Promise<StrikeCounts>;
  findEventContext(
    assignmentId: string,
    candidateUserId: string,
    clientSessionId: string,
  ): Promise<EventContext | null>;
  /** Creates the session if new, sets lastSeenAt = receivedAt, inserts events skipping duplicates — one operation. */
  writeEventBatch(
    assignmentId: string,
    clientSessionId: string,
    receivedAt: Date,
    events: EventWrite[],
  ): Promise<void>;
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

/**
 * Plan 141 — leave-finalize always commits.
 * Unanswered required questions score as empty (MCQ → 0). Over-limit paragraph
 * text is ignored for scoring (paragraphs are not auto-scored). Intentional
 * Submit still uses finishAttempt and refuses incomplete / over-limit.
 */
export function finishAttemptForced(input: FinishInput): FinishResult {
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a]));

  let total = 0;
  let earned = 0;
  for (const q of input.questions) {
    if (q.type !== "MULTIPLE_CHOICE" || q.points <= 0) continue;
    total += q.points;
    const row = byQuestion.get(q.id);
    // Over-limit only applies to paragraphs; MCQ path is unchanged.
    const picked = new Set(row?.selectedOptionIds ?? []);
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

/**
 * The time limit. An attempt submits in exactly two ways: the candidate's own
 * Submit, or its timer running out. The clock starts at `startedAt` and is
 * enforced here, on the server — leaving the page does not pause it.
 */
/** A save still in flight when the clock hits zero is accepted for this long. */
export const TIME_UP_GRACE_MS = 15_000;
/** Client/server clock drift allowed when the screen submits at 0:00. */
export const TIME_UP_EARLY_TOLERANCE_MS = 5_000;
const TIME_UP_MSG = "Time is up — your answers were submitted.";

export function attemptDeadline(row: {
  startedAt: Date | null;
  assessment: { durationMinutes: number | null };
}): Date | null {
  if (!row.startedAt || row.assessment.durationMinutes == null) return null;
  return new Date(row.startedAt.getTime() + row.assessment.durationMinutes * 60_000);
}

/** Close a STARTED attempt whose time ran out: incomplete answers are allowed. */
async function closeExpiredAttempt(
  store: AttemptStore,
  candidateUserId: string,
  assignmentId: string,
  at: Date,
): Promise<SubmitOutcome | { outcome: "ALREADY" }> {
  return store.submitForced(assignmentId, candidateUserId, at, finishAttemptForced, "TIME_UP");
}

/** The strict-mode penalty a strike count has reached, if any. */
export function strikeLimitReason(counts: StrikeCounts): AssessmentEndReason | null {
  if (counts.tabSwitches >= STRIKE_LIMIT) return "TAB_SWITCH_LIMIT";
  if (counts.fullscreenExits >= STRIKE_LIMIT) return "FULLSCREEN_LIMIT";
  return null;
}

const NO_STRIKES: StrikeCounts = { tabSwitches: 0, fullscreenExits: 0 };

export type LoadedAttempt = {
  assignmentId: string;
  status: AttemptStatus;
  submittedAt: Date | null;
  /** When a STARTED timed attempt closes. Null when untimed or not started. */
  deadlineAt: Date | null;
  endReason: AssessmentEndReason | null;
  /** Strict STARTED attempts only (zeros otherwise), so a reload can't reset them. */
  strikes: StrikeCounts;
  /** The server clock at load, so the screen can correct for device drift. */
  serverNow: Date;
  view: CandidateAssessmentView;
  answers: Record<string, CandidateAnswer>;
  rules: { strictMode: boolean; cameraRequired: boolean };
};

export async function loadAttempt(
  store: AttemptStore,
  candidateUserId: string,
  assignmentId: string,
  now: Date = new Date(),
): Promise<Result<LoadedAttempt>> {
  let row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);

  // Reopened after the timer ran out (tab closed, device asleep): close it now.
  const deadline = attemptDeadline(row);
  if (
    row.status === "STARTED" &&
    deadline &&
    now.getTime() > deadline.getTime() + TIME_UP_GRACE_MS
  ) {
    await closeExpiredAttempt(store, candidateUserId, assignmentId, deadline);
    row = await store.findAttempt(assignmentId, candidateUserId);
    if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  }

  let strikes = NO_STRIKES;
  if (row.assessment.strictMode && row.status === "STARTED") {
    strikes = await store.countStrikes(assignmentId, candidateUserId);
    // The limit was reached but the close didn't land (e.g. the tab died).
    const penalty = strikeLimitReason(strikes);
    if (penalty) {
      await store.submitForced(assignmentId, candidateUserId, now, finishAttemptForced, penalty);
      row = await store.findAttempt(assignmentId, candidateUserId);
      if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
    }
  }

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
    deadlineAt: row.status === "STARTED" ? attemptDeadline(row) : null,
    endReason: row.endReason,
    strikes: row.status === "STARTED" ? strikes : NO_STRIKES,
    serverNow: now,
    view: toView(row),
    answers,
    rules: {
      strictMode: row.assessment.strictMode,
      cameraRequired: row.assessment.cameraRequired,
    },
  });
}

/**
 * Plan 141 — force-submit a strict STARTED attempt. Incomplete answers are
 * allowed. Already SUBMITTED is OK (idempotent).
 *
 * No longer called by the candidate screen: an attempt submits only on the
 * candidate's Submit or when its timer runs out. Kept because the leave route
 * and its isolation test (src/features/hire/isolation.test.ts) still name it.
 */
export async function finalizeStrictAttemptOnLeave(
  store: AttemptStore,
  candidateUserId: string,
  assignmentId: string,
  device: DeviceHint = { mobile: false },
): Promise<Result<{ submittedAt: Date | null; alreadySubmitted: boolean }>> {
  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  if (!row.assessment.strictMode) {
    return CONFLICT("Activity leave-close is only for strict assessments.");
  }
  if (row.assessment.strictMode && device.mobile) {
    return CONFLICT("This assessment can only be taken on a laptop or desktop computer.");
  }
  if (row.status === "SUBMITTED") {
    return OK({ submittedAt: row.submittedAt, alreadySubmitted: true });
  }
  if (row.status === "ASSIGNED") {
    return CONFLICT("This assessment has not been started.");
  }

  const at = new Date();
  const out = await store.submitForced(
    assignmentId,
    candidateUserId,
    at,
    finishAttemptForced,
    "LEFT_PAGE",
  );
  if (out.outcome === "ALREADY") {
    const again = await store.findAttempt(assignmentId, candidateUserId);
    return OK({
      submittedAt: again?.submittedAt ?? row.submittedAt,
      alreadySubmitted: true,
    });
  }
  if (out.outcome === "NOT_OPEN") {
    const again = await store.findAttempt(assignmentId, candidateUserId);
    if (again?.status === "SUBMITTED") {
      return OK({ submittedAt: again.submittedAt, alreadySubmitted: true });
    }
    return NOT_FOUND(NOT_FOUND_MSG);
  }
  if (out.outcome === "INCOMPLETE") {
    // finishAttemptForced must never return incomplete; treat as server error path.
    return CONFLICT("Couldn't close this assessment.");
  }
  return OK({ submittedAt: at, alreadySubmitted: false });
}

export async function startAttempt(
  store: AttemptStore,
  candidateUserId: string,
  input: unknown,
  device: DeviceHint = { mobile: false },
): Promise<Result<{ alreadyStarted: boolean }>> {
  const parsed = attemptActionSchema.safeParse(input);
  if (!parsed.success) return INVALID("Invalid input");
  const { assignmentId } = parsed.data;

  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  if (row.assessment.strictMode && device.mobile) {
    return CONFLICT("This assessment can only be taken on a laptop or desktop computer.");
  }
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
  device: DeviceHint = { mobile: false },
): Promise<Result<{ savedAt: Date }>> {
  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) {
    return INVALID(parsed.error.issues[0]?.message ?? "Invalid answer");
  }
  const { assignmentId, questionId, answer } = parsed.data;

  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  if (row.assessment.strictMode && device.mobile) {
    return CONFLICT("This assessment can only be taken on a laptop or desktop computer.");
  }
  if (row.status === "SUBMITTED") return CONFLICT(LOCKED_MSG);
  if (row.status === "ASSIGNED") {
    return CONFLICT("Start the assessment before answering.");
  }

  const deadline = attemptDeadline(row);
  if (deadline && Date.now() > deadline.getTime() + TIME_UP_GRACE_MS) {
    await closeExpiredAttempt(store, candidateUserId, assignmentId, deadline);
    return CONFLICT(TIME_UP_MSG);
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
  device: DeviceHint = { mobile: false },
): Promise<Result<{ submittedAt: Date }>> {
  const parsed = attemptActionSchema.safeParse(input);
  if (!parsed.success) return INVALID("Invalid input");
  const { assignmentId } = parsed.data;

  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  if (row.assessment.strictMode && device.mobile) {
    return CONFLICT("This assessment can only be taken on a laptop or desktop computer.");
  }
  // TC-C-013: the duplicate refusal, as a message rather than an error.
  if (row.status === "SUBMITTED") return CONFLICT(ALREADY_SUBMITTED_MSG);

  const at = new Date();

  // Time is up: the screen submits at 0:00 and whatever is saved is final, so
  // unanswered required questions don't block it (server clock decides).
  const deadline = attemptDeadline(row);
  if (
    row.status === "STARTED" &&
    deadline &&
    at.getTime() >= deadline.getTime() - TIME_UP_EARLY_TOLERANCE_MS
  ) {
    const closeAt = at.getTime() > deadline.getTime() ? deadline : at;
    const forced = await closeExpiredAttempt(store, candidateUserId, assignmentId, closeAt);
    if (forced.outcome === "SUBMITTED") return OK({ submittedAt: closeAt });
    const again = await store.findAttempt(assignmentId, candidateUserId);
    if (again?.status === "SUBMITTED") return CONFLICT(ALREADY_SUBMITTED_MSG);
    return NOT_FOUND(NOT_FOUND_MSG);
  }

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

/**
 * The candidate closes their own STARTED attempt without the Submit checks:
 * "End assessment" (ENDED_EARLY), or strict mode's strike limit reached on
 * their screen. Unanswered questions score as empty. It can't be reopened or
 * retaken — start refuses a SUBMITTED attempt.
 */
export async function endAttempt(
  store: AttemptStore,
  candidateUserId: string,
  input: unknown,
  device: DeviceHint = { mobile: false },
): Promise<Result<{ submittedAt: Date; reason: AssessmentEndReason }>> {
  const parsed = endAttemptSchema.safeParse(input);
  if (!parsed.success) return INVALID("Invalid input");
  const { assignmentId } = parsed.data;

  const row = await store.findAttempt(assignmentId, candidateUserId);
  if (!isOpen(row)) return NOT_FOUND(NOT_FOUND_MSG);
  if (row.assessment.strictMode && device.mobile) {
    return CONFLICT("This assessment can only be taken on a laptop or desktop computer.");
  }
  if (row.status === "SUBMITTED") return CONFLICT(ALREADY_SUBMITTED_MSG);
  if (row.status === "ASSIGNED") return CONFLICT("Start the assessment before ending it.");

  let reason: AssessmentEndReason = parsed.data.reason;
  if (reason !== "ENDED_EARLY" && !row.assessment.strictMode) {
    return CONFLICT("Tab and fullscreen limits only apply to strict assessments.");
  }

  let at = new Date();
  // Already out of time: that is what ended it.
  const deadline = attemptDeadline(row);
  if (deadline && at.getTime() > deadline.getTime()) {
    at = deadline;
    reason = "TIME_UP";
  }

  const out = await store.submitForced(assignmentId, candidateUserId, at, finishAttemptForced, reason);
  if (out.outcome === "SUBMITTED") return OK({ submittedAt: at, reason });
  const again = await store.findAttempt(assignmentId, candidateUserId);
  if (again?.status === "SUBMITTED") return CONFLICT(ALREADY_SUBMITTED_MSG);
  return NOT_FOUND(NOT_FOUND_MSG);
}

export async function listCandidateAttempts(
  store: AttemptStore,
  candidateUserId: string,
): Promise<Result<AttemptListRow[]>> {
  return OK(await store.listAttempts(candidateUserId));
}

const SUBMIT_GRACE_MS = 60_000;
const AFTER_SUBMIT_TOLERANCE_MS = 5_000;
const BEFORE_START_TOLERANCE_MS = 300_000;
const MAX_CLIENT_LAG_MS = 86_400_000;
const SENT_BEFORE_TOLERANCE_MS = 1_000;

const FILE_LINK = new Set<string>(FILE_LINK_EVENT_TYPES);
const CLIPBOARD = new Set<string>(CLIPBOARD_EVENT_TYPES);
const CAMERA = new Set<string>(CAMERA_EVENT_TYPES);

export async function recordAttemptEvents(
  store: AttemptStore,
  candidateUserId: string,
  assignmentId: string,
  body: unknown,
  receivedAt: Date,
): Promise<
  Result<{
    accepted: number;
    dropped: number;
    limitReached: boolean;
    ended: AssessmentEndReason | null;
  }>
> {
  const parsed = attemptEventBatchSchema.safeParse(body);
  if (!parsed.success) return INVALID("Invalid activity batch");

  const { sessionId, sentAt, events } = parsed.data;
  const ctx = await store.findEventContext(assignmentId, candidateUserId, sessionId);
  if (!ctx || ctx.assessment.status !== "PUBLISHED") {
    return NOT_FOUND(NOT_FOUND_MSG);
  }
  if (!ctx.assessment.strictMode) {
    return CONFLICT("Activity isn't recorded for this assessment.");
  }
  if (ctx.status === "ASSIGNED" || !ctx.startedAt) {
    return CONFLICT("The assessment hasn't started.");
  }
  if (
    ctx.status === "SUBMITTED" &&
    ctx.submittedAt &&
    receivedAt.getTime() > ctx.submittedAt.getTime() + SUBMIT_GRACE_MS
  ) {
    return CONFLICT("This assessment has been submitted.");
  }
  if (!ctx.sessionExists && ctx.sessionCount >= MAX_SESSIONS_PER_ATTEMPT) {
    return CONFLICT("Too many page sessions for this attempt.");
  }

  const offsetMs = receivedAt.getTime() - sentAt;
  const questionById = new Map(ctx.assessment.questions.map((q) => [q.id, q]));
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const kept: EventWrite[] = [];

  for (const event of ordered) {
    if (
      event.occurredAt > sentAt + SENT_BEFORE_TOLERANCE_MS ||
      sentAt - event.occurredAt > MAX_CLIENT_LAG_MS
    ) {
      continue;
    }
    const corrected = new Date(
      Math.min(event.occurredAt + offsetMs, receivedAt.getTime()),
    );
    if (corrected.getTime() < ctx.startedAt.getTime() - BEFORE_START_TOLERANCE_MS) {
      continue;
    }
    if (
      ctx.submittedAt &&
      corrected.getTime() > ctx.submittedAt.getTime() + AFTER_SUBMIT_TOLERANCE_MS
    ) {
      continue;
    }
    if (CAMERA.has(event.type) && !ctx.assessment.cameraRequired) {
      continue;
    }

    let questionId: string | null = null;
    if (FILE_LINK.has(event.type)) {
      if (!event.questionId) continue;
      const q = questionById.get(event.questionId);
      if (!q || q.type !== "FILE_UPLOAD") continue;
      questionId = event.questionId;
    } else if (CLIPBOARD.has(event.type)) {
      questionId =
        event.questionId && questionById.has(event.questionId)
          ? event.questionId
          : null;
    }

    kept.push({
      seq: event.seq,
      type: event.type,
      occurredAt: corrected,
      clientOccurredAt: new Date(event.occurredAt),
      receivedAt,
      questionId,
      count: CLIPBOARD.has(event.type) ? (event.count ?? 1) : 1,
    });
  }

  const capacity = Math.max(0, MAX_EVENTS_PER_ATTEMPT - ctx.eventCount);
  const accepted = kept.slice(0, capacity);
  const limitReached = ctx.eventCount + kept.length > MAX_EVENTS_PER_ATTEMPT;

  await store.writeEventBatch(assignmentId, sessionId, receivedAt, accepted);

  // Strict mode's strike limit, enforced here too: the screen ends the attempt
  // at the third strike, and this closes it even if that call never arrives.
  let ended: AssessmentEndReason | null = null;
  if (
    ctx.status === "STARTED" &&
    accepted.some((e) => e.type === "VISIBILITY_VISIBLE" || e.type === "FULLSCREEN_EXITED")
  ) {
    const penalty = strikeLimitReason(await store.countStrikes(assignmentId, candidateUserId));
    if (penalty) {
      const out = await store.submitForced(
        assignmentId,
        candidateUserId,
        receivedAt,
        finishAttemptForced,
        penalty,
      );
      if (out.outcome === "SUBMITTED") ended = penalty;
    }
  }

  return OK({
    accepted: accepted.length,
    dropped: parsed.data.events.length - kept.length,
    limitReached,
    ended,
  });
}

