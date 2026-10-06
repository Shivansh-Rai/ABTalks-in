import type { Domain } from "@prisma/client";
import { EnrollmentStatus } from "@prisma/client";
import {
  challengeLifecycle,
  type HubEnrollmentLifecycle,
} from "@/features/dashboard/get-hub-data";
import { listChallengeEnrollments } from "@/repositories/learning";

export interface UserEnrollmentSummary {
  id: string;
  domain: Domain;
  challengeTitle: string;
  daysCompleted: number;
  currentStreak: number;
  lifecycle: HubEnrollmentLifecycle;
}

export async function getUserActiveEnrollments(
  userId: string,
): Promise<UserEnrollmentSummary[]> {
  const enrollments = await listChallengeEnrollments(userId);
  return enrollments
    .filter((e) => e.status === EnrollmentStatus.ACTIVE || e.status === EnrollmentStatus.COMPLETED)
    .map((e) => {
      const lifecycle = challengeLifecycle({
        daysCompleted: e.daysCompleted,
        totalDays: e.totalDays,
        startedAt: e.startedAt,
        challengeStartsAt: e.challengeStartsAt,
      });
      return {
        id: e.id,
        domain: e.domain,
        challengeTitle: e.challengeTitle,
        daysCompleted: e.daysCompleted,
        currentStreak: e.currentStreak,
        lifecycle,
      };
    })
    .filter((e) => e.lifecycle === "active");
}

/** All non-abandoned challenge enrollments with lifecycle for explore / badges. */
export async function getUserChallengeEnrollments(
  userId: string,
): Promise<UserEnrollmentSummary[]> {
  const enrollments = await listChallengeEnrollments(userId);
  return enrollments
    .filter((e) => e.status !== EnrollmentStatus.ABANDONED)
    .map((e) => ({
      id: e.id,
      domain: e.domain,
      challengeTitle: e.challengeTitle,
      daysCompleted: e.daysCompleted,
      currentStreak: e.currentStreak,
      lifecycle: challengeLifecycle({
        daysCompleted: e.daysCompleted,
        totalDays: e.totalDays,
        startedAt: e.startedAt,
        challengeStartsAt: e.challengeStartsAt,
      }),
    }));
}
