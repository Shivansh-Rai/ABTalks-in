"use client";

import type { WizardStep } from "./profile-wizard";

/**
 * The left card: Quick Links into the profile.
 *
 * The identity block lives in the report card hero, so this card is purely
 * navigation. A tab moves the active section and opens the form sheet, which
 * is always editable — there is no locked state and no edit pencil.
 */
export function ProfileCard({
  steps,
  activeIndex,
  onJump,
}: {
  steps: Pick<WizardStep, "title" | "complete" | "attention">[];
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <section className="pw-profile-card">
      <div className="pw-quick-head">
        <h2 className="pw-quick-title">Quick Links</h2>
        <p className="pw-quick-sub">Jump to any section to edit it.</p>
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
    </section>
  );
}
