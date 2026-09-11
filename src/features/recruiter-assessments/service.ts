import "server-only";

import type {
  AssessmentDraftInput,
  AssessmentQuestionInput,
} from "@/lib/validations/assessment";
import {
  assessmentDraftSchema,
  assignAssessmentSchema,
  createAndSendSchema,
} from "@/lib/validations/assessment";

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

/** What `store.listOwned` returns — the list row before result counts. */
export type AssessmentListStoreRow = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  durationMinutes: number | null;
  passMarkPercent: number;
  questionCount: number;
  updatedAt: Date;
};

export type AssignmentStatus = "ASSIGNED" | "STARTED" | "SUBMITTED";

export type AssignableCandidate = {
  candidateRef: string;
  candidateUserId: string;
  label: string;
  jobRole: string;
};

export type AssignmentRow = {
  id: string;
  candidateUserId: string;
  candidateRef: string;
  label: string;
  status: AssignmentStatus;
  assignedAt: Date;
  startedAt: Date | null;
  submittedAt: Date | null;
  scorePercent: number | null;
  passed: boolean | null;
};

export type ResultCounts = { students: number; passed: number; failed: number };

export type AssessmentListRow = AssessmentListStoreRow & {
  /** Null for DRAFT — nothing can have been assigned yet. */
  results: ResultCounts | null;
};

/** A Shortlisted candidate as the assign panel sees it — no user id. */
export type MonitorCandidate = {
  candidateRef: string;
  label: string;
  jobRole: string;
  alreadyAssigned: boolean;
};

export type AssessmentMonitor = {
  assessment: {
    id: string;
    title: string;
    status: AssessmentRow["status"];
    durationMinutes: number | null;
    passMarkPercent: number;
    questionCount: number;
    publishedAt: Date | null;
  };
  summary: {
    assigned: number;
    started: number;
    completed: number;
    passed: number;
    failed: number;
  };
  assignments: AssignmentRow[];
  candidates: MonitorCandidate[];
};

export type AssessmentNotifier = {
  assigned(input: {
    recipientUserId: string;
    assessmentId: string;
    assignmentId: string;
  }): Promise<{ ok: boolean; deduplicated: boolean }>;
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
  listOwned(scope: Scope): Promise<AssessmentListStoreRow[]>;
  delete(assessmentId: string, scope: Scope): Promise<boolean>;
  /** DRAFT → PUBLISHED in one guarded write. False when nothing moved. */
  publish(assessmentId: string, scope: Scope, at: Date): Promise<boolean>;
  /** The recruiter's live Shortlist, both halves, searchable candidates only. */
  listAssignableCandidates(recruiterUserId: string): Promise<AssignableCandidate[]>;
  upsertAssignments(
    assessmentId: string,
    rows: { candidateUserId: string; candidateRef: string }[],
  ): Promise<{ id: string; candidateUserId: string; created: boolean }[]>;
  listAssignments(assessmentId: string, scope: Scope): Promise<AssignmentRow[]>;
  countResults(
    scope: Scope,
    assessmentIds: string[],
  ): Promise<Map<string, ResultCounts>>;
};

/** T-218 builds this route. Agreed here so notifications sent before it
 *  lands point at the right place. */
export function candidateAssessmentHref(assignmentId: string): string {
  return `/assessments/${assignmentId}`;
}

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
  const rows = await store.listOwned(scope);
  const counts = await store.countResults(
    scope,
    rows.filter((r) => r.status !== "DRAFT").map((r) => r.id),
  );
  return OK(
    rows.map((r) => ({
      ...r,
      results:
        r.status === "DRAFT"
          ? null
          : (counts.get(r.id) ?? { students: 0, passed: 0, failed: 0 }),
    })),
  );
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
  const row = await store.findOwned(assessmentId, scope);
  if (!row) return NOT_FOUND("Assessment not found");
  if (row.status !== "DRAFT") {
    return CONFLICT(
      "Published assessments can't be deleted — they hold candidates' results.",
    );
  }
  const removed = await store.delete(assessmentId, scope);
  if (!removed) return NOT_FOUND("Assessment not found");
  return OK({ id: assessmentId });
}

