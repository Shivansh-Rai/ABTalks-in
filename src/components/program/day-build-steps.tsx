"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import type { Components } from "react-markdown";
import {
  DaySectionCard,
} from "@/components/program/day-section-card";
import {
  programMdComponents,
  ProgramMarkdownCode,
  ProgramMarkdownPre,
} from "@/components/program/markdown-code";
import { useSafeReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_VISIBLE_STEPS = 5;

const stepNavBtn =
  "inline-flex h-9 items-center justify-center rounded-[12px] border border-black bg-[#7364E6] px-4 text-sm font-bold text-white shadow-[inset_3px_3px_3px_0_rgba(0,0,0,0.5)] hover:bg-[#7364E6]/90 disabled:cursor-not-allowed disabled:opacity-40";

const pointerSpring = { type: "spring" as const, stiffness: 420, damping: 34 };
const stepSpring = { type: "spring" as const, stiffness: 380, damping: 28 };

/** Build-step prose: white body/bold/code; looser line spacing for readability. */
const buildStepMdClassName =
  "text-sm leading-7 text-white [&_a]:font-medium [&_a]:text-white [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-[#1a0a3a] [&_code]:px-1 [&_code]:text-xs [&_code]:text-white [&_li]:ml-1 [&_li]:list-disc [&_li]:leading-7 [&_li]:marker:text-[#968BEC] [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-5 [&_p]:mb-3 [&_p]:leading-8 [&_p]:last:mb-0 [&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[#8365E3]/40 [&_pre]:bg-[#110528] [&_pre]:p-3 [&_pre]:text-xs [&_pre]:leading-6 [&_pre]:text-[#E9E9E9] [&_strong]:font-bold [&_strong]:text-white [&_ul]:mb-3 [&_ul]:space-y-2.5 [&_ul]:pl-5";

/**
 * Normalize step markdown for clearer reading:
 * - strip em/en dashes
 * - wrap bare URLs in backticks (click-to-copy via code chip)
 * - turn dense **Label:** / semicolon chunks into bullet lists
 */
function formatBuildStepContent(raw: string): string {
  let text = raw
    .replace(/\u2014/g, " - ")
    .replace(/—/g, " - ")
    .replace(/\u2013/g, "-")
    .replace(/–/g, "-")
    .replace(/\s+-\s+/g, " - ")
    .trim();

  // Bare URLs → inline code (click-to-copy). Skip ones already in backticks.
  text = text.replace(
    /(^|[\s([{}])(https?:\/\/[^\s<>\]`)'"]+)/g,
    "$1`$2`",
  );

  if (/^\s*[-*+]\s/m.test(text) || /^\s*\d+\.\s/m.test(text)) {
    return text;
  }

  // **Label:** sections → bullets
  const labeled = text
    .split(/(?=\*\*[^*\n]+?\*\*:)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (labeled.length >= 2) {
    return labeled.map((chunk) => `- ${chunk}`).join("\n\n");
  }

  // Long semicolon lists (e.g. RAM → command options)
  const semiParts = text.split(/\s*;\s+/).map((s) => s.trim()).filter(Boolean);
  if (semiParts.length >= 3) {
    return semiParts
      .map((part, i) => {
        const cleaned = part.replace(/\.$/, "");
        return `- ${cleaned}${i === semiParts.length - 1 && part.endsWith(".") ? "." : ""}`;
      })
      .join("\n\n");
  }

  // Sentence breaks before a new **bold** lead-in
  const boldBeats = text
    .split(/(?<=\.)\s+(?=\*\*)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (boldBeats.length >= 2) {
    return boldBeats.map((chunk) => `- ${chunk}`).join("\n\n");
  }

  return text;
}

function CopyableLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <button
      type="button"
      title="Click to copy link"
      aria-label={`Copy link ${href}`}
      onClick={() => void copy()}
      className={cn(
        "inline max-w-full break-all font-medium text-white underline underline-offset-2 transition-colors hover:text-[#E9E9E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#968BEC]",
        copied && "ring-2 ring-emerald-400/70",
      )}
    >
      {children}
    </button>
  );
}

const buildStepMdComponents: Components = {
  ...programMdComponents,
  code: ProgramMarkdownCode,
  pre: ProgramMarkdownPre,
  a: ({ href, children }) => {
    if (!href) return <span>{children}</span>;
    return <CopyableLink href={href}>{children}</CopyableLink>;
  },
};

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

export function DayBuildSteps({ steps }: { steps: string[] }) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduceMotion = useSafeReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [pointerX, setPointerX] = useState<number | null>(null);

  const formattedSteps = useMemo(
    () => steps.map((step) => formatBuildStepContent(step)),
    [steps],
  );

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

  function goToStep(next: number) {
    if (next === active) return;
    setDirection(next > active ? 1 : -1);
    setActive(next);
  }

  function handleNext() {
    if (isLast) {
      document
        .getElementById("mission-verify")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    goToStep(Math.min(active + 1, steps.length - 1));
  }

  function handleBack() {
    goToStep(Math.max(active - 1, 0));
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
                  onClick={() => goToStep(stepIndex)}
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

      <div className="mb-3 flex items-center justify-end gap-2">
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

      <div className="rounded-[16px] border border-[#8365E3] bg-[#110528] p-4 md:p-5">
        <motion.div
          key={`content-${active}`}
          className={cn(buildStepMdClassName, "min-h-[80px]")}
          initial={
            reduceMotion ? false : { opacity: 0, x: direction * 12 }
          }
          animate={{ opacity: 1, x: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }
          }
        >
          <ReactMarkdown components={buildStepMdComponents}>
            {formattedSteps[active] ?? ""}
          </ReactMarkdown>
        </motion.div>
      </div>
    </DaySectionCard>
  );
}
