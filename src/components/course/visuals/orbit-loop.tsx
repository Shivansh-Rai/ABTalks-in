"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { OrbitVisual } from "@/features/courses/types";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const SIZE = 380;
const C = SIZE / 2;
const R = 132;
const STEP_MS = 1400;

/**
 * A cycle drawn as an orbit around a central actor, with a pulse travelling
 * the ring. Auto-advances (unless reduced motion); hovering or clicking a
 * node pins it and explains it. `tone="dark"` is the green hero variant.
 */
export function OrbitLoop({ config, tone = "light" }: { config: OrbitVisual; tone?: "light" | "dark" }) {
  const { center, nodes } = config;
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);
  const [auto, setAuto] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = pinned ?? auto;

  useEffect(() => {
    if (reduced || pinned !== null) return;
    const t = setInterval(() => setAuto((i) => (i + 1) % nodes.length), STEP_MS);
    return () => clearInterval(t);
  }, [reduced, pinned, nodes.length]);

  const pos = nodes.map((_, i) => {
    const a = (-90 + (360 / nodes.length) * i) * (Math.PI / 180);
    return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
  });
  const dark = tone === "dark";
  const ink = dark ? "#ecfdf5" : "var(--c-fg)";
  const accent = dark ? "#4ade80" : "#03535f";

  return (
    <div className="crs-orbit" data-tone={tone}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="crs-orbit-svg" role="group" aria-label={`${center} loop`}>
        <defs>
          <radialGradient id="crs-orbit-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={dark ? "#4ade80" : "#3bb4c1"} stopOpacity="0.55" />
            <stop offset="100%" stopColor={dark ? "#4ade80" : "#3bb4c1"} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke={dark ? "rgba(187,247,208,.35)" : "var(--c-bd)"} strokeWidth="2" strokeDasharray="4 7" />
        {pos.map((p, i) => (
          <line key={i} x1={C} y1={C} x2={p.x} y2={p.y} stroke={i === active ? accent : dark ? "rgba(187,247,208,.14)" : "var(--c-bd)"} strokeWidth={i === active ? 2.5 : 1} />
        ))}
        {!reduced ? (
          <circle r="7" fill={accent}>
            <animateMotion dur={`${(STEP_MS * nodes.length) / 1000}s`} repeatCount="indefinite" path={`M${C} ${C - R} A${R} ${R} 0 1 1 ${C - 0.01} ${C - R}`} />
          </circle>
        ) : null}
        <circle cx={C} cy={C} r="78" fill="url(#crs-orbit-core)" />
        <circle cx={C} cy={C} r="46" fill={dark ? "#022c22" : "#03535f"} stroke={accent} strokeWidth="2" />
        <text x={C} y={C + 5} textAnchor="middle" style={{ fill: "#fff", fontWeight: 700, fontSize: 15 }}>
          {center}
        </text>
        {nodes.map((n, i) => {
          const on = i === active;
          return (
            <g
              key={n.label}
              role="button"
              tabIndex={0}
              aria-pressed={pinned === i}
              aria-label={n.label}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setPinned(i)}
              onMouseLeave={() => setPinned(null)}
              onFocus={() => setPinned(i)}
              onBlur={() => setPinned(null)}
              onClick={() => setPinned(i)}
            >
              <circle
                cx={pos[i].x}
                cy={pos[i].y}
                r={on ? 38 : 33}
                fill={on ? accent : dark ? "rgba(255,255,255,.08)" : "var(--c-bg)"}
                stroke={accent}
                strokeWidth="2"
                style={{ transition: "r .25s, fill .25s" }}
              />
              <text x={pos[i].x} y={pos[i].y + 4} textAnchor="middle" style={{ fill: on ? (dark ? "#022c22" : "#fff") : ink, fontWeight: 700, fontSize: 12.5 }}>
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="crs-orbit-caption" aria-live="polite">
        <b>
          {active + 1}. {nodes[active].label}
        </b>{" "}
        {nodes[active].detail}
      </p>
    </div>
  );
}
