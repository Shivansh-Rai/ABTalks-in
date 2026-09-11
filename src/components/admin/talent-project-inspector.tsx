import { SpecSummary } from "@/components/hire/spec-summary";
import type {
  InspectedMatch,
  TalentProjectInspection,
} from "@/features/admin/inspect-talent-project";

/**
 * Read-only admin view of one recruiter's talent project (T-278 / TC-A-016).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DELIBERATELY A SERVER COMPONENT WITH NO INTERACTIVITY.
 *
 * There is no `"use client"`, no state, no handler and no import from
 * `@/app/actions/*`. That is the read-only guarantee: not a disabled button,
 * but the absence of any control that could reach a writer. R2 of plan 115 §10
 * is explicit — "hiding a button is not security".
 *
 * This is why the recruiter's own components are NOT reused here. `ScoutChat`
 * fires `markProjectOpenedAction` and `markMatchViewedAction` from effects on
 * mount, `CandidateInspector` imports the billable `revealContactAction` with
 * no prop to disable it, and `GapReport` calls `requestCohortTrainAction` from
 * its only button. An admin opening this page must change nothing at all —
 * including the recruiter's `lastViewedAt`, which drives their "new since your
 * last visit" badges.
 *
 * `SpecSummary` is the one shared component reused, because it is pure: props
 * in, markup out, no hooks and no directive.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function formatWhen(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MatchTable({
  rows,
  emptyLabel,
}: {
  rows: InspectedMatch[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Candidate</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Score</th>
            <th className="px-3 py-2 font-medium">Tier</th>
            <th className="px-3 py-2 font-medium">Decision</th>
            <th className="px-3 py-2 font-medium">Viewed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.candidateRef} className="border-t">
              <td className="px-3 py-2">
                {m.displayName?.trim() || m.candidateRef}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{m.jobRole}</td>
              <td className="px-3 py-2 tabular-nums">{m.score}</td>
              <td className="px-3 py-2 text-muted-foreground">{m.tier}</td>
              <td className="px-3 py-2">{m.decision}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {m.viewedAt
                  ? formatWhen(new Date(m.viewedAt))
                  : "Not yet viewed"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TalentProjectInspector({
  project,
}: {
  project: TalentProjectInspection;
}) {
  const { owner, counts } = project;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <p className="text-sm font-medium">Read-only inspection</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This project belongs to{" "}
          <span className="font-medium text-foreground">
            {owner.name ?? owner.email ?? owner.userId}
          </span>
          {owner.company ? ` (${owner.company})` : ""}. Nothing on this page can
          change it — opening it does not mark the project or any candidate as
          viewed, and the recruiter&apos;s own “last opened” time is untouched.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Criteria</h2>
        <SpecSummary summary={project.title} spec={project.spec} />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Status</dt>
            <dd className="text-sm">{project.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Created</dt>
            <dd className="text-sm">{formatWhen(project.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">
              Owner last opened
            </dt>
            <dd className="text-sm">{formatWhen(project.lastViewedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">
              Archived
            </dt>
            <dd className="text-sm">
              {project.archivedAt ? formatWhen(project.archivedAt) : "No"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Results</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Matches" value={counts.total} />
          <Stat label="Viewed" value={counts.viewed} />
          <Stat label="Shortlisted" value={counts.shortlisted} />
          <Stat label="Rejected" value={counts.rejected} />
          <Stat label="Undecided" value={counts.undecided} />
        </div>
        <p className="text-xs text-muted-foreground">
          Candidates who have since made themselves unsearchable are not listed,
          exactly as they are not listed for the recruiter. This is the same
          view the recruiter sees, not a filtered subset of it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Pipeline state{" "}
          <span className="font-normal text-muted-foreground">
            — triage decision per match
          </span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Decision is the only pipeline state the product stores today:
          UNDECIDED, SHORTLISTED or REJECTED.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Shortlisted ({counts.shortlisted})
        </h3>
        <MatchTable rows={project.shortlisted} emptyLabel="Nobody shortlisted." />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Rejected ({counts.rejected})</h3>
        <MatchTable rows={project.rejected} emptyLabel="Nobody rejected." />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Undecided ({counts.undecided})
        </h3>
        <MatchTable rows={project.undecided} emptyLabel="Nothing undecided." />
      </section>

      {project.messages.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Scout transcript ({project.messages.length})
          </h2>
          <ol className="space-y-2">
            {project.messages.map((m, i) => (
              <li
                key={`${m.role}-${i}`}
                className="rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <span className="text-xs text-muted-foreground uppercase">
                  {m.role}
                </span>
                <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
