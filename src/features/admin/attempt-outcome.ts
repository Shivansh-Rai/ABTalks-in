import { formatDuration } from "@/features/assessment-attempts/activity";
import { formatDateTimeIST } from "@/lib/date-utils";
import type { AssessmentEndReason } from "@/lib/validations/assessment";
import type { QuestionOutcome } from "@/features/assessment-attempts/service";

/**
 * T-265 — what happened to one candidate's assessment attempt, in words.
 *
 * Pure: the shaped attempt in, plain sentences out. No Prisma, no `server-only`
 * — the loader is `get-admin-attempt-detail.ts` and the test drives this
 * directly.
 *
 * Everything here is a fact already stored: the assignment row's own timestamps,
 * status, `endReason`, `scorePercent` and `passed`; the candidate's saved
 * `AssessmentAnswer` rows; and the page activity T-219 recorded. Nothing is
 * inferred about the person. The same rule the recruiter surfaces follow applies
 * word for word (`BANNED_CLAIM_PATTERN` in `assessment-attempts/activity.ts`):
 * these are facts about a page and a score, never a judgement about a candidate.
 */

export type AttemptQuestionDetail = {
  questionId: string;
  /** 1-based, matching the numbering the candidate and the recruiter see. */
  number: number;
  type: "MULTIPLE_CHOICE" | "PARAGRAPH" | "FILE_UPLOAD";
  title: string;
  helpText: string | null;
  isRequired: boolean;
  points: number;
  earnedPoints: number;
  outcome: QuestionOutcome["kind"];
  /** Whether the candidate left anything usable for this question. */
  answered: boolean;
  /** When the answer was last saved. Null when nothing was ever saved. */
  savedAt: Date | null;
  options: { id: string; body: string; isCorrect: boolean; selected: boolean }[];
  text: string | null;
  wordCount: number | null;
  maxWords: number | null;
  overWordLimit: boolean;
  fileUrl: string | null;
  uploadDestinationUrl: string | null;
};

export type AttemptGrading = {
  /** Points earned over auto-gradeable points, recounted from the saved answers. */
  earnedPoints: number;
  totalPoints: number;
  recountedPercent: number;
  autoGradedCount: number;
  notAutoGradedCount: number;
  noKeyCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  unansweredRequiredCount: number;
  overWordLimitCount: number;
  /** False when the stored score and a recount of the saved answers disagree. */
  matchesStoredScore: boolean;
};

export type AdminAttemptDetail = {
  assignmentId: string;
  candidate: { userId: string; name: string; email: string };
  /** The Shortlist handle the recruiter assigned from. A name, never a capability. */
  candidateRef: string;
  assessment: {
    id: string;
    title: string;
    subheading: string | null;
    instructions: string | null;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    durationMinutes: number | null;
    passMarkPercent: number;
    strictMode: boolean;
    cameraRequired: boolean;
    organizationName: string | null;
    createdByName: string | null;
  };
  status: "ASSIGNED" | "STARTED" | "SUBMITTED";
  assignedAt: Date;
  startedAt: Date | null;
  submittedAt: Date | null;
  endReason: AssessmentEndReason | null;
  scorePercent: number | null;
  passed: boolean | null;
  questions: AttemptQuestionDetail[];
  grading: AttemptGrading;
};

export type AttemptExplanation = {
  /** One line: the outcome itself. */
  headline: string;
  /** How it ended, how long it took, how the score was reached, what is missing. */
  lines: string[];
  /** Things that need an admin's attention rather than just describing the run. */
  warnings: string[];
};

/** The strict-mode limits that end an attempt on their own. */
export function isPenaltyReason(reason: AssessmentEndReason | null): boolean {
  return reason === "TAB_SWITCH_LIMIT" || reason === "FULLSCREEN_LIMIT";
}

/**
 * Why the attempt closed. Same wording as the recruiter's own attempt page
 * (`endReasonCopy`), plus the normal-Submit case that page has no room for.
 */
