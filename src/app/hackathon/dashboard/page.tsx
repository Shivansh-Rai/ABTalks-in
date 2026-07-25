import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { EventInfo } from "@/components/hackathon/dashboard/event-info";
import { InvitePanel } from "@/components/hackathon/dashboard/invite-panel";
import { MissionTimer } from "@/components/hackathon/dashboard/mission-timer";
import { ProblemStatementPanel } from "@/components/hackathon/dashboard/problem-statement-panel";
import { SubmissionChecklist } from "@/components/hackathon/dashboard/submission-checklist";
import { TeamRoster } from "@/components/hackathon/dashboard/team-roster";
import { getHackathonEvent } from "@/features/hackathon/get-hackathon-event";
import { getMyRegistration } from "@/features/hackathon/get-my-registration";

export const metadata: Metadata = {
  title: "Your Dashboard | ABTalks Vibe Code Hackathon",
};

export default async function HackathonDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?from=/hackathon/dashboard");
  }

  const reg = await getMyRegistration(session.user.id);
  if (!reg) {
    redirect("/hackathon/register");
  }

  const { problemStatement } = await getHackathonEvent();
  const firstName = reg.me.fullName.split(" ")[0] ?? reg.me.fullName;
  const entryChip =
    reg.team.entryType === "SOLO" ? "SOLO" : (reg.team.name ?? "TEAM");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 pb-28 md:pb-10">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Welcome, {firstName}
        </h1>
        <span className="rounded-md border border-[#7364E6]/40 bg-[#7364E6]/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#C4B5FD]">
          {entryChip}
        </span>
      </header>

      <div className="space-y-6">
        <MissionTimer
          kickoffUtc={HACKATHON.kickoffUtc}
          deadlineUtc={HACKATHON.deadlineUtc}
          resultsLabel={HACKATHON.resultsLabel}
        />
        <ProblemStatementPanel
          kickoffUtc={HACKATHON.kickoffUtc}
          statement={problemStatement}
        />
        <TeamRoster
          entryType={reg.team.entryType}
          teamName={reg.team.name}
          members={reg.members}
        />
        {reg.team.entryType === "TEAM" && reg.spotsLeft > 0 ? (
          <InvitePanel teamCode={reg.team.code} spotsLeft={reg.spotsLeft} />
        ) : null}
        <SubmissionChecklist />
        <EventInfo />
      </div>
    </div>
  );
}
