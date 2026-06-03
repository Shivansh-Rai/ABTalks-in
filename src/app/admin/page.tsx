import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOverviewStats } from "@/features/admin/get-overview-stats";

function domainBadgeClass(domain: string): string {
  if (domain === "AI") return "border-domains-ai/50 bg-domains-ai-bg text-domains-ai";
  if (domain === "DS") return "border-domains-ds/50 bg-domains-ds-bg text-domains-ds";
  return "border-domains-se/50 bg-domains-se-bg text-domains-se";
}

export default async function AdminHomePage() {
  const data = await getOverviewStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Admin Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daily quick check for platform health.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-bold">{data.stats.totalStudents}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Active Today</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-bold">{data.stats.activeToday}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Day 7 Reached</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-bold">{data.stats.day7Reached}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Day 30 Reached</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-bold">{data.stats.day30Reached}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Live Submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.liveSubmissions.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-md border p-2 text-sm"
              >
                <Link href={`/admin/students/${row.userId}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    Day {row.dayNumber} · {row.submittedAtRelative}
                  </p>
                </Link>
                <Badge variant="outline" className={domainBadgeClass(row.domain)}>
                  {row.domain}
                </Badge>
                <a
                  href={row.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline"
                >
                  LinkedIn
                </a>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Admin Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentAdminActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin actions yet</p>
            ) : (
              data.recentAdminActions.map((row) => (
                <div key={row.id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">
                    {row.adminName} · {row.actionLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Target:{" "}
                    <Link href={`/admin/students/${row.targetUserId}`} className="underline">
                      {row.targetName}
                    </Link>{" "}
                    · {row.createdAtRelative}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
