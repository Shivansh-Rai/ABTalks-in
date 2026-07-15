import Link from "next/link";
import { AlertTriangle, Award, Flame, GitCommit, Mic, Target, Trophy } from "lucide-react";
import { requireProgramMember } from "@/lib/program-auth";
import {
  PROGRAM_MAX_COMMIT_POINTS,
  PROGRAM_MAX_CONCEPT_POINTS,
  PROGRAM_MAX_MISSION_POINTS,
  PROGRAM_MAX_PROJECT_POINTS,
  PROGRAM_MAX_TOTAL_POINTS,
  PROGRAM_TOTAL_DAYS,
} from "@/features/program/constants";
import { getMemberDashboard } from "@/features/program/dashboard";
import {
  getCommitHeatmap,
  getMemberAtRiskStatus,
} from "@/features/program/commits";
import { getMemberProjectsSummary } from "@/features/program/projects";
import { getMemberRecommendation } from "@/features/program/recommendations";
import { getInterviewDashboardCard } from "@/features/program/interview";
import { CommitHeatmap } from "@/components/program/commit-heatmap";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AT_RISK_LABEL: Record<string, string> = {
  behind_pace: "Behind cohort pace",
  stuck_mission: "Stuck on current mission",
  no_commits: "No commits in last 5 days",
};

export default async function ProgramDashboardPage() {
  const { member, cohort } = await requireProgramMember();
  const [data, heatmap, atRisk, projects, aiRec, interviewCard] = await Promise.all([
    getMemberDashboard(member.id, cohort.id),
    getCommitHeatmap(member.id, cohort),
    getMemberAtRiskStatus(member.id, cohort.id),
    getMemberProjectsSummary(member.id),
    getMemberRecommendation(member.id),
    getInterviewDashboardCard(member.id),
  ]);

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">Dashboard unavailable.</p>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Mission control
        </h1>
        <p className="text-sm text-muted-foreground">
          Day {data.memberDay}/{PROGRAM_TOTAL_DAYS}
          {data.behindBy > 0 ? ` · ${data.behindBy} behind cohort pace` : ""}
        </p>
        {atRisk.atRisk && (
          <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              At risk:{" "}
              {atRisk.reasons.map((r) => AT_RISK_LABEL[r] ?? r).join(" · ")}
            </span>
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<Trophy className="size-4 text-amber-500" />}
          label="Total score"
          value={String(data.totalScore)}
        />
        <StatCard
          icon={<Award className="size-4 text-primary" />}
          label="Rank"
          value={data.rank ? `#${data.rank}` : "—"}
        />
        <StatCard
          icon={<GitCommit className="size-4 text-emerald-500" />}
          label="Commit pts"
          value={`${data.scoreBreakdown.commitPoints}/${PROGRAM_MAX_COMMIT_POINTS}`}
        />
        <StatCard
          icon={<Target className="size-4 text-sky-500" />}
          label="Cohort day"
          value={`${data.cohortDay}/${PROGRAM_TOTAL_DAYS}`}
        />
        <StatCard
          icon={<Flame className="size-4 text-orange-500" />}
          label="Clean passes"
          value={String(data.cleanPassCount)}
        />
      </div>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Commit activity</h2>
        <p className="text-xs text-muted-foreground">
          One commit in your program repo earns 5 pts for that IST day (max{" "}
          {PROGRAM_MAX_COMMIT_POINTS}).
        </p>
        <CommitHeatmap cells={heatmap} />
      </section>

      <section className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Mic
              className={cn(
                "mt-0.5 size-5 shrink-0",
                interviewCard.state === "ready"
                  ? "text-primary"
                  : interviewCard.state === "completed"
                    ? "text-emerald-500"
                    : "text-muted-foreground",
              )}
            />
            <div>
              <h2 className="text-sm font-semibold">Exit voice interview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {interviewCard.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Scored separately — not part of your leaderboard total.
              </p>
            </div>
          </div>
          {interviewCard.state !== "locked" && interviewCard.state !== "exhausted" && (
            <Link
              href="/program/interview"
              className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
            >
              {interviewCard.state === "completed" ? "View results" : "Open"}
            </Link>
          )}
        </div>
      </section>

      {aiRec.recommendation && (
        <section className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h2 className="text-sm font-semibold">Your AI mentor note</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {aiRec.recommendation}
          </p>
          {aiRec.generatedAt && (
            <p className="text-xs text-muted-foreground">
              Updated{" "}
              {new Date(aiRec.generatedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </section>
      )}

      {projects.length > 0 && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Boss Build projects</h2>
          <ul className="space-y-3">
            {projects.map((p) => {
              const score = p.adminScore ?? p.aiScore;
              return (
                <li key={p.moduleNumber} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Module {p.moduleNumber}</span>
                    {p.status === "GRADED" && score !== null ? (
                      <span className="font-display font-bold">{score}/100</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Awaiting grading
                      </span>
                    )}
                  </div>
                  {p.aiFeedback && (
                    <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                      {p.aiFeedback}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Score breakdown</h2>
        <ScoreBar
          label="Missions"
          value={data.scoreBreakdown.missionPoints}
          max={PROGRAM_MAX_MISSION_POINTS}
        />
        <ScoreBar
          label="Concept checks"
          value={data.scoreBreakdown.conceptPoints}
          max={PROGRAM_MAX_CONCEPT_POINTS}
        />
        <ScoreBar
          label="Commits"
          value={data.scoreBreakdown.commitPoints}
          max={PROGRAM_MAX_COMMIT_POINTS}
        />
        <ScoreBar
          label="Projects"
          value={data.scoreBreakdown.projectPoints}
          max={PROGRAM_MAX_PROJECT_POINTS}
        />
        <p className="text-xs text-muted-foreground">
          Max {PROGRAM_MAX_TOTAL_POINTS} pts across all components
        </p>
      </section>

      {data.currentDay && (
        <section className="rounded-xl border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Today&apos;s mission
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: data.currentDay.moduleColor }}
            />
            <span className="font-medium">
              Day {data.currentDay.dayNumber}: {data.currentDay.title}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {data.currentDay.missionType.replace("_", " ")}
            </span>
          </div>
          <Link
            href={`/program/day/${data.currentDay.dayNumber}`}
            className={cn(buttonVariants({ size: "sm" }), "mt-3 inline-flex")}
          >
            Open mission
          </Link>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Module progress</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.moduleProgress.map((mod) => (
            <div key={mod.number} className="rounded-xl border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: mod.color }}
                />
                {mod.title}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {mod.passed}/{mod.total} missions passed
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${mod.total ? (mod.passed / mod.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.recentVerdicts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recent runs</h2>
          <ul className="space-y-2 text-sm">
            {data.recentVerdicts.map((v, i) => (
              <li key={i} className="rounded-lg border px-3 py-2">
                <span className="font-medium">Day {v.dayNumber}</span>{" "}
                <span
                  className={
                    v.passed ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {v.passed ? "passed" : "failed"}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {v.checks.filter((c) => c.passed).length}/{v.checks.length}{" "}
                  checks
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary"
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
