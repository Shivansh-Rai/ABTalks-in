"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE_SPARK } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PROGRESS_STEPS, STEP_IDS, type StepId } from "./onboarding-draft";

/*
 * You ── Company ── Verify
 *
 * The current step carries a teal underline that travels between labels
 * (shared layoutId), connectors fill as steps complete, and completed steps
 * turn into a quiet check. Before the account exists, a completed step is a
 * button back to itself. Phones get a labelled three-segment bar instead.
 */

const FILL = { duration: 0.5, ease: EASE_SPARK };

function progressIndex(current: StepId): number {
  if (current === "welcome") return -1;
  if (current === "complete") return PROGRESS_STEPS.length;
  return PROGRESS_STEPS.findIndex((s) => s.id === current);
}

export function OnboardingProgress({
  current,
  onJump,
}: {
  current: StepId;
  /** Omitted once the account exists: nothing before Verify can change then. */
  onJump?: (id: StepId) => void;
}) {
  const index = progressIndex(current);
  const total = PROGRESS_STEPS.length;
  const active = PROGRESS_STEPS[index];
  const announce =
    current === "welcome"
      ? `${total} short steps`
      : current === "complete"
        ? "All steps complete"
        : `Step ${index + 1} of ${total}: ${active?.label}`;

  return (
    <nav aria-label="Onboarding progress">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ol className="hidden items-center sm:flex">
        {PROGRESS_STEPS.map((step, i) => {
          const done = i < index;
          const isCurrent = i === index;
          const canJump = done && Boolean(onJump);
          const marker = (
            <>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300",
                  done && "bg-[#D6F7EC] text-[#03535F]",
                  isCurrent && "border-2 border-[#03535F] text-[#03535F]",
                  !done && !isCurrent && "border border-[#D2D2D2] text-[#8F8F8F]",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "relative text-sm transition-colors duration-300",
                  isCurrent ? "font-semibold text-[#03535F]" : done ? "text-[#353535]" : "text-[#8F8F8F]",
                )}
              >
                {step.label}
                {isCurrent && (
                  <motion.span
                    layoutId="onboarding-progress-current"
                    transition={FILL}
                    className="absolute inset-x-0 -bottom-1.5 h-0.5 rounded-full bg-[#03535F]"
                  />
                )}
              </span>
              {done && <span className="sr-only">(completed)</span>}
            </>
          );

          return (
            <li key={step.id} className="flex items-center">
              {i > 0 && (
                <span aria-hidden className="relative mx-3 h-px w-6 overflow-hidden bg-[#E0E0E0] lg:w-10">
                  <motion.span
                    className="absolute inset-0 origin-left bg-[#03535F]"
                    initial={false}
                    animate={{ scaleX: i <= index ? 1 : 0 }}
                    transition={FILL}
                  />
                </span>
              )}
              {canJump ? (
                <button
                  type="button"
                  onClick={() => onJump?.(step.id)}
                  className="-m-1 flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-[#EEF6F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]"
                >
                  {marker}
                </button>
              ) : (
                <span
                  className="flex items-center gap-2"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {marker}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="sm:hidden" aria-hidden>
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold text-[#03535F]">
            {current === "complete" ? "All set" : (active?.label ?? "Get started")}
          </span>
          {index >= 0 && index < total && (
            <span className="text-[#787878]">
              Step {index + 1} of {total}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {PROGRESS_STEPS.map((step, i) => (
            <span key={step.id} className="relative h-1 overflow-hidden rounded-full bg-[#E9E9E9]">
              <motion.span
                className="absolute inset-0 origin-left rounded-full bg-[#03535F]"
                initial={false}
                animate={{ scaleX: i <= index ? 1 : 0 }}
                transition={FILL}
              />
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
}

export function stepIndex(id: StepId): number {
  return STEP_IDS.indexOf(id);
}
