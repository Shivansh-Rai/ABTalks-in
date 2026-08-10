import Link from "next/link";
import { SubmissionsFilters } from "@/components/admin/submissions-filters";
import { MissingByDayView } from "@/components/admin/missing-by-day-view";
import { SubmissionsTable } from "@/components/admin/submissions-table";
import { HackathonSubmissionsFilters } from "@/components/admin/hackathon-submissions-filters";
import { HackathonSubmissionsTable } from "@/components/admin/hackathon-submissions-table";
import { cn } from "@/lib/utils";
import { getSubmissionsFeed } from "@/features/admin/get-submissions-feed";
import {
  getHackathonProblemFilterOptions,
  getHackathonSubmissionsFeed,
} from "@/features/admin/get-hackathon-submissions-feed";
import {
  getMissingByDayCounts,
  getMissingStudentsForDay,
} from "@/features/admin/get-missing-by-day";
import type { Domain } from "@prisma/client";

type Tab = "feed" | "missing" | "hackathon";

function tabPillClass(active: boolean): string {
  return cn(
    "flex-1 rounded-md px-3 py-1.5 text-center transition-colors",
    active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
  );
}

function resolveTab(raw: string | undefined): Tab {
  if (raw === "missing") return "missing";
  if (raw === "hackathon") return "hackathon";
  return "feed";
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    day?: string;
    domain?: string;
    status?: "ALL" | "ON_TIME" | "LATE";
    minDay?: string;
    maxDay?: string;
    problem?: string;
  }>;
}) {
  const sp = await searchParams;
  const tab = resolveTab(sp.tab);
  const day = Number(sp.day ?? "") || undefined;
  const domainParam = (sp.domain ?? "ALL") as Domain | "ALL";
  const status = sp.status ?? "ALL";
  const minDay = Number(sp.minDay ?? "") || 1;
  const maxDay = Number(sp.maxDay ?? "") || 60;
  const problemId = sp.problem && sp.problem !== "ALL" ? sp.problem : undefined;

  function hrefForTab(nextTab: Tab) {
    const params = new URLSearchParams();
    if (nextTab === "feed") {
      if (sp.domain && sp.domain !== "ALL") params.set("domain", sp.domain);
      if (sp.status && sp.status !== "ALL") params.set("status", sp.status);
      if (sp.minDay) params.set("minDay", sp.minDay);
      if (sp.maxDay) params.set("maxDay", sp.maxDay);
      params.set("tab", "feed");
    } else if (nextTab === "missing") {
      if (sp.domain && sp.domain !== "ALL") params.set("domain", sp.domain);
      if (sp.status && sp.status !== "ALL") params.set("status", sp.status);
      params.set("tab", "missing");
    } else {
      params.set("tab", "hackathon");
      if (sp.problem && sp.problem !== "ALL") params.set("problem", sp.problem);
    }
    const qs = params.toString();
    return qs ? `/admin/submissions?${qs}` : "/admin/submissions";
  }

  const subtitle =
    tab === "feed"
      ? "Most recent 100 submissions matching filters"
      : tab === "missing"
        ? "Per-day completion across enrolled students"
        : "Hackathon team entries";

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Submissions Feed</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <nav className="flex gap-1 rounded-lg border bg-card p-1 text-sm">
        <Link href={hrefForTab("feed")} className={tabPillClass(tab === "feed")}>
          Feed
        </Link>
        <Link href={hrefForTab("missing")} className={tabPillClass(tab === "missing")}>
          Missing by Day
        </Link>
        <Link
          href={hrefForTab("hackathon")}
          className={tabPillClass(tab === "hackathon")}
        >
          Hackathon
        </Link>
      </nav>

      {tab === "hackathon" ? (
        <HackathonContent problemId={problemId} />
      ) : (
        <>
          <SubmissionsFilters />

          {tab === "feed" ? (
            <FeedContent
              domain={sp.domain ?? "ALL"}
              status={status}
              minDay={minDay}
              maxDay={maxDay}
            />
          ) : day != null && day >= 1 && day <= 60 ? (
            <MissingByDayView
              mode="drilldown"
              day={day}
              students={await getMissingStudentsForDay(day, { domain: domainParam })}
            />
          ) : (
            <MissingByDayView
              mode="summary"
              summary={await getMissingByDayCounts({ domain: domainParam })}
            />
          )}
        </>
      )}
    </div>
  );
}

async function FeedContent({
  domain,
  status,
  minDay,
  maxDay,
}: {
  domain: string;
  status: "ALL" | "ON_TIME" | "LATE";
  minDay: number;
  maxDay: number;
}) {
  const rows = await getSubmissionsFeed({
    domain,
    status,
    minDay,
    maxDay,
  });

  const tableRows = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    studentName: row.studentName,
    domain: row.domain,
    dayNumber: row.dayNumber,
    status: row.status,
    githubUrl: row.githubUrl,
    linkedinUrl: row.linkedinUrl,
    submittedAt: row.submittedAt.toISOString(),
  }));

  return <SubmissionsTable rows={tableRows} />;
}

async function HackathonContent({ problemId }: { problemId?: string }) {
  const [problems, rows] = await Promise.all([
    getHackathonProblemFilterOptions(),
    getHackathonSubmissionsFeed({ problemId }),
  ]);

  const tableRows = rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    teamCode: row.teamCode,
    teamLabel: row.teamLabel,
    entryType: row.entryType,
    leaderUserId: row.leaderUserId,
    leaderName: row.leaderName,
    memberCount: row.memberCount,
    problemTitle: row.problemTitle,
    repoUrl: row.repoUrl,
    liveUrl: row.liveUrl,
    aiLogUrl: row.aiLogUrl,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <>
      <HackathonSubmissionsFilters problems={problems} />
      <HackathonSubmissionsTable rows={tableRows} />
    </>
  );
}