export async function publishAssessment(
  store: AssessmentStore,
  scope: Scope,
  assessmentId: string,
): Promise<Result<{ id: string; alreadyPublished: boolean }>> {
  const row = await store.findOwned(assessmentId, scope);
  if (!row) return NOT_FOUND("Assessment not found");
  if (row.status === "PUBLISHED") {
    return OK({ id: row.id, alreadyPublished: true });
  }
  if (row.status === "ARCHIVED") {
    return CONFLICT("This assessment is archived and can't be published.");
  }
  // The pass mark is a share of auto-gradeable points. With none, T-218 has
  // nothing to score, so the assessment could never produce a result.
  const gradeable = row.questions.some(
    (q) => q.type === "MULTIPLE_CHOICE" && q.points > 0,
  );
  if (!gradeable) {
    return INVALID(
      "Add at least one multiple-choice question worth points — the pass mark is measured on those.",
    );
  }

  const moved = await store.publish(assessmentId, scope, new Date());
  if (!moved) {
    // Lost a race with another tab or a double click: the DRAFT guard in the
    // write's WHERE matched nothing. Whoever won published it once.
    const again = await store.findOwned(assessmentId, scope);
    if (again?.status === "PUBLISHED") {
      return OK({ id: assessmentId, alreadyPublished: true });
    }
    return NOT_FOUND("Assessment not found");
  }
  return OK({ id: assessmentId, alreadyPublished: false });
}

export async function assignAssessment(
  store: AssessmentStore,
  notifier: AssessmentNotifier,
  scope: Scope,
  input: unknown,
): Promise<
  Result<{ assigned: number; alreadyAssigned: number; notificationFailures: number }>
