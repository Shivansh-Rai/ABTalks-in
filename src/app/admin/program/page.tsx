import { formatInTimeZone } from "date-fns-tz";
import {
  getCohortOverview,
  resolveAdminProgramCohort,
} from "@/features/program/admin";
import { IST } from "@/lib/date-utils";
import { ProgramCohortPanel } from "@/components/program/program-cohort-panel";
import { ProgramAnalyticsCharts } from "@/components/program/program-analytics-charts";
import { ProgramExportButtons } from "@/components/program/program-export-buttons";

function toDatetimeLocal(d: Date) {
  return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm");
}

type Props = {
  searchParams: Promise<{ cohortId?: string }>;
};

export default async function AdminProgramOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const cohort = await resolveAdminProgramCohort(params.cohortId);
  const overview = cohort ? await getCohortOverview(cohort.id) : null;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Program overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Cohort lifecycle, join codes, publish results, and analytics.
        </p>
      </header>

      <ProgramExportButtons cohortId={cohort?.id ?? null} />

      <ProgramCohortPanel
        overview={overview?.cohort ?? null}
        rawStartsAt={cohort ? toDatetimeLocal(cohort.startsAt) : null}
        rawEndsAt={cohort ? toDatetimeLocal(cohort.endsAt) : null}
      />

      {overview && (
        <ProgramAnalyticsCharts
          data={{
            scoreBuckets: overview.scoreBuckets,
            moduleProgress: overview.moduleProgress,
            dailyEngagement: overview.dailyEngagement,
            missionFunnel: overview.missionFunnel,
            experienceMix: overview.experienceMix,
            atRisk: overview.atRisk,
          }}
        />
      )}
    </div>
  );
}