export function endReasonLine(reason: AssessmentEndReason | null): string {
  switch (reason) {
    case "TAB_SWITCH_LIMIT":
      return "Auto-ended: the page reported switching tabs 3 times, the strict-mode limit.";
    case "FULLSCREEN_LIMIT":
      return "Auto-ended: the page reported leaving fullscreen 3 times, the strict-mode limit.";
    case "ENDED_EARLY":
      return "The candidate ended the test early.";
    case "TIME_UP":
      return "Time ran out and the answers saved so far were submitted.";
    case "LEFT_PAGE":
      return "Ended when the candidate left the page, with the answers saved so far.";
    case "SUBMITTED":
      return "The candidate submitted the attempt.";
    default:
      return "How this attempt closed was not recorded — it predates the column that stores it.";
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function explainAttemptOutcome(d: AdminAttemptDetail): AttemptExplanation {
  const lines: string[] = [];
  const warnings: string[] = [];
  const g = d.grading;

  if (d.status === "ASSIGNED") {
    lines.push(
      `Assigned ${formatDateTimeIST(d.assignedAt)}. The candidate has never opened it, so there are no answers and no recorded activity.`,
    );
    if (d.assessment.status !== "PUBLISHED") {
      warnings.push(
        `The assessment is ${d.assessment.status.toLowerCase()}, so the candidate cannot open it at all.`,
      );
    }
    return { headline: "Assigned — never started.", lines, warnings };
  }

  if (d.status === "STARTED") {
    lines.push(
      `Started ${d.startedAt ? formatDateTimeIST(d.startedAt) : "at an unrecorded time"} and never submitted.`,
    );
    lines.push(
      d.assessment.durationMinutes == null
        ? "This assessment is untimed, so the attempt can still be finished."
        : `The limit is ${d.assessment.durationMinutes} minutes from the start; the server enforces it on the next action, so an attempt can sit open past it.`,
    );
    lines.push(
      `${plural(g.autoGradedCount, "question is", "questions are")} auto-gradeable; ${plural(d.questions.length - g.unansweredCount, "question has", "questions have")} an answer saved so far.`,
    );
    return { headline: "Started — still open, no result yet.", lines, warnings };
  }

  const scored = d.scorePercent != null;
  const headline = scored
    ? `${d.scorePercent}% against a ${d.assessment.passMarkPercent}% pass mark — ${d.passed ? "passed" : "failed"}.`
    : "Submitted, but no score was recorded for this attempt.";

  lines.push(endReasonLine(d.endReason));

  if (d.startedAt && d.submittedAt) {
    const took = formatDuration(d.submittedAt.getTime() - d.startedAt.getTime());
    lines.push(
      d.assessment.durationMinutes == null
        ? `Took ${took}; the assessment is untimed.`
        : `Took ${took} of the ${d.assessment.durationMinutes}-minute limit.`,
    );
  } else if (d.submittedAt) {
    lines.push(
      `Submitted ${formatDateTimeIST(d.submittedAt)}; no start time was recorded, so how long it took is unknown.`,
    );
  }

  if (g.totalPoints === 0) {
    lines.push(
      "Nothing on this assessment is auto-gradeable — no multiple-choice question carries points — so the score is 0% by construction and says nothing about the answers.",
    );
  } else {
    lines.push(
      `Scored on ${plural(g.autoGradedCount, "multiple-choice question", "multiple-choice questions")}: ${g.correctCount} correct, ${g.incorrectCount} incorrect, ${g.earnedPoints} of ${g.totalPoints} points.`,
    );
  }

  if (g.notAutoGradedCount > 0) {
    lines.push(
      `${plural(g.notAutoGradedCount, "question is", "questions are")} a paragraph or a file link and ${g.notAutoGradedCount === 1 ? "is" : "are"} not auto-graded — read ${g.notAutoGradedCount === 1 ? "it" : "them"} below before judging this result.`,
    );
  }

  if (g.unansweredCount > 0) {
    lines.push(
      `${plural(g.unansweredCount, "question was", "questions were")} left with no answer${g.unansweredRequiredCount > 0 ? `, ${g.unansweredRequiredCount} of them required` : ""}.`,
    );
  }

  if (!scored) {
    warnings.push(
      "The assignment row carries no score. Either it was submitted before scoring was stored, or the submit transaction did not finish writing the result.",
    );
  } else if (!g.matchesStoredScore) {
    warnings.push(
      `The stored score is ${d.scorePercent}%, but recounting the saved answers against the current answer key gives ${g.recountedPercent}%. The questions, the options or the answers changed after this attempt was scored.`,
    );
  }

  if (g.noKeyCount > 0) {
    warnings.push(
      `${plural(g.noKeyCount, "scored question has", "scored questions have")} no correct option marked, so ${g.noKeyCount === 1 ? "it counts" : "they count"} toward the total and can never be earned. That alone caps this candidate's score.`,
    );
  }

  if (g.overWordLimitCount > 0) {
    warnings.push(
      `${plural(g.overWordLimitCount, "paragraph answer is", "paragraph answers are")} over the word limit. An intentional Submit refuses that, so this attempt was closed by the server — the time limit, a strict-mode limit, or leaving the page.`,
    );
  }

  if (g.unansweredRequiredCount > 0) {
    warnings.push(
      `${plural(g.unansweredRequiredCount, "required question has", "required questions have")} no answer. An intentional Submit refuses that too, so the same applies: this attempt was closed by the server, not finished by the candidate.`,
    );
  }

  if (isPenaltyReason(d.endReason)) {
    warnings.push(
      "This attempt was cut short by a strict-mode limit, so the score is over whatever had been answered by then, not over a completed attempt.",
    );
  }

  return { headline, lines, warnings };
}
