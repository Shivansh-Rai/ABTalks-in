import type { StudentProfile, UserType } from "@prisma/client";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { prisma } from "@/lib/db";
import { getBalance } from "@/repositories/points";
import { getCandidateProfile, canonicalFullNameByUserId } from "@/repositories/candidate";
import { getAmbassadorState } from "@/repositories/ambassador";
import {
  listChallengeSubmissions,
  listQuizAttemptsForUser,
} from "@/repositories/progress";

export type ChallengeStudentDetail = {
  kind: "challenge";
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    joinedAt: Date;
    synergyPoints: number;
    disabledAt: Date | null;
    disabledReason: string | null;
    deletedAt: Date | null;
    sessionInvalidatedAt: Date | null;
    anonymizedAt: Date | null;
  };
  profile: StudentProfile;
  enrollment: {
    domain: string;
    status: string;
    daysCompleted: number;
    currentStreak: number;
    longestStreak: number;
    lastSubmittedDay: number | null;
    challenge: { totalDays: number };
  } | null;
  student: {
    userId: string;
    fullName: string;
    isReadyForInterview: boolean;
    enrollmentStatus: string | null;
  };
  progress: {
    totalDays: number;
    daysCompleted: number;
    currentStreak: number;
    longestStreak: number;
    lastSubmittedDay: number | null;
    onTimeCount: number;
    lateCount: number;
  };
  submissions: Array<{
    id: string;
    dayNumber: number;
    status: string;
    githubUrl: string | null;
    linkedinUrl: string | null;
    submittedAt: Date;
  }>;
  quizAttempts: Array<{
    id: string;
    weekNumber: number;
    quizTitle: string;
    score: number;
    attemptedAt: Date;
  }>;
  adminActions: Array<{
    id: string;
    actionType: string;
    metadata: unknown;
    reason: string | null;
    createdAt: Date;
    adminName: string;
  }>;
  remarks: Array<{
    id: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    adminName: string;
  }>;
};

export type HackathonStudentDetail = {
  kind: "hackathon";
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    joinedAt: Date;
    synergyPoints: number;
    disabledAt: Date | null;
    disabledReason: string | null;
    deletedAt: Date | null;
    sessionInvalidatedAt: Date | null;
    anonymizedAt: Date | null;
  };
  hackathon: {
    fullName: string;
    email: string;
    phone: string;
    college: string;
    graduationYear: number;
    entryType: "SOLO" | "TEAM";
    teamName: string | null;
    teamCode: string;
    createdAt: Date;
  };
};

export type StudentDetail = ChallengeStudentDetail | HackathonStudentDetail;

