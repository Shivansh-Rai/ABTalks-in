"use client";

import { CalendarDays } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { RoadmapPhase } from "@/data/roadmap";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function RoadmapCard({
  phase,
  index,
  active,
}: {
  phase: RoadmapPhase;
  index: number;
  active: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const Icon = phase.icon;
  const slideFrom = index % 2 === 0 ? 48 : 32;

  return (
    <motion.article
      className={cn(
        "group relative w-full max-w-[640px] cursor-default rounded-2xl border p-4 backdrop-blur-sm transition-[box-shadow,border-color,background-color] duration-200 md:p-5",
        index % 2 === 0 ? "md:ml-[6%]" : "md:ml-[14%]",
        "ml-12 md:ml-0",
      )}
      style={{
        borderColor: `rgba(${phase.accentRgb}, 0.35)`,
        backgroundColor: "rgba(8, 12, 28, 0.72)",
        boxShadow: active
          ? `0 4px 32px rgba(${phase.accentRgb}, 0.18), inset 0 1px 0 rgba(255,255,255,0.04)`
          : "0 4px 16px rgba(0,0,0,0.2)",
      }}
      initial={false}
      animate={
        active
          ? {
              opacity: 1,
              x: 0,
              scale: 1,
            }
          : {
              opacity: reduceMotion ? 0.35 : 0,
              x: reduceMotion ? 0 : slideFrom,
              scale: reduceMotion ? 1 : 0.98,
            }
      }
      transition={
        reduceMotion
          ? { duration: 0.2 }
          : { duration: 0.45, ease }
      }
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -4,
              boxShadow: `0 8px 40px rgba(${phase.accentRgb}, 0.28), inset 0 1px 0 rgba(255,255,255,0.06)`,
              borderColor: `rgba(${phase.accentRgb}, 0.55)`,
              backgroundColor: "rgba(12, 16, 36, 0.88)",
            }
      }
    >
      <motion.span
        className="pointer-events-none absolute bottom-2 right-3 select-none font-semibold italic leading-none tracking-tight md:right-5"
        style={{
          color: `rgba(${phase.accentRgb}, 0.22)`,
          fontSize: "clamp(3.5rem, 8vw, 5.5rem)",
        }}
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: reduceMotion ? 0.15 : 0.35, ease, delay: 0.08 }}
        aria-hidden
      >
        {phase.displayNumber}
      </motion.span>

      <div className="relative flex gap-4">
        <motion.div
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border md:size-14"
          style={{
            borderColor: `rgba(${phase.accentRgb}, 0.4)`,
            backgroundColor: `rgba(${phase.accentRgb}, 0.12)`,
            boxShadow: `0 0 20px rgba(${phase.accentRgb}, 0.15)`,
          }}
          initial={false}
          animate={{ scale: active ? 1 : 0.85, opacity: active ? 1 : 0.5 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.35, ease }}
          whileHover={reduceMotion ? undefined : { scale: 1.05 }}
        >
          <Icon className="size-6 text-white md:size-7" strokeWidth={1.75} />
        </motion.div>

        <div className="min-w-0 flex-1 pr-16 md:pr-20">
          <span
            className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white md:text-xs"
            style={{ backgroundColor: phase.accent }}
          >
            Phase {phase.phase}
          </span>
          <h3 className="mt-2 text-lg font-semibold text-white md:text-xl">
            {phase.title}
          </h3>
          <p className="mt-0.5 text-sm text-[#9CA3AF]">{phase.subtitle}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-[#E9E9E9]">
            <CalendarDays className="size-3.5 opacity-70" />
            {phase.days}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
