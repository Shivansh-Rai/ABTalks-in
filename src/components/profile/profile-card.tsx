"use client";

import type { WizardStep } from "./profile-wizard";

const PERFORMANCE_TOOLTIP =
  "How often recruiters opened your details and unlocked your resume on Hire, over the last 90 days.";

/**
 * One half of the Profile performance panel.
 *
 * The number is the whole content. It carried a chevron in the design, which
 * read as "opens a breakdown" — there is nothing to open, so it is gone rather
 * than left as a promise the panel cannot keep.
 */
function PerfColumn({ label, value }: { label: string; value: number }) {
  return (
    <div className="pw-perf-column">
      <div className="pw-col-label">{label}</div>
      <div className="pw-col-value">{value}</div>
    </div>
  );
}

/**
 * The left card: Quick Links into the profile, plus Profile performance.
 *
 * The identity block lives in the report card hero, so this card is navigation
 * plus the candidate's own recruiter-activity numbers (plan 120).
 */
export function ProfileCard({
  steps,
  activeIndex,
  onJump,
  performance,
}: {
  steps: Pick<WizardStep, "title" | "complete" | "attention" | "optional">[];
  /** -1 when no sheet is open, so no tab is left looking selected. */
  activeIndex: number;
  onJump: (index: number) => void;
  performance: { searchAppearances: number; recruiterActions: number };
}) {
  return (
    <section className="pw-profile-card">
      <div className="pw-quick-head">
        <h2 className="pw-quick-title">Quick Links</h2>
      </div>

      <ul className="pw-checklist">
        {steps.map((step, i) => {
          const current = i === activeIndex;
          // An optional step is never "unfinished": finishing it cannot move
          // Profile strength, so flagging it for attention would be a nag for
          // something the score ignores.
          const needsAttention =
            !step.complete && step.attention && !step.optional;
          const classes = [
            "pw-check-item",
            step.complete ? "pw-completed" : "",
            needsAttention ? "pw-attention" : "",
            current ? "pw-current" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={step.title}>
              <button
                type="button"
                className={classes}
                onClick={() => onJump(i)}
                aria-current={current ? "step" : undefined}
              >
                <span>{step.title}</span>
                {step.optional && !step.complete ? (
                  <span className="pw-check-optional">Optional</span>
                ) : null}
                {needsAttention ? <span className="pw-check-dot" aria-hidden /> : null}
                <span className="pw-sr-only">
                  Step {i + 1} of {steps.length}
                  {step.complete ? ", complete" : ""}
                  {step.optional
                    ? ", optional — it does not count towards profile strength"
                    : ""}
                  {needsAttention ? ", needs attention" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="pw-performance-section">
        <div className="pw-performance-header">
          <span className="pw-section-title">Profile performance</span>
          <svg
            viewBox="0 0 24 24"
            className="pw-ico pw-info"
            role="img"
            aria-label={PERFORMANCE_TOOLTIP}
          >
            <title>{PERFORMANCE_TOOLTIP}</title>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <p className="pw-performance-caption">Last 90 days</p>
        <div className="pw-performance-grid">
          <PerfColumn
            label="Search appearances"
            value={performance.searchAppearances}
          />
          <div className="pw-grid-divider" aria-hidden />
          <PerfColumn
            label="Recruiter actions"
            value={performance.recruiterActions}
          />
        </div>
      </div>
    </section>
  );
}
