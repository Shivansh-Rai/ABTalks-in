import "server-only";

import {
  MAX_PARAGRAPH_WORDS,
  MAX_PLATFORM_DEADLINE_DAYS,
  assessmentDraftSchema,
  createAndSendPlatformSchema,
  editSentPlatformSchema,
  type AssessmentDraftInput,
  type AssessmentEndReason,
} from "@/lib/validations/assessment";
import type {
  AssessmentQuestionRow,
  ContentInput,
} from "@/features/recruiter-assessments/service";
import {
  closeAttemptsPastDeadline,
  type AttemptStore,
} from "@/features/assessment-attempts/service";

/**
 * Plan 166 — platform assessments: built by a platform admin on
 * /admin/assessments and sent to an audience (every candidate profile,
 * 60-Day Challenge domains, workshop registrants) with a deadline.
 *
 * They are RecruiterAssessment rows with source = PLATFORM and no
 * organization, so the candidate engine (assessment-attempts) runs them
 * unchanged. Every recruiter read filters on organizationId, which a platform
 * row never has.
 *
 * Callers are requireAdmin-gated server actions and admin pages. This module
 * does no authorization of its own.
 */

export type ChallengeDomain = "AI" | "DS" | "SE" | "CLAUDE";

export type PlatformAudience = {
  all: boolean;
  domains: ChallengeDomain[];
  workshopEventIds: string[];
};

export type PlatformStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type PlatformAssessmentRow = {
  id: string;
  title: string;
  subheading: string | null;
  instructions: string | null;
  status: PlatformStatus;
  durationMinutes: number | null;
  passMarkPercent: number;
  strictMode: boolean;
  cameraRequired: boolean;
  deadlineAt: Date | null;
  audience: PlatformAudience;
  publishedAt: Date | null;
  updatedAt: Date;
  createdByLabel: string;
  questions: AssessmentQuestionRow[];
};

export type PlatformListRow = {
  id: string;
  title: string;
  status: PlatformStatus;
  deadlineAt: Date | null;
  audience: PlatformAudience;
  questionCount: number;
  sent: number;
  submitted: number;
  updatedAt: Date;
  createdByLabel: string;
};

export type PlatformAttemptRow = {
  assignmentId: string;
  candidateUserId: string;
  name: string;
  email: string;
  status: "ASSIGNED" | "STARTED" | "SUBMITTED";
  startedAt: Date | null;
  submittedAt: Date | null;
  scorePercent: number | null;
  passed: boolean | null;
  endReason: AssessmentEndReason | null;
};

export type PlatformSummary = {
  sent: number;
  started: number;
  submitted: number;
  /** Never started, and the deadline has passed. */
  missed: number;
  passed: number;
  failed: number;
};

export type AudienceOptions = {
  allCount: number;
  domains: { domain: ChallengeDomain; label: string; count: number }[];
  workshops: { eventId: string; label: string; count: number }[];
};

export type PublishInput = {
  assessmentId: string;
  actorUserId: string;
  /** Null = no deadline. */
  deadlineAt: Date | null;
  audience: PlatformAudience;
  candidateUserIds: string[];
  at: Date;
};

/** Plan 166 edit: new text for a sent assessment, matched by position. */
export type WordingInput = {
  title: string;
  subheading: string | null;
  instructions: string | null;
  questions: {
    title: string;
    helpText: string | null;
    uploadDestinationUrl: string | null;
    options: string[];
  }[];
};

export type SentEditInput = {
  assessmentId: string;
  actorUserId: string;
  at: Date;
  /** Null = no deadline. */
  deadlineAt: Date | null;
  /** The full audience after the edit (a superset of the old one). */
  audience: PlatformAudience;
  /** Users the added groups cover; existing recipients are skipped. */
  newRecipientIds: string[];
  change:
    | { mode: "FULL"; content: ContentInput }
    | { mode: "WORDING"; wording: WordingInput };
};

