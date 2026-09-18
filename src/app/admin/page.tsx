import Link from "next/link";
import {
  Activity,
  Award,
  Briefcase,
  Coins,
  FileSignature,
  Flame,
  Mail,
  Send,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { ActivityTimeline } from "@/components/admin/activity-timeline";
import { PlatformActivityKpis } from "@/components/admin/platform-activity-kpis";
import { getOverviewStats } from "@/features/admin/get-overview-stats";
import { cn } from "@/lib/utils";

function greetingIst(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function usdFromMinor(minor: number): string {
  return (minor / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function ActivityBars({
  candidates,
  recruiters,
}: {
  candidates: number[];
  recruiters: number[];
}) {
  const last = candidates.slice(-7);
  const lastR = recruiters.slice(-7);
  const max = Math.max(1, ...last, ...lastR);
  return (
    <div className="flex h-48 items-end gap-3">
      {last.map((value, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col justify-end gap-1">
          <div
            className="w-full rounded-t bg-[#03535F]"
            style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
            title={`${value} candidates`}
          />
          <div
            className="w-full rounded-t bg-[#18D39B]"
            style={{ height: `${Math.max(6, ((lastR[i] ?? 0) / max) * 80)}%` }}
            title={`${lastR[i] ?? 0} recruiters`}
          />
        </div>
      ))}
    </div>
  );
}

export default async function AdminHomePage() {
  const [admin, data] = await Promise.all([requireAdmin(), getOverviewStats()]);
  const firstName = (admin.name ?? "there").trim().split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`${greetingIst()}, ${firstName}`}
        description="Here's what's happening on ABTalks today."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Candidates"
          value={data.stats.totalStudents}
          delta={data.stats.totalStudentsDelta}
          accent="green"
          icon={<Users className="h-4 w-4" />}
          series={data.stats.totalStudentsSeries}
        />
        <StatCard
          label="Total Recruiters"
          value={data.stats.totalRecruiters}
          delta={data.stats.totalRecruitersDelta}
          accent="blue"
          icon={<UserPlus className="h-4 w-4" />}
          series={data.stats.totalRecruitersSeries}
        />
        <StatCard
          label="Credits Used"
          value={usdFromMinor(data.stats.creditsUsedMinor)}
          delta={Math.round(data.stats.creditsUsedDeltaMinor / 100)}
          deltaSuffix="USD this week"
          accent="orange"
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Emails Sent"
          value={data.stats.emailsSent}
          delta={data.stats.emailsSentThisWeek}
          deltaSuffix="this week"
          accent="green"
          icon={<Mail className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-[#E9E9E9] bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#353535]">
              Platform Activity
            </h2>
            <p className="text-xs text-[#8F8F8F]">
              Live counts · deltas are this week vs last week (IST)
            </p>
          </div>
          <PlatformActivityKpis
            tiles={[
              {
                label: "Active today",
                value: data.stats.activeToday,
                hint: "Candidates who submitted today (IST)",
                icon: <Flame className="size-3.5" aria-hidden />,
              },
              {
                label: "Day 30 reached",
                value: data.stats.day30Reached,
                hint: "Half-way milestone",
                icon: <Target className="size-3.5" aria-hidden />,
              },
              {
                label: "Day 60 reached",
                value: data.stats.day60Reached,
                hint: "Full completion",
                icon: <Award className="size-3.5" aria-hidden />,
              },
              {
                label: "Applications",
                value: data.stats.applicationsTotal,
                delta: data.stats.applicationsDelta,
                hint: `${data.stats.applicationsThisWeek.toLocaleString()} this week`,
                icon: <FileSignature className="size-3.5" aria-hidden />,
              },
              {
                label: "Published jobs",
                value: data.stats.jobsPublished,
                hint: "Currently open",
                icon: <Briefcase className="size-3.5" aria-hidden />,
              },
              {
                label: "Assessments done",
                value: data.stats.assessmentsCompletedTotal,
                delta: data.stats.assessmentsCompletedDelta,
                hint: `${data.stats.assessmentsCompletedThisWeek.toLocaleString()} this week`,
                icon: <Sparkles className="size-3.5" aria-hidden />,
              },
              {
                label: "Contact unlocks",
                value: data.stats.contactUnlocksThisWeek,
                delta: data.stats.contactUnlocksDelta,
                hint: "This week only",
                icon: <Users className="size-3.5" aria-hidden />,
              },
              {
                label: "Active talent projects",
                value: data.stats.talentProjectsActive,
                hint: `${data.stats.talentProjectsThisWeek.toLocaleString()} started this week`,
                icon: <Activity className="size-3.5" aria-hidden />,
              },
            ]}
          />
          <div className="mt-5 border-t border-[#E9E9E9] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#787878]">
              Last 7 days · teal candidates, green recruiters
            </p>
            <ActivityBars
              candidates={data.stats.totalStudentsSeries}
              recruiters={data.stats.totalRecruitersSeries}
            />
          </div>
        </section>

        <section className="rounded-xl border border-[#E9E9E9] bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#353535]">
              Recent Platform Events
            </h2>
            <Link href="/admin/actions" className="text-xs font-medium text-[#03535F] hover:underline">
              View all
            </Link>
          </div>
          <ActivityTimeline items={data.recentAdminActions} />
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-[#E9E9E9] bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#353535]">
              Flagged for Review
              {data.flagged.length > 0 ? (
                <span className="ml-2 rounded-full bg-[#D92D20]/10 px-2 py-0.5 text-xs font-medium text-[#D92D20]">
                  {data.flagged.length}
                </span>
              ) : null}
            </h2>
          </div>
          {data.flagged.length === 0 ? (
            <p className="text-sm text-[#787878]">Nothing flagged right now.</p>
          ) : (
            <ul className="divide-y divide-[#E9E9E9]">
              {data.flagged.map((row) => (
                <li key={row.id} className="py-3">
                  <Link href={row.href} className="block hover:underline">
                    <p className="text-sm font-medium text-[#353535]">{row.title}</p>
                    <p className="text-xs text-[#787878]">
                      {row.detail}
                      {row.when ? ` · ${row.when}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-[#E9E9E9] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 font-display text-lg font-semibold text-[#353535]">
            Quick Actions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                href: "/admin/students",
                label: "View Candidates",
                hint: "Search and inspect profiles",
                icon: Users,
              },
              {
                href: "/admin/recruiters",
                label: "View Recruiters",
                hint: "Accounts and freeze controls",
                icon: UserPlus,
              },
              {
                href: "/admin/credits",
                label: "Credits & Plans",
                hint: "Starting grant and unlock cost",
                icon: Coins,
              },
              {
                href: "/admin/deliveries",
                label: "Failed Email",
                hint: `${data.stats.emailsFailedThisWeek} failed this week`,
                icon: Send,
              },
              {
                href: "/admin/jobs",
                label: "Jobs",
                hint: "Postings and applications",
                icon: Briefcase,
              },
              {
                href: "/admin/notifications",
                label: "Communications",
                hint: "In-app announcements",
                icon: Mail,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-[#E9E9E9] p-3 hover:border-[#03535F]/40 hover:bg-[#EEF6F6]",
                )}
              >
                <item.icon className="mt-0.5 size-4 text-[#03535F]" aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-[#353535]">
                    {item.label}
                  </span>
                  <span className="block text-xs text-[#787878]">{item.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
