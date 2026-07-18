"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { ROADMAP_PHASES, ROADMAP_PHASE_DURATION_MS } from "@/data/roadmap";
import { RoadmapCard } from "@/components/program/roadmap/RoadmapCard";
import { AnimatedNode } from "@/components/program/roadmap/AnimatedNode";
import {
  MobileTimelineConnector,
  TimelineConnector,
} from "@/components/program/roadmap/TimelineConnector";

export function Roadmap() {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const isInView = useInView(rootRef, { once: true, amount: 0.25 });
  const [activatedPhases, setActivatedPhases] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!isInView || started) return;
    setStarted(true);

    if (reduceMotion) {
      setActivatedPhases(ROADMAP_PHASES.length);
      return;
    }

    let count = 0;
    setActivatedPhases(0);

    const tick = () => {
      count += 1;
      setActivatedPhases(count);
      if (count < ROADMAP_PHASES.length) {
        window.setTimeout(tick, ROADMAP_PHASE_DURATION_MS);
      }
    };

    window.setTimeout(tick, 120);
  }, [isInView, reduceMotion, started]);

  return (
    <section ref={rootRef} className="relative px-4 pt-4 pb-16 md:px-8 md:pt-8 md:pb-24">
      <h2 className="mb-12 text-center text-2xl font-bold tracking-tight text-white md:mb-16 md:text-3xl">
        Course Roadmap
      </h2>

      {/*
        Desktop: path spine at left-3 + (28/80)*w-20 ≈ 40px.
        Nodes were sitting right of the line; center size-9 (36px) on that x → left 22px.
        Empirically the visible dash sits ~40px; use left-[22px] so the circle straddles it.
      */}
      <div className="relative mx-auto max-w-4xl">
        <TimelineConnector activatedPhases={activatedPhases} />
        <MobileTimelineConnector activatedPhases={activatedPhases} />

        <ol className="relative space-y-5 md:space-y-6">
          {ROADMAP_PHASES.map((phase, index) => {
            const active = index < activatedPhases;
            return (
              <li
                key={phase.phase}
                className="relative flex min-h-9 items-center pl-12 md:min-h-9 md:pl-[4.25rem]"
              >
                {/*
                  Mobile line at 1.375rem; node half = 1.125rem → left = 0.25rem
                  Desktop path x=28 in 80px svg at left 12px → 40px; half node 18 → left 22px
                */}
                <div className="absolute top-1/2 left-1 z-10 -translate-y-1/2 md:left-[32px]">
                  <AnimatedNode
                    active={active}
                    accent={phase.accent}
                    accentRgb={phase.accentRgb}
                  />
                </div>
                <RoadmapCard phase={phase} index={index} active={active} />
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