export type PlatformStore = {
  create(createdByUserId: string, input: ContentInput): Promise<{ id: string }>;
  /** DRAFT-guarded. False when the row is missing or no longer a draft. */
  replaceDraftContent(
    assessmentId: string,
    input: ContentInput,
  ): Promise<boolean>;
  find(assessmentId: string): Promise<PlatformAssessmentRow | null>;
  list(): Promise<PlatformListRow[]>;
  /** DRAFT-guarded. A published assessment holds candidates' results. */
  deleteDraft(assessmentId: string): Promise<boolean>;
  /** The distinct user ids the audience covers right now (the send snapshot). */
  resolveAudience(audience: PlatformAudience): Promise<string[]>;
  /**
   * DRAFT → PUBLISHED, one assignment per user, and the audit row — one
   * transaction. `published: false` when the DRAFT guard matched nothing.
   */
  publishAndAssign(
    input: PublishInput,
  ): Promise<{ published: boolean; assigned: number }>;
  summarize(assessmentId: string, now: Date): Promise<PlatformSummary>;
  listAttempts(
    assessmentId: string,
    page: { skip: number; take: number },
  ): Promise<PlatformAttemptRow[]>;
  audienceOptions(): Promise<AudienceOptions>;
  /** Recipients who have started (or finished) — any answer may exist. */
  countStarted(assessmentId: string): Promise<number>;
  /**
   * One transaction: content or wording, deadline, audience, new recipients,
   * audit row. FULL is refused (`STARTED`) if anyone started meanwhile.
   */
  applySentEdit(
    input: SentEditInput,
  ): Promise<
    { ok: true; added: number } | { ok: false; reason: "NOT_SENT" | "STARTED" }
  >;
};

type Code = "NOT_FOUND" | "INVALID" | "CONFLICT";
type Result<T> =
  { ok: true; data: T } | { ok: false; code: Code; message: string };

const OK = <T>(data: T): Result<T> => ({ ok: true, data });
const FAIL = (code: Code, message: string): Result<never> => ({
  ok: false,
  code,
  message,
});

/** A deadline closer than this is refused — nobody could reasonably take it. */
export const MIN_DEADLINE_LEAD_MS = 15 * 60_000;
/** Sanity cap on one send (a snapshot bigger than this is a mistake). */
export const MAX_PLATFORM_RECIPIENTS = 50_000;

export const DOMAIN_LABELS: Record<ChallengeDomain, string> = {
  AI: "AI",
  DS: "Data Science",
  SE: "Software Engineering",
  CLAUDE: "Claude",
};

const GRADEABLE_MSG =
  "Add at least one multiple-choice question worth points — the pass mark is measured on those.";

/** Why a deadline is refused, or null when it is fine. */
function deadlineProblem(deadlineAt: Date | null, now: Date): string | null {
  if (deadlineAt === null) return null; // no deadline
  if (deadlineAt.getTime() < now.getTime() + MIN_DEADLINE_LEAD_MS) {
    return "Set a deadline at least 15 minutes from now.";
  }
  if (
    deadlineAt.getTime() >
    now.getTime() + MAX_PLATFORM_DEADLINE_DAYS * 86_400_000
  ) {
    return "Set a deadline within the next year.";
  }
  return null;
}

function isGradeable(draft: AssessmentDraftInput): boolean {
  return draft.questions.some(
    (q) => q.type === "MULTIPLE_CHOICE" && q.points > 0,
  );
}

function toContent(input: AssessmentDraftInput): ContentInput {
  return {
    title: input.title,
    subheading: input.subheading ?? null,
    instructions: input.instructions ?? null,
    durationMinutes: input.durationMinutes,
    passMarkPercent: input.passMarkPercent,
    cameraRequired: input.cameraRequired,
    // Shortlist provenance is a recruiter concept; platform drafts carry none.
    shortlistRefs: [],
    questions: input.questions,
  };
}

/** Plain-language audience, e.g. "All candidates" or "AI, DS + 2 workshops". */
export function describeAudience(audience: PlatformAudience): string {
  if (audience.all) return "All candidates";
  const parts: string[] = [];
  if (audience.domains.length > 0) {
    parts.push(
      `Challenge: ${audience.domains.map((d) => DOMAIN_LABELS[d]).join(", ")}`,
    );
  }
  const w = audience.workshopEventIds.length;
  if (w > 0) parts.push(`${w} workshop${w === 1 ? "" : "s"}`);
  return parts.join(" + ") || "—";
}

