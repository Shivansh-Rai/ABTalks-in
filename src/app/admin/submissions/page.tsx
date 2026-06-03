import Link from "next/link";
import { SubmissionsFilters } from "@/components/admin/submissions-filters";
import { MissingByDayView } from "@/components/admin/missing-by-day-view";
import { SubmissionsTable } from "@/components/admin/submissions-table";
import { cn } from "@/lib/utils";
import { getSubmissionsFeed } from "@/features/admin/get-submissions-feed";
import {
  getMissingByDayCounts,
  getMissingStudentsForDay,
} from "@/features/admin/get-missing-by-day";
import type { Domain } from "@prisma/client";

type Tab = "feed" | "missing";

function tabPillClass(active: boolean): string {
  return cn(
    "flex-1 rounded-md px-3 py-1.5 text-center transition-colors",
    active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
  );
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
  }>;
}) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === "missing" ? "missing" : "feed";
  const day = Number(sp.day ?? "") || undefined;
  const domainParam = (sp.domain ?? "ALL") as Domain | "ALL";
  const status = sp.status ?? "ALL";
  const minDay = Number(sp.minDay ?? "") || 1;
  const maxDay = Number(sp.maxDay ?? "") || 60;

  function hrefForTab(nextTab: Tab) {
    const params = new URLSearchParams();
    if (sp.domain && sp.domain !== "ALL") params.set("domain", sp.domain);
    if (sp.status && sp.status !== "ALL") params.set("status", sp.status);
    if (nextTab === "feed") {
      if (sp.minDay) params.set("minDay", sp.minDay);
      if (sp.maxDay) params.set("maxDay", sp.maxDay);
      params.set("tab", "feed");
    } else {
      params.set("tab", "missing");
    }
    const qs = params.toString();
    return qs ? `/admin/submissions?${qs}` : "/admin/submissions";
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Submissions Feed</h1>
        <p className="text-sm text-muted-foreground">
          {tab === "feed"
            ? "Most recent 100 submissions matching filters"
            : "Per-day completion across enrolled students"}
        </p>
      </div>

      <nav className="flex gap-1 rounded-lg border bg-card p-1 text-sm">
        <Link href={hrefForTab("feed")} className={tabPillClass(tab === "feed")}>
          Feed
        </Link>
        <Link href={hrefForTab("missing")} className={tabPillClass(tab === "missing")}>
          Missing by Day
        </Link>
      </nav>

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
