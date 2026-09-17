import "server-only";

import { prisma } from "@/lib/db";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { countPipelineAtStage } from "@/repositories/talent-pipeline";

export type RecruiterAnalyticsMetrics = {
  activeJobs: number;
  activeProjects: number;
  candidatesDiscovered: number;
  candidatesViewed: number;
  candidatesShortlisted: number;
  candidatesContacted: number;
  applications: number;
  testsAssigned: number;
  testsCompleted: number;
};

export type RecruiterProjectMetric = {
  id: string;
  name: string;
  matched: number;
  viewed: number;
  shortlisted: number;
  updatedAt: string;
};

export type RecruiterAnalyticsData = {
  companyName: string;
  overview: RecruiterAnalyticsMetrics;
  recentProjects: RecruiterProjectMetric[];
};

export async function getRecruiterAnalytics(): Promise<
  { ok: true; data: RecruiterAnalyticsData } | { ok: false; message: string }
> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) {
    return { ok: false, message: workspace.message };
  }

  const { userId, organizationId, company } = workspace.data;

  try {
    const [
      activeJobs,
      activeProjects,
      projects,
      matches,
      applications,
      testsAssigned,
      testsCompleted,
      outreachCount,
      pipelineContactedCount,
    ] = await Promise.all([
      // 1. Active Jobs
      prisma.job.count({
        where: {
          recruiterId: userId,
          status: "PUBLISHED",
        },
      }),

      // 2. Active Projects
      prisma.talentRequest.count({
        where: {
          recruiterUserId: userId,
          archivedAt: null,
        },
      }),

      // Projects breakdown for project-level numbers
      prisma.talentRequest.findMany({
        where: {
          recruiterUserId: userId,
          archivedAt: null,
        },
        select: {
          id: true,
          name: true,
          title: true,
          updatedAt: true,
          matches: {
            select: {
              candidateUserId: true,
              viewedAt: true,
              decision: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),

      // Total matches across all recruiter's projects
      prisma.talentRequestMatch.findMany({
        where: {
          request: {
            recruiterUserId: userId,
          },
        },
        select: {
          candidateUserId: true,
          viewedAt: true,
          decision: true,
        },
      }),

      // Job applications for recruiter's jobs
      prisma.jobApplication.count({
        where: {
          job: {
            recruiterId: userId,
          },
        },
      }),

      // Tests assigned
      prisma.recruiterAssessmentAssignment.count({
        where: {
          assessment: {
            organizationId,
          },
        },
      }),

      // Tests completed (submitted)
      prisma.recruiterAssessmentAssignment.count({
        where: {
          assessment: {
            organizationId,
          },
          status: "SUBMITTED",
        },
      }),

      // Contacted via outreach message
      prisma.outreachMessage.count({
        where: {
          thread: {
            recruiterUserId: userId,
          },
        },
      }),

      // Contacted via hiring pipeline. Goes through the T-240 repository
      // rather than `prisma.talentListItem` directly: that table has exactly
      // one permitted accessor and `talent-pipeline.test.ts` fails the build
      // if anything else reads it. Same predicate, same number.
      countPipelineAtStage(
        {
          userId,
          recruiterProfileId: workspace.data.recruiterProfileId,
          organizationId,
        },
        "CONTACTED",
      ),
    ]);

    // Candidates discovered (unique candidates matched across all projects)
    const uniqueDiscovered = new Set(matches.map((m) => m.candidateUserId));
    const uniqueViewed = new Set(
      matches.filter((m) => m.viewedAt !== null).map((m) => m.candidateUserId),
    );
    const uniqueShortlisted = new Set(
      matches.filter((m) => m.decision === "SHORTLISTED").map((m) => m.candidateUserId),
    );

    const candidatesContacted = Math.max(outreachCount, pipelineContactedCount);

    const recentProjects: RecruiterProjectMetric[] = projects.map((p) => {
      const pMatches = p.matches;
      const pViewed = pMatches.filter((m) => m.viewedAt !== null).length;
      const pShortlisted = pMatches.filter((m) => m.decision === "SHORTLISTED").length;
      return {
        id: p.id,
        name: p.name?.trim() || p.title.trim() || "Untitled Project",
        matched: pMatches.length,
        viewed: pViewed,
        shortlisted: pShortlisted,
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    return {
      ok: true,
      data: {
        companyName: company || "Your Company",
        overview: {
          activeJobs,
          activeProjects,
          candidatesDiscovered: uniqueDiscovered.size,
          candidatesViewed: uniqueViewed.size,
          candidatesShortlisted: uniqueShortlisted.size,
          candidatesContacted,
          applications,
          testsAssigned,
          testsCompleted,
        },
        recentProjects,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load analytics",
    };
  }
}
