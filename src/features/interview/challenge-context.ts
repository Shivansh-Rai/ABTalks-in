import "server-only";
import { prisma } from "@/lib/db";
import { MAX_CHALLENGE_TASKS_IN_CONTEXT } from "@/features/interview/constants";
import type {
  ChallengeContext,
  CompletedChallengeTask,
} from "@/features/interview/types";
import {
  listChallengeSubmissions,
  overlayChallengeProgressFields,
} from "@/repositories/progress";

/**
 * Ranks a completed task by how much interview signal it carries. Proof-of-work
 * links mean the candidate can be asked about something a reviewer could verify,
 * so those rank highest.
 */
function taskSignalScore(task: CompletedChallengeTask): number {
  let score = 0;
  if (task.hasGithubProof) score += 3;
  if (task.hasLinkedinProof) score += 1;
  if (task.difficulty.toLowerCase() === "hard") score += 2;
  else if (task.difficulty.toLowerCase() === "medium") score += 1;
  if (task.learningObjectives.length > 0) score += 1;
  if (task.tags.length > 0) score += 1;
  return score;
}

/**
 * Spreads picks across enrollments and across the timeline so a multi-challenge
 * candidate isn't interviewed entirely on one track's early days.
 */
function selectTasksForContext(
  tasks: CompletedChallengeTask[],
  limit: number,
): CompletedChallengeTask[] {
  const byEnrollment = new Map<string, CompletedChallengeTask[]>();
  for (const task of tasks) {
    const bucket = byEnrollment.get(task.enrollmentId);
    if (bucket) bucket.push(task);
    else byEnrollment.set(task.enrollmentId, [task]);
  }

  for (const bucket of byEnrollment.values()) {
    bucket.sort((a, b) => {
      const diff = taskSignalScore(b) - taskSignalScore(a);
      return diff !== 0 ? diff : b.dayNumber - a.dayNumber;
    });
  }

  const selected: CompletedChallengeTask[] = [];
  const buckets = [...byEnrollment.values()];
  let round = 0;
  while (selected.length < limit) {
    let tookAny = false;
    for (const bucket of buckets) {
      const task = bucket[round];
      if (!task) continue;
      selected.push(task);
      tookAny = true;
      if (selected.length >= limit) break;
    }
    if (!tookAny) break;
    round++;
  }

  return selected.sort((a, b) => a.dayNumber - b.dayNumber);
}

/**
 * Builds verified challenge context for a candidate.
 *
 * A day is assessable only when a canonical challenge ActivityAttempt exists
 * for it — there is no partial-completion state. A student 30 days into a
 * 60-day challenge therefore yields exactly 30 eligible tasks, and unsubmitted
 * days are never visible to the question planner. Frozen leftover Submission
 * rows must not resurrect a rejected/reset day.
 */
export async function buildChallengeContext(
  userId: string,
): Promise<ChallengeContext> {
  const enrollmentSelect = {
        id: true,
        challengeId: true,
        domain: true,
        status: true,
        daysCompleted: true,
        currentStreak: true,
        longestStreak: true,
        lastSubmittedDay: true,
        challenge: { select: { title: true, totalDays: true } },
      } as const;
  const enrollmentsRaw = await prisma.enrollment.findMany({
    where: { userId },
    select: enrollmentSelect,
  });
  const enrollments = await overlayChallengeProgressFields(enrollmentsRaw);
  const submissionLists = await Promise.all(
    enrollments.map(async (enrollment) => ({
      enrollmentId: enrollment.id,
      challengeId: enrollment.challengeId,
      rows: await listChallengeSubmissions(enrollment.id),
    })),
  );
  const dailyTasks = await prisma.dailyTask.findMany({
    where: { challengeId: { in: enrollments.map((e) => e.challengeId) } },
    select: {
      id: true,
      challengeId: true,
      dayNumber: true,
      title: true,
      problemStatement: true,
      learningObjectives: true,
      tags: true,
      difficulty: true,
    },
  });
  const taskByKey = new Map(
    dailyTasks.map((t) => [`${t.challengeId}:${t.dayNumber}`, t]),
  );

  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));

  const tasks: CompletedChallengeTask[] = [];
  for (const list of submissionLists) {
    const enrollment = enrollmentById.get(list.enrollmentId);
    for (const s of list.rows) {
      const dailyTask = taskByKey.get(`${list.challengeId}:${s.dayNumber}`);
      if (!dailyTask) continue;
      tasks.push({
        submissionId: s.id,
        enrollmentId: list.enrollmentId,
        challengeId: dailyTask.challengeId,
        domain: enrollment?.domain ?? "",
        challengeTitle: enrollment?.challenge.title ?? "",
        dayNumber: s.dayNumber,
        dailyTaskId: dailyTask.id,
        title: dailyTask.title,
        problemStatement: dailyTask.problemStatement,
        learningObjectives: dailyTask.learningObjectives,
        tags: dailyTask.tags,
        difficulty: dailyTask.difficulty,
        hasGithubProof: Boolean(s.githubUrl),
        hasLinkedinProof: Boolean(s.linkedinUrl),
        submittedAt: s.submittedAt,
      });
    }
  }
  tasks.sort((a, b) => a.dayNumber - b.dayNumber);

  const completedPerEnrollment = new Map<string, number>();
  for (const task of tasks) {
    completedPerEnrollment.set(
      task.enrollmentId,
      (completedPerEnrollment.get(task.enrollmentId) ?? 0) + 1,
    );
  }

  return {
    enrollments: enrollments.map((e) => ({
      enrollmentId: e.id,
      challengeId: e.challengeId,
      domain: e.domain,
      title: e.challenge.title,
      status: e.status,
      totalDays: e.challenge.totalDays,
      completedDays: completedPerEnrollment.get(e.id) ?? 0,
      currentStreak: e.currentStreak,
      longestStreak: e.longestStreak,
    })),
    tasks: selectTasksForContext(tasks, MAX_CHALLENGE_TASKS_IN_CONTEXT),
    totalCompletedDays: tasks.length,
    completedSubmissionIds: tasks.map((t) => t.submissionId),
  };
}