export async function getStudentDetail(
  userId: string,
): Promise<StudentDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      deletedAt: true,
      disabledAt: true,
      disabledReason: true,
      sessionInvalidatedAt: true,
      anonymizedAt: true,
      studentProfile: true,
      enrollments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          domain: true,
          status: true,
          daysCompleted: true,
          currentStreak: true,
          longestStreak: true,
          lastSubmittedDay: true,
          challenge: { select: { totalDays: true } },
        },
      },
      hackathonParticipants: {
        where: { eventId: HACKATHON.eventId },
        take: 1,
        select: {
          fullName: true,
          email: true,
          phone: true,
          college: true,
          graduationYear: true,
          createdAt: true,
          team: {
            select: {
              entryType: true,
              teamName: true,
              teamCode: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const synergyPoints = await getBalance(user.id);
  const [candidate, ambassador] = await Promise.all([
    getCandidateProfile(user.id),
    getAmbassadorState(user.id),
  ]);

  if (!user.studentProfile && !candidate) {
    const participant = user.hackathonParticipants[0];
    if (!participant) {
      return null;
    }

    const entryType = participant.team.entryType === "SOLO" ? "SOLO" : "TEAM";

    return {
      kind: "hackathon",
      user: {
        id: user.id,
        name: participant.fullName.trim() || user.email,
        email: user.email,
        image: user.image,
        joinedAt: participant.createdAt,
        synergyPoints,
        disabledAt: user.disabledAt,
        disabledReason: user.disabledReason,
        deletedAt: user.deletedAt,
        sessionInvalidatedAt: user.sessionInvalidatedAt,
        anonymizedAt: user.anonymizedAt,
      },
      hackathon: {
        fullName: participant.fullName,
        email: participant.email,
        phone: participant.phone,
        college: participant.college,
        graduationYear: participant.graduationYear,
        entryType,
        teamName: entryType === "SOLO" ? null : participant.team.teamName,
        teamCode: participant.team.teamCode,
        createdAt: participant.createdAt,
      },
    };
  }

  const quizzes = await prisma.quiz.findMany({
    select: { id: true, weekNumber: true, title: true },
  });
  const quizById = new Map(quizzes.map((q) => [q.id, q]));
  const enrollmentId = user.enrollments[0]?.id;
  const [submissions, quizAttemptRows, adminActions, remarks] = await Promise.all([
    enrollmentId ? listChallengeSubmissions(enrollmentId) : Promise.resolve([]),
    listQuizAttemptsForUser(
      userId,
      quizzes.map((q) => q.id),
    ),
    prisma.adminAction.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.adminRemark.findMany({
      where: { studentUserId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        admin: {
          select: {
            id: true,
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  const enrollment = user.enrollments[0] ?? null;
  const onTimeCount = submissions.filter(
    (s) => s.status === "ON_TIME" || s.status === "LATE",
  ).length;
  const lateCount = 0;

  const adminNameIds = [
    ...adminActions.map((action) => action.admin?.id),
    ...remarks.map((r) => r.admin.id),
  ].filter((id): id is string => Boolean(id));
  const adminNames = await canonicalFullNameByUserId(adminNameIds);

  const sp = user.studentProfile;
  const profile = candidate
    ? {
        id: sp?.id ?? `sp_missing_${user.id}`,
        userId: user.id,
        fullName: candidate.fullName,
        userType: candidate.userType as UserType,
        college: candidate.college,
        collegeId: candidate.collegeId,
        graduationYear: candidate.graduationYear,
        organization: candidate.organization,
        role: candidate.role,
        yearsExperience: candidate.yearsExperience,
        domain: sp?.domain ?? null,
        skills: candidate.skills,
        resumeUrl: candidate.resumeUrl,
        phone: candidate.phone,
        phoneVerified: candidate.phoneVerified,
        phoneVerifiedAt: candidate.phoneVerifiedAt ?? sp?.phoneVerifiedAt ?? null,
        linkedinUrl: candidate.linkedinUrl,
        githubUsername: candidate.githubUsername,
        referralCode: candidate.referralCode,
        isReadyForInterview: candidate.isReadyForInterview,
        isCampusAmbassadorCandidate: ambassador.isCandidate,
        ambassadorAppliedAt: ambassador.appliedAt,
        ambassadorDismissedAt: ambassador.dismissedAt,
        synergyPoints: sp?.synergyPoints ?? 0,
        createdAt: sp?.createdAt ?? user.createdAt,
        updatedAt: sp?.updatedAt ?? user.createdAt,
      }
    : {
        ...sp!,
        isCampusAmbassadorCandidate: ambassador.isCandidate,
        ambassadorAppliedAt: ambassador.appliedAt,
        ambassadorDismissedAt: ambassador.dismissedAt,
      };

  return {
    kind: "challenge",
    user: {
      id: user.id,
      name: profile.fullName,
      email: user.email,
      image: user.image,
      joinedAt: user.createdAt,
      synergyPoints,
      disabledAt: user.disabledAt,
      disabledReason: user.disabledReason,
      deletedAt: user.deletedAt,
      sessionInvalidatedAt: user.sessionInvalidatedAt,
      anonymizedAt: user.anonymizedAt,
    },
    profile,
    enrollment,
    student: {
      userId: user.id,
      fullName: profile.fullName,
      isReadyForInterview: profile.isReadyForInterview,
      enrollmentStatus: enrollment?.status ?? null,
    },
    progress: {
      totalDays: enrollment?.challenge.totalDays ?? 60,
      daysCompleted: enrollment?.daysCompleted ?? 0,
      currentStreak: enrollment?.currentStreak ?? 0,
      longestStreak: enrollment?.longestStreak ?? 0,
      lastSubmittedDay: enrollment?.lastSubmittedDay ?? null,
      onTimeCount,
      lateCount,
    },
    submissions,
    quizAttempts: quizAttemptRows.map((attempt) => {
      const quiz = quizById.get(attempt.quizId);
      return {
        id: attempt.id,
        weekNumber: quiz?.weekNumber ?? 0,
        quizTitle: quiz?.title ?? "Quiz",
        score: attempt.score,
        attemptedAt: attempt.attemptedAt,
      };
    }),
    adminActions: adminActions.map((action) => ({
      id: action.id,
      actionType: action.actionType,
      metadata: action.metadata,
      reason: action.reason,
      createdAt: action.createdAt,
      adminName:
        (action.admin?.id ? adminNames.get(action.admin.id)?.trim() : undefined) ||
        action.admin?.studentProfile?.fullName?.trim() ||
        action.admin?.email ||
        "Admin",
    })),
    remarks: remarks.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      adminName:
        adminNames.get(r.admin.id)?.trim() ||
        r.admin.studentProfile?.fullName?.trim() ||
        r.admin.email ||
        "Admin",
    })),
  };
}
