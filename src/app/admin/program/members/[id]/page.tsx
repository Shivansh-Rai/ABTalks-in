import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMemberAdminDetail } from "@/features/program/admin";
import { ProgramMemberActionPanel } from "@/components/program/program-member-action-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export default async function AdminProgramMemberDetailPage({ params }: Props) {
  const { id } = await params;
  const member = await getMemberAdminDetail(id);
  if (!member) notFound();

  return (
    <div className="space-y-8">
      <Link
        href="/admin/program/members"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
      >
        <ArrowLeft className="size-4" />
        Members
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold">{member.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {member.jobRole} · {member.company} · {member.status}
        </p>
        <ProgramMemberActionPanel
          memberId={member.id}
          memberName={member.fullName}
          status={member.status}
          skipTokensUsed={member.skipTokensUsed}
        />
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="Profile">
          <p>Email: {member.user.email}</p>
          <p>Phone: {member.phone ?? "—"}</p>
          <p>GitHub: {member.githubRepoUrl}</p>
          <p>LinkedIn: {member.linkedinUrl ?? "—"}</p>
          <p>Skills: {member.skills.join(", ") || "—"}</p>
        </InfoCard>
        <InfoCard title="Scores">
          <p>Total: {member.totalScore}</p>
          <p>
            Missions {member.missionPoints} · Concepts {member.conceptPoints} ·
            Commits {member.commitPoints} · Projects {member.projectPoints}
          </p>
          <p>Day unlocked: {member.highestUnlockedDay}</p>
          <p>Clean passes: {member.cleanPassCount}</p>
          <p>Skip tokens used: {member.skipTokensUsed}</p>
        </InfoCard>
      </section>

      {member.aiRecommendation && (
        <InfoCard title="AI recommendation">
          <p className="text-sm text-muted-foreground">{member.aiRecommendation}</p>
        </InfoCard>
      )}

      <InfoCard title={`Mission runs (${member.missionSubmissions.length})`}>
        <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
          {member.missionSubmissions.map((s, i) => (
            <li key={i}>
              Day {s.dayNumber} attempt {s.attemptNumber}:{" "}
              {s.passed ? "passed" : "failed"} (+{s.pointsAwarded})
            </li>
          ))}
        </ul>
      </InfoCard>

      <InfoCard title="Concept checks">
        <ul className="space-y-1 text-sm">
          {member.conceptAttempts.map((c) => (
            <li key={c.dayNumber}>
              Day {c.dayNumber}: {c.answers === null ? "in progress" : `${c.score}/3`}
            </li>
          ))}
        </ul>
      </InfoCard>

      <InfoCard title="Commits">
        <p className="text-sm">{member.commitDays.length} qualifying IST days</p>
      </InfoCard>

      <InfoCard title="Arena completions">
        <ul className="space-y-1 text-sm">
          {member.exerciseCompletions.map((e, i) => (
            <li key={i}>
              {e.exercise.title} ({e.exercise.slug})
            </li>
          ))}
        </ul>
      </InfoCard>

      <InfoCard title="Projects">
        <ul className="space-y-2 text-sm">
          {member.projects.map((p) => (
            <li key={p.moduleNumber}>
              Module {p.moduleNumber}: {p.status}{" "}
              {p.adminScore ?? p.aiScore
                ? `· ${p.adminScore ?? p.aiScore}/100`
                : ""}
            </li>
          ))}
        </ul>
      </InfoCard>

      {member.interview && (
        <InfoCard title="Interview">
          <p>Status: {member.interview.status}</p>
          {member.interview.overallScore !== null && (
            <p>
              Overall {member.interview.overallScore}/100 (C
              {member.interview.commScore} T{member.interview.techScore} P
              {member.interview.problemScore})
            </p>
          )}
          {member.interview.summary && (
            <p className="text-muted-foreground">{member.interview.summary}</p>
          )}
        </InfoCard>
      )}
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}
