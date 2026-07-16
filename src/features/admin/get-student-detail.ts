import { prisma } from "@/lib/db";

export async function getStudentDetail(userId: string) {
  const [user, submissions, quizAttempts, adminActions, remarks] =
    await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        enrollments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            domain: true,
            status: true,
            daysCompleted: true,
            currentStreak: true,
            longestStreak: true,
            lastSubmittedDay: true,
            challenge: { select: { totalDays: true } },
          },
        },
      },
    }),
    prisma.submission.findMany({
      where: { userId },
      orderBy: [{ dayNumber: "asc" }, { submittedAt: "desc" }],
      select: {
        id: true,
        dayNumber: true,
        status: true,
        githubUrl: true,
        linkedinUrl: true,
        submittedAt: true,
      },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { attemptedAt: "desc" },
      include: {
        quiz: { select: { weekNumber: true, title: true } },
      },
    }),
    prisma.adminAction.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        admin: {
          select: {
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
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  if (!user || !user.studentProfile) {
    return null;
  }

  const enrollment = user.enrollments[0] ?? null;
  const onTimeCount = submissions.filter(
    (s) => s.status === "ON_TIME" || s.status === "LATE",
  ).length;
  const lateCount = 0;

  return {
    user: {
      id: user.id,
      name: user.studentProfile.fullName,
      email: user.email,
      image: user.image,
      joinedAt: user.createdAt,
    },
    profile: user.studentProfile,
    enrollment,
    student: {
      userId: user.id,
      fullName: user.studentProfile.fullName,
      isReadyForInterview: user.studentProfile.isReadyForInterview,
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
    quizAttempts: quizAttempts.map((attempt) => ({
      id: attempt.id,
      weekNumber: attempt.quiz.weekNumber,
      quizTitle: attempt.quiz.title,
      score: attempt.score,
      attemptedAt: attempt.attemptedAt,
    })),
    adminActions: adminActions.map((action) => ({
      id: action.id,
      actionType: action.actionType,
      metadata: action.metadata,
      reason: action.reason,
      createdAt: action.createdAt,
      adminName:
        action.admin.studentProfile?.fullName?.trim() ||
        action.admin.email ||
        "Admin",
    })),
    remarks: remarks.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      adminName:
        r.admin.studentProfile?.fullName?.trim() || r.admin.email || "Admin",
    })),
  };
}
