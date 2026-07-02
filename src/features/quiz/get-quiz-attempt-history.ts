import type { Domain } from "@prisma/client";
import { prisma } from "@/lib/db";

export type QuizHistoryRow = {
  attemptId: string;
  quizId: string;
  weekNumber: number;
  score: number;
  title: string;
};

export async function getQuizAttemptHistory(
  userId: string,
  enrollment: { challengeId: string; domain: Domain },
): Promise<QuizHistoryRow[]> {
  const attempts = await prisma.quizAttempt.findMany({
    where: {
      userId,
      quiz: {
        challengeId: enrollment.challengeId,
        domain: enrollment.domain,
      },
    },
    select: {
      id: true,
      score: true,
      quiz: { select: { id: true, weekNumber: true, title: true } },
    },
    orderBy: { attemptedAt: "desc" },
  });

  return attempts.map((a) => ({
    attemptId: a.id,
    quizId: a.quiz.id,
    weekNumber: a.quiz.weekNumber,
    score: a.score,
    title: a.quiz.title,
  }));
}
