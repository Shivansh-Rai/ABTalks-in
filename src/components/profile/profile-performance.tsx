"use client";

import Link from "next/link";

const PERFORMANCE_TOOLTIP =
  "How often recruiters opened your details and unlocked your resume on Hire, over the last 90 days.";

/**
 * Recruiter-activity numbers for the last 90 days, as a compact light-blue
 * panel in the report card hero (beside the name, before Edit). On narrow
 * screens it drops to its own row under the hero copy.
 *
 * The numbers are the whole content: nothing opens from them, so they carry
 * no chevron. The link says what recruiters saw (plan 155).
 */
export function ProfilePerformance({
  searchAppearances,
  recruiterActions,
}: {
  searchAppearances: number;
  recruiterActions: number;
}) {
  return (
    <section className="pw-rv-performance" aria-labelledby="pw-rvp-title">
      <div className="pw-rvp-head">
        <span id="pw-rvp-title" className="pw-rvp-title">
          Profile performance
        </span>
        <span className="pw-rvp-caption">Last 90 days</span>
        {/* <svg
          viewBox="0 0 24 24"
          className="pw-rvp-info"
          role="img"
          aria-label={PERFORMANCE_TOOLTIP}
        >
          <title>{PERFORMANCE_TOOLTIP}</title>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg> */}
      </div>
      <dl className="pw-rvp-stats">
        <div className="pw-rvp-stat">
          <dt>Search appearances</dt>
          <dd>{searchAppearances}</dd>
        </div>
        <span className="pw-rvp-divider" aria-hidden />
        <div className="pw-rvp-stat">
          <dt>Recruiter actions</dt>
          <dd>{recruiterActions}</dd>
        </div>
      </dl>
      <Link href="/profile/recruiter-view" className="pw-rvp-link">
        See how recruiters see you
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </Link>
    </section>
  );
}
