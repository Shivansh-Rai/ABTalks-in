import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Award, Clock } from "lucide-react";
import type { ProgramMissionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProgramMember } from "@/lib/program-auth";
import { getDayShell } from "@/features/program/days";
import { getMissionState } from "@/features/program/missions";
import { getConceptCheckStatus } from "@/features/program/concept-check";
import { getMissionMentorFeedback } from "@/features/program/mentor";
import { PROGRAM_TOTAL_DAYS } from "@/features/program/constants";
import { LiteYoutube } from "@/components/program/lite-youtube";
import { MissionPanel } from "@/components/program/mission-panel";
import { ConceptCheckPanel } from "@/components/program/concept-check-panel";

type Props = { params: Promise<{ day: string }> };

const MISSION_LABEL: Record<ProgramMissionType, string> = {
  CODE_SPRINT: "Code Sprint",
  SHIP_IT: "Ship It",
  DATA_ROOM: "Data Room",
  PROMPT_FORGE: "Prompt Forge",
  BOSS_BUILD: "Boss Build",
};

export default async function ProgramDayPage({ params }: Props) {
  const { member } = await requireProgramMember();
  const { day: dayParam } = await params;
  const dayNumber = Number.parseInt(dayParam, 10);
  if (
    !Number.isFinite(dayNumber) ||
    dayNumber < 1 ||
    dayNumber > PROGRAM_TOTAL_DAYS
  ) {
    redirect("/program/curriculum");
  }

  const result = await getDayShell(member.id, dayNumber);
  if (!result || result.state === "LOCKED") {
    redirect("/program/curriculum");
  }

  const { day, state } = result;

  const [missionState, conceptStatus, memberProfile] = await Promise.all([
    getMissionState(member.id, dayNumber),
    getConceptCheckStatus(member.id, dayNumber),
    prisma.programMember.findUnique({
      where: { id: member.id },
      select: { githubRepoUrl: true },
    }),
  ]);

  if (!missionState || !memberProfile) redirect("/program/curriculum");

  const initialMentorFeedback =
    missionState.dayState === "PASSED"
      ? await getMissionMentorFeedback(member.id, dayNumber)
      : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: day.module.color }}
            aria-hidden
          />
          <span>
            Phase {day.module.number} · {day.module.title}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-sm font-bold uppercase tracking-wider text-primary">
            Day {day.dayNumber}
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {day.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {MISSION_LABEL[day.missionType]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs">
            <Award className="size-3" />
            {day.missionPoints} pts
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs">
            <Clock className="size-3" />
            {day.estimatedMin} min
          </span>
        </div>
      </header>

      <section className="space-y-2 text-sm [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3">
        <ReactMarkdown>{day.briefMd}</ReactMarkdown>
      </section>

      {(day.objectives.length > 0 || day.tools.length > 0) && (
        <section className="space-y-3">
          {day.objectives.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Objectives
              </h2>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {day.objectives.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">•</span>
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {day.tools.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {day.tools.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {day.videos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Watch
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {day.videos.map((video) => (
              <div key={video.id} className="space-y-1.5">
                <LiteYoutube youtubeId={video.youtubeId} title={video.title} />
                <p className="text-sm font-medium">{video.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mission
        </h2>
        <MissionPanel
          dayNumber={dayNumber}
          dayTitle={day.title}
          missionType={day.missionType}
          githubRepoUrl={memberProfile.githubRepoUrl}
          missionState={missionState}
          initialMentorFeedback={initialMentorFeedback}
        />
      </section>

      {(state === "AVAILABLE" ||
        state === "PASSED" ||
        state === "SKIPPED") && (
        <ConceptCheckPanel dayNumber={dayNumber} initialStatus={conceptStatus} />
      )}
    </div>
  );
}
