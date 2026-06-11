import { EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  parseEducation,
  parseProjects,
  type Education,
  type Project,
} from "@/lib/validations/recruiter";

export type RecruiterProfileView = {
  fullName: string;
  userType: "STUDENT" | "PROFESSIONAL";
  domain: string;
  college: string | null;
  graduationYear: number | null;
  organization: string | null;
  role: string | null;
  yearsExperience: number | null;
  skills: string[];
  daysCompleted: number;
  totalDays: number;
  currentStreak: number;
  longestStreak: number;
  isReadyForInterview: boolean;
  synergyPoints: number;
  ratings: {
    confidence: number | null;
    coding: number | null;
    communication: number | null;
  };
  headline: string | null;
  summary: string | null;
  strengths: string[];
  recommendedRoles: string[];
  projects: Project[];
  education: Education[];
  achievements: string[];
  certifications: string[];
};

export async function getRecruiterProfileByToken(
  token: string,
): Promise<RecruiterProfileView | null> {
  const review = await prisma.recruiterReview.findUnique({
    where: { shareToken: token },
    select: {
      isPublished: true,
      confidenceRating: true,
      codingRating: true,
      communicationRating: true,
      headline: true,
      summary: true,
      strengths: true,
      recommendedRoles: true,
      projects: true,
      education: true,
      achievements: true,
      certifications: true,
      user: {
        select: {
          studentProfile: {
            select: {
              fullName: true,
              userType: true,
              domain: true,
              college: true,
              graduationYear: true,
              organization: true,
              role: true,
              yearsExperience: true,
              skills: true,
              synergyPoints: true,
              isReadyForInterview: true,
            },
          },
          enrollments: {
            where: { status: { not: EnrollmentStatus.ABANDONED } },
            orderBy: { startedAt: "asc" },
            select: {
              domain: true,
              status: true,
              daysCompleted: true,
              currentStreak: true,
              longestStreak: true,
              challenge: { select: { totalDays: true } },
            },
          },
        },
      },
    },
  });

  if (!review || !review.isPublished || !review.user.studentProfile) return null;
  const p = review.user.studentProfile;
  const enr =
    review.user.enrollments.find(
      (e) => e.domain === p.domain && e.status === "ACTIVE",
    ) ??
    review.user.enrollments.find((e) => e.domain === p.domain) ??
    review.user.enrollments[0] ??
    null;

  return {
    fullName: p.fullName,
    userType: p.userType,
    domain: p.domain,
    college: p.college,
    graduationYear: p.graduationYear,
    organization: p.organization,
    role: p.role,
    yearsExperience: p.yearsExperience,
    skills: p.skills,
    daysCompleted: enr?.daysCompleted ?? 0,
    totalDays: enr?.challenge.totalDays ?? 60,
    currentStreak: enr?.currentStreak ?? 0,
    longestStreak: enr?.longestStreak ?? 0,
    isReadyForInterview: p.isReadyForInterview,
    synergyPoints: p.synergyPoints,
    ratings: {
      confidence: review.confidenceRating,
      coding: review.codingRating,
      communication: review.communicationRating,
    },
    headline: review.headline,
    summary: review.summary,
    strengths: review.strengths,
    recommendedRoles: review.recommendedRoles,
    projects: parseProjects(review.projects),
    education: parseEducation(review.education),
    achievements: review.achievements,
    certifications: review.certifications,
  };
}
