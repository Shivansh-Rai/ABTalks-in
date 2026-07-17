"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, useReducedMotion } from "framer-motion";
import {
  DaySectionCard,
  dayMdClassName,
} from "@/components/program/day-section-card";
import { DayBuildStepImage } from "@/components/program/day-build-step-image";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_STEPS = 5;

const stepNavBtn =
  "inline-flex h-9 items-center justify-center rounded-[12px] border border-black bg-[#7364E6] px-4 text-sm font-bold text-white shadow-[inset_3px_3px_3px_0_rgba(0,0,0,0.5)] hover:bg-[#7364E6]/90 disabled:cursor-not-allowed disabled:opacity-40";

const pointerSpring = { type: "spring" as const, stiffness: 420, damping: 34 };
const stepSpring = { type: "spring" as const, stiffness: 380, damping: 28 };

function StepPointer() {
  return (
    <div
      className="flex h-6 w-10 items-center justify-center rounded-[4px] bg-[#7528C9]/30"
      aria-hidden
    >
      <svg width="16" height="10" viewBox="0 0 24 14" fill="none">
        <path d="M12 14L0 0H24L12 14Z" fill="#968BEC" />
      </svg>
    </div>
  );
}

export function DayBuildSteps({
  dayNumber,
  steps,
}: {
  dayNumber: number;
  steps: string[];
}) {
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [pointerX, setPointerX] = useState<number | null>(null);

  const windowStart = useMemo(() => {
    if (steps.length <= MAX_VISIBLE_STEPS) return 0;
    const half = Math.floor(MAX_VISIBLE_STEPS / 2);
    return Math.max(
      0,
      Math.min(active - half, steps.length - MAX_VISIBLE_STEPS),
    );
  }, [active, steps.length]);

  const visibleIndices = useMemo(
    () =>
      Array.from(
        { length: Math.min(MAX_VISIBLE_STEPS, steps.length) },
        (_, i) => windowStart + i,
      ),
    [windowStart, steps.length],
  );

  useLayoutEffect(() => {
    function updatePointer() {
      const track = trackRef.current;
      const btn = stepRefs.current.get(active);
      if (!track || !btn) return;

      const trackRect = track.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setPointerX(btnRect.left + btnRect.width / 2 - trackRect.left);
    }

    updatePointer();
    window.addEventListener("resize", updatePointer);
    return () => window.removeEventListener("resize", updatePointer);
  }, [active, windowStart, visibleIndices]);

  if (steps.length === 0) return null;

  const isFirst = active <= 0;
  const isLast = active >= steps.length - 1;

  function handleNext() {
    if (isLast) {
      document
        .getElementById("mission-verify")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setActive((i) => Math.min(i + 1, steps.length - 1));
  }

  function handleBack() {
    setActive((i) => Math.max(i - 1, 0));
  }

  return (
    <DaySectionCard title="Build Steps" icon="build">
      <div className="relative mb-8 min-h-[4.75rem] pt-1">
        {pointerX !== null && (
          <motion.div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
            initial={false}
            animate={{ left: pointerX }}
            transition={reduceMotion ? { duration: 0 } : pointerSpring}
          >
            <motion.div
              key={active}
              initial={reduceMotion ? false : { scale: 0.85, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.3, ease: "easeOut" }
              }
            >
              <StepPointer />
            </motion.div>
          </motion.div>
        )}

        <div
          ref={trackRef}
          className="flex w-full items-end justify-between gap-1"
        >
          {visibleIndices.map((stepIndex, vi) => {
            const isActive = stepIndex === active;
            const isLastVisible = vi === visibleIndices.length - 1;
            return (
              <div key={stepIndex} className="flex min-w-0 flex-1 items-end">
                <button
                  ref={(el) => {
                    if (el) stepRefs.current.set(stepIndex, el);
                    else stepRefs.current.delete(stepIndex);
                  }}
                  type="button"
                  onClick={() => setActive(stepIndex)}
                  className="flex min-w-0 flex-1 flex-col items-center"
                  aria-current={isActive ? "step" : undefined}
                >
                  <div className="h-6 w-full shrink-0" aria-hidden />
                  <motion.span
                    className={cn(
                      "mt-1 flex size-4 items-center justify-center rounded-full border-2 border-[#7528C9] bg-[#040C20]",
                    )}
                    initial={false}
                    animate={{
                      scale: isActive && !reduceMotion ? 1.2 : 1,
                      boxShadow:
                        isActive && !reduceMotion
                          ? "0 0 0 3px rgba(117, 40, 201, 0.35)"
                          : "0 0 0 0px rgba(117, 40, 201, 0)",
                    }}
                    transition={reduceMotion ? { duration: 0 } : stepSpring}
                  />
                  <motion.span
                    className="mt-1.5 flex h-6 w-full origin-center items-center justify-center truncate text-center text-xs leading-none"
                    initial={false}
                    animate={{
                      scale: isActive && !reduceMotion ? 1.35 : 1,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#D2D2D2" : "#A5A5A5",
                    }}
                    transition={reduceMotion ? { duration: 0 } : stepSpring}
                  >
                    Step {stepIndex + 1}
                  </motion.span>
                </button>
                {!isLastVisible && (
                  <div
                    className="mx-1 mb-[1.625rem] h-0 min-w-3 flex-1 border-t border-dashed border-[rgba(117,40,201,0.54)]"
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative rounded-[16px] border border-[#8365E3] bg-[#110528] p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(140px,240px)_1fr] md:items-start">
          <motion.div
            key={`img-${active}`}
            initial={reduceMotion ? false : { opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }
            }
          >
            <DayBuildStepImage dayNumber={dayNumber} stepNumber={active + 1} />
          </motion.div>
          <motion.div
            key={`content-${active}`}
            className={cn(dayMdClassName, "min-h-[80px]")}
            initial={reduceMotion ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }
            }
          >
            <ReactMarkdown>{steps[active] ?? ""}</ReactMarkdown>
          </motion.div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 md:absolute md:right-5 md:bottom-4 md:mt-0">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirst}
            className={stepNavBtn}
          >
            ← Back
          </button>
          <button type="button" onClick={handleNext} className={stepNavBtn}>
            {isLast ? "Done" : "Next →"}
          </button>
        </div>
      </div>
    </DaySectionCard>
  );
}