/** The stored draft in the builder's shape — per type, no extra keys. */
export function rowToBuilderDraft(row: PlatformAssessmentRow): AssessmentDraftInput {
  return {
    assessmentId: row.id,
    title: row.title,
    subheading: row.subheading,
    instructions: row.instructions,
    durationMinutes: row.durationMinutes,
    passMarkPercent: row.passMarkPercent,
    cameraRequired: row.cameraRequired,
    shortlistRefs: [],
    questions: row.questions.map((q) => {
      const base = {
        title: q.title,
        helpText: q.helpText,
        isRequired: q.isRequired,
        points: q.points,
      };
      if (q.type === "MULTIPLE_CHOICE") {
        return {
          ...base,
          type: "MULTIPLE_CHOICE" as const,
          allowMultipleCorrect: q.allowMultipleCorrect,
          options: q.options.map((o) => ({
            body: o.body,
            isCorrect: o.isCorrect,
          })),
        };
      }
      if (q.type === "PARAGRAPH") {
        return {
          ...base,
          type: "PARAGRAPH" as const,
          maxWords: q.maxWords ?? MAX_PARAGRAPH_WORDS,
        };
      }
      return {
        ...base,
        type: "FILE_UPLOAD" as const,
        uploadDestinationUrl: q.uploadDestinationUrl ?? "",
      };
    }),
  };
}

export async function savePlatformDraft(
  store: PlatformStore,
  adminUserId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = assessmentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return FAIL(
      "INVALID",
      parsed.error.issues[0]?.message ?? "Invalid assessment",
    );
  }
  return saveParsedDraft(store, adminUserId, parsed.data);
}

async function saveParsedDraft(
  store: PlatformStore,
  adminUserId: string,
  draft: AssessmentDraftInput,
): Promise<Result<{ id: string }>> {
  const content = toContent(draft);
  if (!draft.assessmentId) {
    return OK(await store.create(adminUserId, content));
  }
  const existing = await store.find(draft.assessmentId);
  if (!existing) return FAIL("NOT_FOUND", "Assessment not found");
  if (existing.status !== "DRAFT") {
    return FAIL(
      "CONFLICT",
      "This assessment has already been sent and can no longer be edited.",
    );
  }
  const replaced = await store.replaceDraftContent(draft.assessmentId, content);
  if (!replaced) {
    return FAIL(
      "CONFLICT",
      "This assessment has already been sent and can no longer be edited.",
    );
  }
  return OK({ id: draft.assessmentId });
}

export async function deletePlatformDraft(
  store: PlatformStore,
  assessmentId: string,
): Promise<Result<{ id: string }>> {
  const row = await store.find(assessmentId);
  if (!row) return FAIL("NOT_FOUND", "Assessment not found");
  if (row.status !== "DRAFT") {
    return FAIL(
      "CONFLICT",
      "Sent assessments can't be deleted — they hold candidates' results.",
    );
  }
  const removed = await store.deleteDraft(assessmentId);
  if (!removed)
    return FAIL("CONFLICT", "This assessment is no longer a draft.");
  return OK({ id: assessmentId });
}

export type SendOutcome =
  | { ok: true; data: { id: string; assigned: number } }
  | { ok: false; code: Code; message: string; assessmentId: string | null };

/**
 * Save the draft, then publish it and assign it to everyone the audience
 * covers at this moment (snapshot — later joiners do not receive it).
 *
 * Nothing is written until the input, the deadline and the audience have all
 * been checked. If the publish step fails after the draft was saved, the
 * draft's id comes back so the builder's retry updates it instead of creating
 * a second one.
 */
