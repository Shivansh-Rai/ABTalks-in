import {
  GROUP_LABEL,
  GROUP_ORDER,
  type CandidateDiscoverability,
  type CheckStatus,
  type DiscoverabilityCheck,
} from "@/features/admin/candidate-discoverability";

/**
 * "Why isn't this candidate showing up?" — answered on the admin candidate page.
 *
 * Server Component. Read-only: no `"use client"`, no `@/app/actions/*`.
 *
 * Every row is a condition that really runs in the recruiter-search path, and the
 * blocker named at the top is the first one that actually stops the candidate.
 * The platform has no candidate-facing switch over any of this — see the header
 * comment on `features/admin/candidate-discoverability.ts` — so no row here may
 * suggest the candidate made a choice about being found.
 */

const STATUS_STYLE: Record<CheckStatus, string> = {
  OK: "border-[#A7E8D2] bg-[#D6F7EC] text-[#197E23]",
  BLOCKING: "border-[#FFCDC4] bg-[#FFF2F0] text-[#D92D20]",
  LIMITING: "border-[#FFE2B8] bg-[#FFF7EB] text-[#B54708]",
  INFO: "border-[#E9E9E9] bg-[#F6F6F6] text-[#5C5C5C]",
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  OK: "Clear",
  BLOCKING: "Blocker",
  LIMITING: "Narrows",
  INFO: "Context",
};

function StatusPill({ status }: { status: CheckStatus }) {
  return (
    <span
      className={`mt-0.5 w-16 shrink-0 self-start rounded-full border px-2 py-0.5 text-center text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function CheckRow({
  check,
  isBlocker,
}: {
  check: DiscoverabilityCheck;
  isBlocker: boolean;
}) {
  return (
    <li className="flex gap-3 border-b border-[#E9E9E9] py-3 last:border-0">
      <StatusPill status={check.status} />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-[#353535]">{check.label}</p>
          {isBlocker ? (
            <span className="whitespace-nowrap rounded-full bg-[#D92D20] px-2 py-0.5 text-xs font-medium text-white">
              This is the blocker
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[#5C5C5C]">{check.detail}</p>
        {check.action ? (
          <p className="text-sm text-[#787878]">
            <span className="text-[#8F8F8F]">What to do:</span> {check.action}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function CandidateDiscoverabilityPanel({
  state,
}: {
  state: CandidateDiscoverability;
}) {
  const groups = GROUP_ORDER.map((group) => ({
    group,
    rows: state.checks.filter((c) => c.group === group),
  })).filter((g) => g.rows.length > 0);

  return (
    <section className="rounded-xl border border-[#E9E9E9] bg-white p-5">
      <h2 className="font-display text-base font-semibold text-[#353535]">
        Recruiter search
      </h2>
      <p className="mt-1 text-sm text-[#787878]">
        Every condition the recruiter-search path actually applies, checked against
        this candidate.
      </p>

      <div
        className={`mt-4 rounded-lg border p-4 ${
          state.appears
            ? "border-[#A7E8D2] bg-[#D6F7EC]"
            : "border-[#FFCDC4] bg-[#FFF2F0]"
        }`}
      >
        <p
          className={`text-sm font-semibold ${
            state.appears ? "text-[#197E23]" : "text-[#D92D20]"
          }`}
        >
          {state.verdict}
        </p>
        {state.blocker ? (
          <p className="mt-1 text-sm text-[#5C5C5C]">{state.blocker.detail}</p>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {groups.map(({ group, rows }) => (
          <div key={group}>
            <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-[#8F8F8F]">
              {GROUP_LABEL[group]}
            </h3>
            <ul className="mt-1">
              {rows.map((check) => (
                <CheckRow
                  key={check.id}
                  check={check}
                  isBlocker={state.blocker?.id === check.id}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
