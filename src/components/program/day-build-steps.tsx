"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { DaySectionCard, dayMdClassName } from "@/components/program/day-section-card";
import { cn } from "@/lib/utils";

export function DayBuildSteps({ steps }: { steps: string[] }) {
  const [active, setActive] = useState(0);

  if (steps.length === 0) return null;

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

  return (
    <DaySectionCard title="Build Steps">
      <div className="mb-6 overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-0 px-1">
          {steps.map((_, i) => {
            const isActive = i === active;
            return (
              <div key={i} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className="flex flex-col items-center gap-2 px-1"
                  aria-current={isActive ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border-[3px]",
                      isActive
                        ? "border-[#7528C9] bg-[#040C20]"
                        : "border-[#7528C9] bg-[#040C20]",
                    )}
                  />
                  <span
                    className={cn(
                      "whitespace-nowrap text-sm font-semibold md:text-xl",
                      isActive
                        ? "text-[32px] font-bold leading-none text-[#D2D2D2]"
                        : "text-[#A5A5A5]",
                    )}
                  >
                    Step {i + 1}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <div
                    className="mx-2 mb-6 h-0 w-12 border-t-2 border-dashed border-[rgba(117,40,201,0.54)] md:w-16 lg:w-24"
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative rounded-[20px] border border-[#8365E3] bg-[#110528] p-5 md:p-8">
        <div className={cn(dayMdClassName, "min-h-[120px] pr-0 md:pr-28")}>
          <ReactMarkdown>{steps[active] ?? ""}</ReactMarkdown>
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-[15px] border border-black bg-[#7364E6] px-5 text-base font-bold text-white shadow-[inset_4px_4px_4px_0_rgba(0,0,0,0.5)] md:absolute md:bottom-6 md:right-6 md:mt-0"
        >
          {isLast ? "Done" : "Next →"}
        </button>
      </div>
    </DaySectionCard>
  );
}