> {
  const parsed = assignAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    return INVALID(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { assessmentId } = parsed.data;

  const row = await store.findOwned(assessmentId, scope);
  if (!row) return NOT_FOUND("Assessment not found");
  if (row.status !== "PUBLISHED") {
    return CONFLICT("Publish this assessment before assigning it.");
  }

  // Refs are names, not capabilities: every one is re-resolved against the
  // recruiter's own live Shortlist, and the whole call is refused if any is
  // missing so the result message is never half true.
  const refs = [...new Set(parsed.data.candidateRefs)];
  const pool = await store.listAssignableCandidates(scope.createdByUserId);
  const byRef = new Map(pool.map((c) => [c.candidateRef, c]));

  const targets: { candidateUserId: string; candidateRef: string }[] = [];
  const seenUsers = new Set<string>();
  for (const ref of refs) {
    const candidate = byRef.get(ref);
    if (!candidate) {
      return INVALID(
        "Some of these candidates are no longer on your Shortlist. Refresh and try again.",
      );
    }
    if (seenUsers.has(candidate.candidateUserId)) continue;
    seenUsers.add(candidate.candidateUserId);
    targets.push({
      candidateUserId: candidate.candidateUserId,
      candidateRef: candidate.candidateRef,
    });
  }

  const rows = await store.upsertAssignments(assessmentId, targets);

  // Every row, new and existing, one at a time. The dispatch dedupe key is
  // per candidate per assessment, so an existing row that was notified is a
  // no-op and one whose first send failed gets its retry. Narrowing this to
  // created rows would lose that retry.
  let notificationFailures = 0;
  for (const r of rows) {
    try {
      const res = await notifier.assigned({
        recipientUserId: r.candidateUserId,
        assessmentId,
        assignmentId: r.id,
      });
      if (!res.ok) notificationFailures++;
    } catch {
      notificationFailures++;
    }
  }

  const assigned = rows.filter((r) => r.created).length;
  return OK({
    assigned,
    alreadyAssigned: rows.length - assigned,
    notificationFailures,
  });
}

export async function getAssessmentMonitor(
  store: AssessmentStore,
  scope: Scope,
  assessmentId: string,
): Promise<Result<AssessmentMonitor>> {
  const row = await store.findOwned(assessmentId, scope);
  if (!row) return NOT_FOUND("Assessment not found");

  const assignments = await store.listAssignments(assessmentId, scope);
  const summary = {
    assigned: assignments.length,
    started: assignments.filter((a) => a.startedAt !== null).length,
    completed: assignments.filter((a) => a.status === "SUBMITTED").length,
    passed: assignments.filter((a) => a.passed === true).length,
    failed: assignments.filter((a) => a.passed === false).length,
  };

  let candidates: MonitorCandidate[] = [];
  if (row.status === "PUBLISHED") {
    const pool = await store.listAssignableCandidates(scope.createdByUserId);
    const assignedUserIds = new Set(assignments.map((a) => a.candidateUserId));
    candidates = pool.map((c) => ({
      candidateRef: c.candidateRef,
      label: c.label,
      jobRole: c.jobRole,
      alreadyAssigned: assignedUserIds.has(c.candidateUserId),
    }));
  }

  return OK({
    assessment: {
      id: row.id,
      title: row.title,
      status: row.status,
      durationMinutes: row.durationMinutes,
      passMarkPercent: row.passMarkPercent,
      questionCount: row.questions.length,
      publishedAt: row.publishedAt,
    },
    summary,
    assignments,
    candidates,
  });
}

// ---------------------------------------------------------------------------
// Plan 131 — the builder's Create: save, publish and send in one step.
// ---------------------------------------------------------------------------

/** A Shortlisted candidate as the builder's send step sees it — no user id. */
export type SendableCandidate = {
  candidateRef: string;
  label: string;
  jobRole: string;
};

/** The recruiter's live Shortlist (both halves, searchable only), for the builder. */
export async function listSendableCandidates(
  store: AssessmentStore,
  recruiterUserId: string,
): Promise<SendableCandidate[]> {
  const pool = await store.listAssignableCandidates(recruiterUserId);
  return pool.map((c) => ({
    candidateRef: c.candidateRef,
    label: c.label,
    jobRole: c.jobRole,
  }));
}

export type CreateAndSendResult = {
  id: string;
  assigned: number;
  alreadyAssigned: number;
  notificationFailures: number;
  /** Set when the assessment went live but assigning it failed. */
  assignError: string | null;
};

type CreateAndSendOutcome =
  | { ok: true; data: CreateAndSendResult }
  | {
      ok: false;
      code: "NOT_FOUND" | "INVALID" | "CONFLICT";
      message: string;
      /** The saved draft, when one exists — the builder's retry updates it. */
      assessmentId: string | null;
    };

/**
 * Save the draft, publish it, and assign it to the Shortlisted candidates the
 * recruiter ticked — each notified once through the existing notifier.
 *
 * Three steps that are each idempotent on their own, with no transaction
 * across them, so every failure leaves a state the recruiter can finish from:
 * - invalid input or a ref off the Shortlist → nothing is written at all;
 * - save or publish fails → nothing is live; the draft's id comes back so the
 *   next click updates it instead of creating a duplicate;
 * - assign fails after publishing → the assessment is live with nobody on it;
 *   `assignError` says so and the builder hands over to the detail page.
 */
export async function createPublishAndAssign(
  store: AssessmentStore,
  notifier: AssessmentNotifier,
  scope: Scope,
  input: unknown,
): Promise<CreateAndSendOutcome> {
  const parsed = createAndSendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.issues[0]?.message ?? "Invalid assessment",
      assessmentId: null,
    };
  }
  const { draft } = parsed.data;
  const refs = [...new Set(parsed.data.candidateRefs)];

  // Checked before anything is saved: a stale pick must not leave a live
  // assessment behind. assignAssessment re-checks (the Shortlist can change
  // in between; that rare race lands in the assignError branch).
  const pool = await store.listAssignableCandidates(scope.createdByUserId);
  const onShortlist = new Set(pool.map((c) => c.candidateRef));
  if (refs.some((ref) => !onShortlist.has(ref))) {
    return {
      ok: false,
      code: "INVALID",
      message:
        "Some of these candidates are no longer on your Shortlist. Refresh and try again.",
      assessmentId: null,
    };
  }

  const saved = draft.assessmentId
    ? await saveAssessmentDraft(store, scope, draft)
    : await createAssessment(store, scope, draft);
  if (!saved.ok) {
    return { ok: false, code: saved.code, message: saved.message, assessmentId: null };
  }
  const id = saved.data.id;

  const published = await publishAssessment(store, scope, id);
  if (!published.ok) {
    return {
      ok: false,
      code: published.code,
      message: published.message,
      assessmentId: id,
    };
  }

  const assigned = await assignAssessment(store, notifier, scope, {
    assessmentId: id,
    candidateRefs: refs,
  });
  if (!assigned.ok) {
    return {
      ok: true,
      data: {
        id,
        assigned: 0,
        alreadyAssigned: 0,
        notificationFailures: 0,
        assignError: assigned.message,
      },
    };
  }

  return { ok: true, data: { id, ...assigned.data, assignError: null } };
}
