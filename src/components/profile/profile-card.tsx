"use client";

import type { WizardStep } from "./profile-wizard";

const PERFORMANCE_TOOLTIP =
  "How often recruiters opened your details and unlocked your resume on Hire, over the last 90 days.";

/**
 * One half of the Profile performance panel.
 *
 * Order matches the design: value, then the charcoal dot, then the orange
 * chevron. The dot is a separator, not a status light.
 */
function PerfColumn({ label, value }: { label: string; value: number }) {
  return (
    <div className="pw-perf-column">
      <div className="pw-col-label">{label}</div>
      <div className="pw-col-value">
        {value}
        <span className="pw-dot" aria-hidden />
        <span className="pw-chev" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </div>
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
  steps: Pick<WizardStep, "title" | "complete" | "attention">[];
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
          const classes = [
            "pw-check-item",
            step.complete ? "pw-completed" : "",
            !step.complete && step.attention ? "pw-attention" : "",
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
                <span className="pw-sr-only">
                  Step {i + 1} of {steps.length}
                  {step.complete ? ", complete" : ""}
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
