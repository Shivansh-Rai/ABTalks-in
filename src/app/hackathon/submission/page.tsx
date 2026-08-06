import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { MissionTimer } from "@/components/hackathon/dashboard/mission-timer";
import { BriefList } from "@/components/hackathon/submission/brief-list";
import { LockedState } from "@/components/hackathon/submission/locked-state";
import { SubmissionForm } from "@/components/hackathon/submission/submission-form";
import { buttonVariants } from "@/components/ui/button";
import { getHackathonProblems } from "@/features/hackathon/get-hackathon-problems";
import { getMyRegistration } from "@/features/hackathon/get-my-registration";
import { getTeamSubmission } from "@/features/hackathon/get-team-submission";
import { getSubmissionWindow } from "@/features/hackathon/submission-window";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Submit your build | ABTalks Vibe Code Hackathon",
};

export default async function HackathonSubmissionPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?from=/hackathon/submission");
  }

  const reg = await getMyRegistration(session.user.id);
  if (!reg) {
    redirect("/hackathon/register");
  }

  const window = getSubmissionWindow();
  const greetingName =
    reg.team.entryType === "TEAM" ? (reg.team.name ?? reg.me.fullName) : reg.me.fullName;
  const entryChip = reg.team.entryType === "SOLO" ? "SOLO" : (reg.team.name ?? "TEAM");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 pb-28 md:pb-10">
      {!window.unlocked ? (
        <LockedState />
      ) : (
        <SubmissionContent
          greetingName={greetingName}
          entryChip={entryChip}
          teamId={reg.team.id}
          editable={window.editable}
          closed={window.closed}
          previewing={window.previewing}
        />
      )}
    </div>
  );
}

async function SubmissionContent({
  greetingName,
  entryChip,
  teamId,
  editable,
  closed,
  previewing,
}: {
  greetingName: string;
  entryChip: string;
  teamId: string;
  editable: boolean;
  closed: boolean;
  previewing: boolean;
}) {
  const [briefs, submission] = await Promise.all([
    getHackathonProblems(),
    getTeamSubmission(teamId),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Hello {greetingName}
        </h1>
        <span className="rounded-md border border-[#7364E6]/40 bg-[#7364E6]/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#C4B5FD]">
          {entryChip}
        </span>
        {previewing ? (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Preview mode - locked for everyone else.
          </span>
        ) : null}
      </header>

      <MissionTimer
        kickoffUtc={HACKATHON.kickoffUtc}
        deadlineUtc={HACKATHON.deadlineUtc}
        resultsLabel={HACKATHON.resultsLabel}
      />

      <BriefList briefs={briefs} selectedId={submission?.problemId ?? null} />

      {briefs.length === 0 ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <p className="text-sm text-zinc-300">
            The briefs are being published, please check the WhatsApp group for updates.
          </p>
        </section>
      ) : (
        <SubmissionForm
          briefs={briefs.map(({ id, number, title }) => ({ id, number, title }))}
          initial={submission}
          editable={editable}
          closed={closed}
        />
      )}

      <Link
        href="/hackathon/dashboard"
        className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
      >
        Back to your dashboard
      </Link>
    </div>
  );
}
