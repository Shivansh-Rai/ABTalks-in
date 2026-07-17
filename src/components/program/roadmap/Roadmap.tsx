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
    <section ref={rootRef} className="relative px-4 py-16 md:px-8 md:py-24">
      <h2 className="mb-12 text-center text-2xl font-bold tracking-tight text-white md:mb-16 md:text-3xl">
        Course Roadmap
      </h2>

      <div className="relative mx-auto max-w-4xl">
        <TimelineConnector activatedPhases={activatedPhases} />
        <MobileTimelineConnector activatedPhases={activatedPhases} />

        <ol className="relative space-y-8 md:space-y-10">
          {ROADMAP_PHASES.map((phase, index) => {
            const active = index < activatedPhases;
            return (
              <li
                key={phase.phase}
                className="relative flex items-center gap-4 md:gap-8"
              >
                <div className="absolute left-0 md:relative md:left-auto">
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
