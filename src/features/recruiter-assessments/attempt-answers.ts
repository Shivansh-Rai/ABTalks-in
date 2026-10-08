import "server-only";

import { prisma } from "@/lib/db";
import { gradeQuestion } from "@/features/assessment-attempts/service";
import { MAX_PARAGRAPH_WORDS, countWords } from "@/lib/validations/assessment";
import type { Scope } from "./service";

/**
 * One candidate's saved answers, question by question, for the recruiter who
 * owns the assessment. The grading is the platform's own `gradeQuestion`, so
 * this page cannot disagree with the score stored on the assignment.
 *
 * Scope is in the WHERE next to the ids: a foreign or mismatched id reads as
 * null (a 404 on the page), never as someone else's answers. No contact field
 * is selected — the recruiter sees the same label the monitor shows.
 */

export type AttemptAnswerQuestion = {
  questionId: string;
  /** 1-based, matching the numbering the candidate sees. */
  number: number;
  type: "MULTIPLE_CHOICE" | "PARAGRAPH" | "FILE_UPLOAD";
  title: string;
  helpText: string | null;
  isRequired: boolean;
  points: number;
  earnedPoints: number;
  outcome: "CORRECT" | "INCORRECT" | "NO_KEY" | "NOT_AUTO_GRADED";
  answered: boolean;
  options: { id: string; body: string; isCorrect: boolean; selected: boolean }[];
  text: string | null;
  wordCount: number | null;
  maxWords: number | null;
  fileUrl: string | null;
};

export type AttemptAnswers = {
  scorePercent: number | null;
  passed: boolean | null;
  passMarkPercent: number;
  earnedPoints: number;
  totalPoints: number;
  correctCount: number;
  incorrectCount: number;
  notAutoGradedCount: number;
  unansweredCount: number;
  questions: AttemptAnswerQuestion[];
};

export async function getAttemptAnswers(
  scope: Scope,
  assessmentId: string,
  assignmentId: string,
): Promise<AttemptAnswers | null> {
  const row = await prisma.recruiterAssessmentAssignment.findFirst({
    where: {
      id: assignmentId,
      assessmentId,
      assessment: {
        organizationId: scope.organizationId,
        createdByUserId: scope.createdByUserId,
      },
    },
    select: {
      scorePercent: true,
      passed: true,
      assessment: {
        select: {
          passMarkPercent: true,
          questions: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              type: true,
              title: true,
              helpText: true,
              isRequired: true,
              points: true,
              maxWords: true,
              options: {
                orderBy: { position: "asc" },
                select: { id: true, body: true, isCorrect: true },
              },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          selectedOptionIds: true,
          text: true,
          fileUrl: true,
        },
      },
    },
  });
  if (!row) return null;

  const answerByQuestion = new Map(row.answers.map((a) => [a.questionId, a]));
  let earnedPoints = 0;
  let totalPoints = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let notAutoGradedCount = 0;
  let unansweredCount = 0;

  const questions = row.assessment.questions.map((q): AttemptAnswerQuestion => {
    const answer = answerByQuestion.get(q.id);
    const selected = new Set(answer?.selectedOptionIds ?? []);
    const outcome = gradeQuestion(
      {
        type: q.type,
        points: q.points,
        correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      },
      answer,
    );

    const text = q.type === "PARAGRAPH" ? (answer?.text ?? null) : null;
    const fileUrl = q.type === "FILE_UPLOAD" ? (answer?.fileUrl ?? null) : null;
    const answered =
      q.type === "MULTIPLE_CHOICE"
        ? selected.size > 0
        : q.type === "PARAGRAPH"
          ? (text?.trim().length ?? 0) > 0
          : (fileUrl?.trim().length ?? 0) > 0;

    if (outcome.kind === "NOT_AUTO_GRADED") {
      notAutoGradedCount++;
    } else {
      totalPoints += outcome.points;
      if (outcome.kind === "CORRECT") {
        earnedPoints += outcome.points;
        correctCount++;
      } else if (outcome.kind === "INCORRECT") {
        incorrectCount++;
      }
    }
    if (!answered) unansweredCount++;

    return {
      questionId: q.id,
      number: q.position + 1,
      type: q.type,
      title: q.title,
      helpText: q.helpText,
      isRequired: q.isRequired,
      points: q.points,
      earnedPoints: outcome.kind === "CORRECT" ? outcome.points : 0,
      outcome: outcome.kind,
      answered,
      options: q.options.map((o) => ({
        id: o.id,
        body: o.body,
        isCorrect: o.isCorrect,
        selected: selected.has(o.id),
      })),
      text,
      wordCount: text != null && text.length > 0 ? countWords(text) : null,
      maxWords: q.type === "PARAGRAPH" ? (q.maxWords ?? MAX_PARAGRAPH_WORDS) : null,
      fileUrl,
    };
  });

  return {
    scorePercent: row.scorePercent,
    passed: row.passed,
    passMarkPercent: row.assessment.passMarkPercent,
    earnedPoints,
    totalPoints,
    correctCount,
    incorrectCount,
    notAutoGradedCount,
    unansweredCount,
    questions,
  };
}
