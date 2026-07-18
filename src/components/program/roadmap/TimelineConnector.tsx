"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ROADMAP_PHASES } from "@/data/roadmap";
import { useSafeReducedMotion } from "@/lib/motion";

const ease = [0.22, 1, 0.36, 1] as const;

/** S-curve dotted path through all phase nodes (left rail). */
function buildPath(count: number): string {
  const x = 28;
  let d = `M ${x} 0`;
  for (let i = 0; i < count; i++) {
    const y0 = i * 100;
    const y1 = (i + 1) * 100;
    const mid = y0 + 50;
    const bulge = 68;
    d += ` C ${x} ${mid}, ${bulge} ${mid}, ${x} ${y1}`;
  }
  return d;
}

export function TimelineConnector({
  activatedPhases,
}: {
  activatedPhases: number;
}) {
  const reduceMotion = useSafeReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const d = useMemo(() => buildPath(ROADMAP_PHASES.length), []);

  useLayoutEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [d]);

  const progress = Math.min(activatedPhases / ROADMAP_PHASES.length, 1);
  const offset = pathLength > 0 ? pathLength * (1 - progress) : 0;

  return (
    <svg
      className="pointer-events-none absolute left-3 top-6 hidden h-[calc(100%-3rem)] w-20 md:block lg:left-4"
      viewBox={`0 0 80 ${ROADMAP_PHASES.length * 100}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth="0"
        aria-hidden
      />
      <path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="2"
        strokeDasharray="4 8"
        vectorEffect="non-scaling-stroke"
      />
      {pathLength > 0 && (
        <motion.path
          d={d}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="2.5"
          strokeDasharray="4 8"
          vectorEffect="non-scaling-stroke"
          initial={false}
          animate={{ strokeDashoffset: reduceMotion ? 0 : offset }}
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : { duration: 0.35, ease }
          }
        />
      )}
    </svg>
  );
}

/** Mobile: straight vertical dotted line drawn top-to-bottom */
export function MobileTimelineConnector({
  activatedPhases,
}: {
  activatedPhases: number;
}) {
  const reduceMotion = useSafeReducedMotion();
  const progress = Math.min(activatedPhases / ROADMAP_PHASES.length, 1);

  return (
    <div
      className="absolute bottom-6 left-[1.375rem] top-6 w-px md:hidden"
      aria-hidden
    >
      <div className="h-full w-full bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_4px,transparent_4px,transparent_10px)]" />
      <motion.div
        className="absolute left-0 top-0 w-full origin-top bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.5)_0,rgba(255,255,255,0.5)_4px,transparent_4px,transparent_10px)]"
        initial={false}
        animate={{ scaleY: reduceMotion ? 1 : progress }}
        transition={{ duration: reduceMotion ? 0.2 : 0.35, ease }}
        style={{ height: "100%" }}
      />
    </div>
  );
}
