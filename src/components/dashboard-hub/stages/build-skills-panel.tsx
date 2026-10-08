import type { Domain } from "@prisma/client";
import { BarChart3, Code2, Network, Sparkles } from "lucide-react";
import { isClaudeEnabled, isProgramEnabled } from "@/lib/feature-flags";
import { PROGRAM_AI_COHORT_BASE } from "@/features/program/constants";
import type { HubEnrollment } from "@/features/dashboard/get-hub-data";
import type { ActivityStreak } from "@/features/dashboard/compute-activity-streak";
import type { ActivityHeatmap as HeatmapData } from "@/features/dashboard/get-activity-heatmap";
import { ContinueLearning, ProgressCard } from "./build-progress";
import { Library, type LibraryArt, type LibraryItem } from "./library";
import { TrackCards } from "./track-cards";
import {
  ArrowLink,
  StageHeader,
} from "./stage-ui";

const TRACKS: {
  domain: Domain;
  name: string;
  blurb: string;
  path: string;
  Icon: typeof Code2;
}[] = [
  { domain: "SE", name: "Software Engineering", blurb: "Ship real software, one task a day", path: "/se", Icon: Code2 },
  { domain: "AI", name: "AI", blurb: "Build with models, agents and data", path: "/ai", Icon: Network },
  { domain: "DS", name: "Data Science", blurb: "Raw data into real insight", path: "/ds", Icon: BarChart3 },
  { domain: "CLAUDE", name: "Claude", blurb: "Master Claude AI in 60 days", path: "/claude", Icon: Sparkles },
];


type BuildSkillsPanelProps = {
  /** Primary track page (or /challenges) — Continue / Start again target. */
  trackHref: string;
  enrollments: HubEnrollment[];
  joinedDomains: Domain[];
  abandonedDomains: Domain[];
  streak: ActivityStreak;
  heatmap: HeatmapData;
  todayKey: string;
  hasProgramMembership: boolean;
  showDatabricks: boolean;
  showDsArchitect: boolean;
  showPowerBi: boolean;
  showSnowflake: boolean;
  showDatabricksAi: boolean;
};


export function BuildSkillsPanel(props: BuildSkillsPanelProps) {
  const { enrollments, streak } = props;
  // Prefer a track that is still submittable. DB status ACTIVE alone is not
  // enough — lifecycle "ended" means the window closed with misses left.
  const primary =
    enrollments.find((e) => e.lifecycle === "active") ??
    enrollments[0] ??
    null;

  return (
    <div className="space-y-6">
      <StageHeader
        title={primary ? "Learn by" : "Learn by doing."}
        accent={primary ? "doing." : "Start your first track."}
        sub="One task a day for 60 days, shared on GitHub and LinkedIn. Every square you fill is proof of work."
        aside={primary ? <ArrowLink href="#test-skills">Next: Test skills</ArrowLink> : undefined}
        wide={!primary}
      />

      {primary ? (
        <>
          <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
            <ContinueLearning enrollments={enrollments} />
            <ProgressCard heatmap={props.heatmap} streak={streak} />
          </div>
        </>
      ) : (
        <TrackCards abandoned={props.abandonedDomains} />
      )}

      <MoreWays {...props} />
    </div>
  );
}

/* ─── More ways to build skills (events + programs) ────────── */

function cohortItems(p: BuildSkillsPanelProps): LibraryItem[] {
  const list: LibraryItem[] = [];
  const cohort = (x: Omit<LibraryItem, "kicker" | "daysLabel" | "cta"> & { cta?: string }): LibraryItem => ({
    kicker: "Cohort",
    daysLabel: "Cohort",
    cta: "View details",
    ...x,
  });
  if (p.showSnowflake) list.push(cohort({ key: "snowflake", title: "Snowflake Data & AI", blurb: "Build a governed Data + AI lakehouse on Snowflake in 15 days.", href: "/program/snowflake", art: "snowflake", days: 15, modules: 6 }));
  // One Databricks tile; when the 31-day Lakehouse program is also open it
  // carries a "2 options available" badge and clicking it lets the learner
  // pick between the two instead of going straight to the 15-day one.
  if (p.showDatabricksAi) {
    list.push(cohort({
      key: "databricks-ai",
      title: "Databricks Data & AI",
      blurb: "Build a governed Data + AI lakehouse on Databricks in 15 days.",
      href: "/program/databricks-ai",
      art: "databricks",
      days: 15,
      modules: 9,
      badge: p.showDatabricks ? "2 options available" : undefined,
      options: p.showDatabricks
        ? [
            { label: "15 Days Databricks", href: "/program/databricks-ai" },
            { label: "31 Days Databricks", href: "/program/databricks" },
          ]
        : undefined,
    }));
  }
  if (isProgramEnabled()) {
    list.push(cohort({
      key: "ai-cohort",
      title: "AI Cohort",
      blurb: "Build and deploy a production-grade enterprise AI chatbot in 31 days.",
      href: p.hasProgramMembership ? `${PROGRAM_AI_COHORT_BASE}/dashboard` : `${PROGRAM_AI_COHORT_BASE}/apply`,
      cta: p.hasProgramMembership ? "Continue" : "View details",
      art: "cohort",
      days: 31,
      modules: null,
    }));
  }
  if (p.showDsArchitect) list.push(cohort({ key: "ds-architect", title: "Data Solutions Architect", blurb: "Design AWS-first data and AI platforms in 10 days.", href: "/program/ds-architect", art: "cohort", days: 10, modules: null }));
  if (p.showPowerBi) list.push(cohort({ key: "powerbi", title: "Power BI & Analytics", blurb: "Ship recruiter-grade Power BI dashboards in 7 days.", href: "/program/powerbi", art: "ds", days: 7, modules: null }));
  return list;
}

function challengeItems(p: BuildSkillsPanelProps): LibraryItem[] {
  const joined = new Set(p.joinedDomains);
  const byDomain = new Map(p.enrollments.map((e) => [e.domain, e]));
  const art: Record<Domain, LibraryArt> = { AI: "ai", SE: "se", DS: "ds", CLAUDE: "claude" };
  const tracks = TRACKS.filter((t) => t.domain !== "CLAUDE" || isClaudeEnabled()).map((t): LibraryItem => {
    const enrollment = byDomain.get(t.domain);
    const cta =
      enrollment?.lifecycle === "active"
        ? "Continue"
        : joined.has(t.domain)
          ? "View"
          : "View details";
    return {
      key: t.domain,
      kicker: "Challenge",
      title: t.name === "AI" ? "Artificial Intelligence" : t.name,
      blurb: t.blurb,
      href: joined.has(t.domain) ? t.path : `/register?domain=${t.domain}`,
      cta,
      art: art[t.domain],
      days: 60,
      daysLabel: "Challenge",
      modules: null,
    };
  });
  return tracks;
}


function MoreWays(props: BuildSkillsPanelProps) {
  return <Library cohorts={cohortItems(props)} challenges={challengeItems(props)} />;
}


