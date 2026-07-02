import type { Domain } from "@prisma/client";
import { EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type QuizAvailabilityReason =
  | "none_available"
  | "already_attempted"
  | "ready"
  | "not_yet_unlocked";

export type AvailableQuizCard = {
  id: string;
  weekNumber: number;
  title: string;
  domain: Domain;
};

export type AvailableQuizAttempt = {
  score: number;
  quiz: { id: string; weekNumber: number; title: string };
};

/** Banner target: highest unlocked week with a seeded quiz and no attempt yet. */
export type AvailableQuizBanner = {
  quizId: string;
  weekNumber: number;
  title: string;
  questionCount: number;
};

export type AvailableQuizPayload = {
  quiz: AvailableQuizCard | null;
  reason: QuizAvailabilityReason;
  attempt: AvailableQuizAttempt | null;
  /** Highest unlocked week with a quiz and no attempt (drives the QuizUnlockBanner). */
  banner: AvailableQuizBanner | null;
};

const MAX_QUIZ_WEEK = 8;

type ResolvedQuizEnrollment = {
  challengeId: string;
  domain: Domain;
  daysCompleted: number;
  status: EnrollmentStatus;
};

/**
 * Single set-based resolution shared by the quiz card and the unlock banner.
 * One `quiz.findMany` (≤8 rows) + one `quizAttempt.findMany` replace the prior
 * per-week N+1 loop. The **card** offers only the current week (W =
 * floor(daysCompleted / 7), capped at 8, once ≥7 days are completed); the
 * **banner** offers the highest unlocked week with a quiz and no attempt.
 */
export async function getAvailableQuiz(
  userId: string,
  enrollment: ResolvedQuizEnrollment,
): Promise<AvailableQuizPayload> {
  const { challengeId, domain, daysCompleted, status } = enrollment;

  if (status === EnrollmentStatus.ABANDONED) {
    return { quiz: null, reason: "none_available", attempt: null, banner: null };
  }

  const [quizzes, attempts] = await Promise.all([
    prisma.quiz.findMany({
      where: { challengeId, domain },
      orderBy: { weekNumber: "asc" },
      select: {
        id: true,
        weekNumber: true,
        title: true,
        domain: true,
        _count: { select: { quizQuestions: true } },
      },
    }),
    prisma.quizAttempt.findMany({
      where: { userId, quiz: { challengeId, domain } },
      select: {
        score: true,
        quizId: true,
        quiz: { select: { id: true, weekNumber: true, title: true } },
      },
    }),
  ]);

  const quizByWeek = new Map(quizzes.map((q) => [q.weekNumber, q]));
  const attemptByQuizId = new Map(attempts.map((a) => [a.quizId, a]));

  // Banner: highest unlocked week (≤ min(floor(daysCompleted/7), 8)) with a quiz and no attempt.
  let banner: AvailableQuizBanner | null = null;
  const unlockedWeek = Math.floor(daysCompleted / 7);
  if (unlockedWeek >= 1) {
    const maxWeek = Math.min(unlockedWeek, MAX_QUIZ_WEEK);
    for (let weekNumber = maxWeek; weekNumber >= 1; weekNumber--) {
      const quiz = quizByWeek.get(weekNumber);
      if (!quiz) continue;
      if (attemptByQuizId.has(quiz.id)) continue;
      banner = {
        quizId: quiz.id,
        weekNumber: quiz.weekNumber,
        title: quiz.title,
        questionCount: quiz._count.quizQuestions,
      };
      break;
    }
  }

  // Card: only the current week's quiz.
  if (daysCompleted < 7) {
    return { quiz: null, reason: "not_yet_unlocked", attempt: null, banner };
  }

  const currentWeek = Math.min(Math.floor(daysCompleted / 7), MAX_QUIZ_WEEK);
  const currentQuiz = quizByWeek.get(currentWeek);

  if (!currentQuiz) {
    return { quiz: null, reason: "none_available", attempt: null, banner };
  }

  const currentAttempt = attemptByQuizId.get(currentQuiz.id);
  if (currentAttempt) {
    return {
      quiz: null,
      reason: "already_attempted",
      attempt: {
        score: currentAttempt.score,
        quiz: {
          id: currentAttempt.quiz.id,
          weekNumber: currentAttempt.quiz.weekNumber,
          title: currentAttempt.quiz.title,
        },
      },
      banner,
    };
  }

  return {
    quiz: {
      id: currentQuiz.id,
      weekNumber: currentQuiz.weekNumber,
      title: currentQuiz.title,
      domain: currentQuiz.domain,
    },
    reason: "ready",
    attempt: null,
    banner,
  };
}