export async function createPublishAndSend(
  store: PlatformStore,
  adminUserId: string,
  input: unknown,
  now: Date = new Date(),
): Promise<SendOutcome> {
  const parsed = createAndSendPlatformSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.issues[0]?.message ?? "Invalid assessment",
      assessmentId: null,
    };
  }
  const { draft, audience } = parsed.data;
  const fail = (
    code: Code,
    message: string,
    assessmentId: string | null = null,
  ): SendOutcome => ({
    ok: false,
    code,
    message,
    assessmentId,
  });

  const deadlineAt = parsed.data.deadlineAt
    ? new Date(parsed.data.deadlineAt)
    : null;
  const badDeadline = deadlineProblem(deadlineAt, now);
  if (badDeadline) return fail("INVALID", badDeadline);
  // The pass mark is a share of auto-gradeable points — same rule as recruiters.
  if (!isGradeable(draft)) return fail("INVALID", GRADEABLE_MSG);

  const candidateUserIds = await store.resolveAudience(audience);
  if (candidateUserIds.length === 0) {
    return fail(
      "INVALID",
      "Nobody is in this audience yet. Pick a different group.",
    );
  }
  if (candidateUserIds.length > MAX_PLATFORM_RECIPIENTS) {
    return fail(
      "INVALID",
      `This audience has more than ${MAX_PLATFORM_RECIPIENTS.toLocaleString("en-IN")} people. Narrow it down.`,
    );
  }

  const saved = await saveParsedDraft(store, adminUserId, draft);
  if (!saved.ok) return fail(saved.code, saved.message);
  const id = saved.data.id;

  const out = await store.publishAndAssign({
    assessmentId: id,
    actorUserId: adminUserId,
    deadlineAt,
    audience,
    candidateUserIds,
    at: now,
  });
  if (!out.published) {
    return fail("CONFLICT", "This assessment has already been sent.", id);
  }
  return { ok: true, data: { id, assigned: out.assigned } };
}

// ---------------------------------------------------------------------------
// Editing a sent assessment.
//
// Until anyone starts, everything can change (no answers exist yet). After the
// first start, only wording can: question/option text, help text, upload link,
// title, subheading, instructions. Type, points, required, correct options,
// option count, word cap, order, time limit, pass mark and camera are fixed,
// so no candidate's answers or result shift underneath them. The deadline can
// always move (at least 15 minutes out) and groups can be added, never removed.
// ---------------------------------------------------------------------------

/** What changed in the structure, in words — or null when only text changed. */
export function structureChange(
  row: PlatformAssessmentRow,
  draft: AssessmentDraftInput,
): string | null {
  if (draft.durationMinutes !== row.durationMinutes) return "the time limit";
  if (draft.passMarkPercent !== row.passMarkPercent) return "the pass mark";
  if (draft.cameraRequired !== row.cameraRequired) return "the camera setting";
  if (draft.questions.length !== row.questions.length) {
    return "the number of questions";
  }
  for (let i = 0; i < draft.questions.length; i++) {
    const d = draft.questions[i];
    const r = row.questions[i];
    const n = `question ${i + 1}`;
    if (d.type !== r.type) return `${n}'s type`;
    if (d.points !== r.points) return `${n}'s points`;
    if (d.isRequired !== r.isRequired) return `whether ${n} is required`;
    if (d.type === "MULTIPLE_CHOICE") {
      if (d.allowMultipleCorrect !== r.allowMultipleCorrect) {
        return `${n}'s answer type`;
      }
      if (d.options.length !== r.options.length) return `${n}'s options`;
      if (d.options.some((o, j) => o.isCorrect !== r.options[j]?.isCorrect)) {
        return `${n}'s correct answer`;
      }
    }
    if (
      d.type === "PARAGRAPH" &&
      d.maxWords !== (r.maxWords ?? MAX_PARAGRAPH_WORDS)
    ) {
      return `${n}'s word cap`;
    }
  }
  return null;
}

function removesGroup(
  before: PlatformAudience,
  after: PlatformAudience,
): boolean {
  return (
    (before.all && !after.all) ||
    before.domains.some((d) => !after.domains.includes(d)) ||
    before.workshopEventIds.some((w) => !after.workshopEventIds.includes(w))
  );
}

/** Only the groups the edit adds. */
export function addedGroups(
  before: PlatformAudience,
  after: PlatformAudience,
): PlatformAudience {
  return {
    all: after.all && !before.all,
    domains: after.domains.filter((d) => !before.domains.includes(d)),
    workshopEventIds: after.workshopEventIds.filter(
      (w) => !before.workshopEventIds.includes(w),
    ),
  };
}

export async function editSentAssessment(
  store: PlatformStore,
  adminUserId: string,
  input: unknown,
  now: Date = new Date(),
): Promise<
  Result<{ id: string; mode: "FULL" | "WORDING"; added: number }>
