import { requireProgramMember } from "@/lib/program-auth";
import { getMemberDashboard } from "@/features/program/dashboard";
import {
  getCommitHeatmap,
  getMemberAtRiskStatus,
} from "@/features/program/commits";
import { getMemberProjectsSummary } from "@/features/program/projects";
import { getMemberRecommendation } from "@/features/program/recommendations";
import { getInterviewDashboardCard } from "@/features/program/interview";
import { ProgramDashboardView } from "@/components/program/program-dashboard-view";

export default async function ProgramDashboardPage() {
  const { member, cohort } = await requireProgramMember();
  const [data, heatmap, atRisk, projects, aiRec, interviewCard] =
    await Promise.all([
      getMemberDashboard(member.id, cohort.id),
      getCommitHeatmap(member.id, cohort),
      getMemberAtRiskStatus(member.id, cohort.id),
      getMemberProjectsSummary(member.id),
      getMemberRecommendation(member.id),
      getInterviewDashboardCard(member.id),
    ]);

  if (!data) {
    return (
      <p className="text-sm text-[#9CA3AF]">Dashboard unavailable.</p>
    );
  }

  return (
    <ProgramDashboardView
      data={data}
      heatmap={heatmap}
      atRisk={atRisk}
      projects={projects}
      aiRec={aiRec}
      interviewCard={interviewCard}
    />
  );
}
