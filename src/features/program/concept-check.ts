import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isCohortFrozen } from "@/features/program/progression";
import { recomputeMemberScore } from "@/features/program/missions";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";

export type ConceptQuestion = {
  id: string;
  question: string;
  options: string[];
};

export type ConceptCheckActive = {
  attemptId: string;
  questions: ConceptQuestion[];
};

export type ConceptSubmitOk = {
  score: number;
  pointsAwarded: number;
  review: {
    question: string;
    options: string[];
    selectedIndex: number | null;
    correctIndex: number;
    explanation: string;
    correct: boolean;
  }[];
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

async function isDayUnlocked(memberId: string, dayNumber: number): Promise<boolean> {
  if (isDayLockBypassEnabled()) return true;
  const member = await prisma.programMember.findUnique({
    where: { id: memberId },
    select: { highestUnlockedDay: true },
  });
  return (member?.highestUnlockedDay ?? 0) >= dayNumber;
}

export async function startConceptCheck(
  memberId: string,
  dayNumber: number,
): Promise<ConceptCheckActive | { ok: false; message: string }> {
  const member = await prisma.programMember.findUnique({
    where: { id: memberId },
    select: { cohort: { select: { endsAt: true } } },
  });
  if (!member) return { ok: false, message: "Member not found." };
  if (isCohortFrozen(member.cohort)) {
    return { ok: false, message: "This cohort has ended." };
  }

  if (!(await isDayUnlocked(memberId, dayNumber))) {
    return { ok: false, message: "This day is not unlocked yet." };
  }

  const existing = await prisma.programConceptAttempt.findUnique({
    where: { memberId_dayNumber: { memberId, dayNumber } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "You already completed the concept check for this day." };
  }

  const day = await prisma.programDay.findUnique({
    where: { dayNumber },
    select: {
      id: true,
      conceptQuestions: {
        select: {
          id: true,
          question: true,
          options: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!day || day.conceptQuestions.length < 3) {
    return { ok: false, message: "Concept questions are not available for this day." };
  }

  const sampled = shuffle(day.conceptQuestions).slice(0, 3);
  const attempt = await prisma.programConceptAttempt.create({
    data: {
      memberId,
      dayNumber,
      questionIds: sampled.map((q) => q.id),
    },
    select: { id: true },
  });

  return {
    attemptId: attempt.id,
    questions: sampled.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    })),
  };
}

export async function submitConceptCheck(
  memberId: string,
  attemptId: string,
  answers: (number | null)[],
): Promise<ConceptSubmitOk | { ok: false; message: string }> {
  const attempt = await prisma.programConceptAttempt.findUnique({
    where: { id: attemptId },
    select: {
      memberId: true,
      dayNumber: true,
      questionIds: true,
      answers: true,
      member: { select: { cohort: { select: { endsAt: true } } } },
    },
  });

  if (!attempt || attempt.memberId !== memberId) {
    return { ok: false, message: "Attempt not found." };
  }
  if (attempt.answers !== null) {
    return { ok: false, message: "This concept check was already submitted." };
  }
  if (isCohortFrozen(attempt.member.cohort)) {
    return { ok: false, message: "This cohort has ended." };
  }

  const questionIds = attempt.questionIds as string[];
  if (answers.length !== questionIds.length) {
    return { ok: false, message: "Invalid number of answers." };
  }

  const questions = await prisma.programConceptQuestion.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      question: true,
      options: true,
      correctIndex: true,
      explanation: true,
    },
  });

  const byId = new Map(questions.map((q) => [q.id, q]));
  let score = 0;
  const review: ConceptSubmitOk["review"] = [];

  for (let i = 0; i < questionIds.length; i++) {
    const q = byId.get(questionIds[i]!);
    if (!q) continue;
    const selected = answers[i] ?? null;
    const correct = selected === q.correctIndex;
    if (correct) score += 1;
    review.push({
      question: q.question,
      options: q.options,
      selectedIndex: selected,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      correct,
    });
  }

  const pointsAwarded = score;

  await prisma.$transaction(async (tx) => {
    await tx.programConceptAttempt.update({
      where: { id: attemptId },
      data: {
        answers: answers as Prisma.InputJsonValue,
        score,
      },
    });
    await tx.programMember.update({
      where: { id: memberId },
      data: { conceptPoints: { increment: pointsAwarded } },
    });
    await recomputeMemberScore(tx, memberId);
  });

  return { score, pointsAwarded, review };
}

export async function getConceptCheckStatus(
  memberId: string,
  dayNumber: number,
): Promise<
  | { status: "none" }
  | { status: "completed"; score: number; pointsAwarded: number }
> {
  const attempt = await prisma.programConceptAttempt.findUnique({
    where: { memberId_dayNumber: { memberId, dayNumber } },
    select: { score: true, answers: true },
  });
  if (!attempt || attempt.answers === null) return { status: "none" };
  return {
    status: "completed",
    score: attempt.score,
    pointsAwarded: attempt.score,
  };
}