> {
  const parsed = editSentPlatformSchema.safeParse(input);
  if (!parsed.success) {
    return FAIL(
      "INVALID",
      parsed.error.issues[0]?.message ?? "Invalid assessment",
    );
  }
  const { assessmentId, draft, audience } = parsed.data;

  const row = await store.find(assessmentId);
  if (!row) return FAIL("NOT_FOUND", "Assessment not found");
  if (row.status !== "PUBLISHED") {
    return FAIL("CONFLICT", "Only a sent assessment can be edited here.");
  }

  const deadlineAt = parsed.data.deadlineAt
    ? new Date(parsed.data.deadlineAt)
    : null;
  const badDeadline = deadlineProblem(deadlineAt, now);
  if (badDeadline) return FAIL("INVALID", badDeadline);

  if (removesGroup(row.audience, audience)) {
    return FAIL(
      "INVALID",
      "Groups that already received this assessment can't be removed.",
    );
  }

  const started = await store.countStarted(assessmentId);
  let change: SentEditInput["change"];
  if (started === 0) {
    if (!isGradeable(draft)) return FAIL("INVALID", GRADEABLE_MSG);
    change = { mode: "FULL", content: toContent(draft) };
  } else {
    const what = structureChange(row, draft);
    if (what) {
      return FAIL(
        "CONFLICT",
        `${started} candidate${started === 1 ? " has" : "s have"} started, so ${what} can't change. You can still fix wording, move the deadline and add groups.`,
      );
    }
    change = {
      mode: "WORDING",
      wording: {
        title: draft.title,
        subheading: draft.subheading ?? null,
        instructions: draft.instructions ?? null,
        questions: draft.questions.map((q) => ({
          title: q.title,
          helpText: q.helpText ?? null,
          uploadDestinationUrl:
            q.type === "FILE_UPLOAD" ? q.uploadDestinationUrl : null,
          options:
            q.type === "MULTIPLE_CHOICE" ? q.options.map((o) => o.body) : [],
        })),
      },
    };
  }

  const added = addedGroups(row.audience, audience);
  const hasAdded =
    added.all || added.domains.length > 0 || added.workshopEventIds.length > 0;
  const newRecipientIds = hasAdded ? await store.resolveAudience(added) : [];
  if (newRecipientIds.length > MAX_PLATFORM_RECIPIENTS) {
    return FAIL(
      "INVALID",
      `The added groups have more than ${MAX_PLATFORM_RECIPIENTS.toLocaleString("en-IN")} people. Narrow them down.`,
    );
  }

  const out = await store.applySentEdit({
    assessmentId,
    actorUserId: adminUserId,
    at: now,
    deadlineAt,
    audience,
    newRecipientIds,
    change,
  });
  if (!out.ok) {
    return out.reason === "STARTED"
      ? FAIL(
          "CONFLICT",
          "A candidate started while you were editing, so only wording can change now. Reload and try again.",
        )
      : FAIL("CONFLICT", "Only a sent assessment can be edited here.");
  }
  return OK({ id: assessmentId, mode: change.mode, added: out.added });
}

export const MONITOR_PAGE_SIZE = 50;

export type PlatformMonitor = {
  assessment: PlatformAssessmentRow;
  summary: PlatformSummary;
  attempts: PlatformAttemptRow[];
  page: number;
  pageCount: number;
  /** STARTED attempts this load closed because the deadline had passed. */
  closedNow: number;
};

/**
 * The admin's view of one sent assessment. Attempts left STARTED past the
 * deadline are closed first (graded on their saved answers), so the counts and
 * scores are final once the deadline has passed.
 */
export async function getPlatformMonitor(
  store: PlatformStore,
  attempts: AttemptStore,
  assessmentId: string,
  page: number,
  now: Date = new Date(),
): Promise<Result<PlatformMonitor>> {
  const row = await store.find(assessmentId);
  if (!row) return FAIL("NOT_FOUND", "Assessment not found");

  const closedNow =
    row.status === "PUBLISHED" && row.deadlineAt && row.deadlineAt <= now
      ? await closeAttemptsPastDeadline(attempts, assessmentId, now)
      : 0;

  const summary = await store.summarize(assessmentId, now);
  const pageCount = Math.max(1, Math.ceil(summary.sent / MONITOR_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const list = await store.listAttempts(assessmentId, {
    skip: (safePage - 1) * MONITOR_PAGE_SIZE,
    take: MONITOR_PAGE_SIZE,
  });
  return OK({
    assessment: row,
    summary,
    attempts: list,
    page: safePage,
    pageCount,
    closedNow,
  });
}
