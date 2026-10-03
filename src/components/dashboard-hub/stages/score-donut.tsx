"use client";

import { useState } from "react";
import type { SectionKey, SectionStatus } from "@/features/profile/completeness";
import { cn } from "@/lib/utils";

/* Score ring for the Get hired panel. One slice per section, sized by weight.
   Each slice is one solid colour; progress lives in the legend values.
   Hover (or tap) a slice or legend row: it lifts out, the rest blur, and a
   leader line draws out to its value. */

/** Fixed order, one hue per section, from the reference doughnut palette
 *  (its 8 colours in order, plus a teal for the ninth section). */
const COLORS: Record<SectionKey, string> = {
  basic: "#4F6FC4",
  experience: "#D84B7B",
  education: "#B8333F",
  projects: "#E0464A",
  skills: "#FF9A35",
  accomplishments: "#FFC42E",
  resume: "#D4E05A",
  links: "#3BB5A0",
  preferences: "#5591F5",
};

const VB_W = 680;
const VB_H = 400;
const CX = VB_W / 2;
const CY = VB_H / 2;
const R_OUT = 140;
const R_IN = 88;
const LIFT = 12;
/** Half the gap between slices, in degrees. Real gaps, so the page shows through. */
const GAP = 0.7;
/** Where the leader line ends, measured out from the centre. */
const REACH = R_OUT + 70;

function pct(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

function sectionValue(s: SectionStatus): string {
  if (s.complete) return `${pct(s.weight)} ✓`;
  if (s.fraction > 0) return `+${pct(s.weight * (1 - s.fraction))} left`;
  return `+${pct(s.weight)}`;
}

/** Angle in degrees, clockwise from 12 o'clock. */
function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)];
}

function annulus(r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${large} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
}

type Slice = { section: SectionStatus; a0: number; a1: number; mid: number };

function layout(sections: SectionStatus[]): Slice[] {
  const total = sections.reduce((n, s) => n + s.weight, 0) || 1;
  let a = 0;
  return sections.map((section) => {
    const a0 = a;
    a += (section.weight / total) * 360;
    return { section, a0, a1: a, mid: (a0 + a) / 2 };
  });
}

type ScoreDonutProps = {
  score: number;
  sections: SectionStatus[];
  nextKey: SectionKey | null;
};

export function ScoreDonut({ score, sections, nextKey }: ScoreDonutProps) {
  const [active, setActive] = useState<SectionKey | null>(null);
  const slices = layout(sections);
  const current = slices.find((s) => s.section.key === active) ?? null;

  const ring = (
    <>
      {slices.map(({ section: s, a0, a1, mid }) => {
        const isActive = s.key === active;
        const [lx, ly] = polar(LIFT, mid);
        return (
          <g
            key={s.key}
            className={cn("score-slice", active && !isActive && "score-slice--dim")}
            style={{ transform: isActive ? `translate(${(lx - CX).toFixed(2)}px, ${(ly - CY).toFixed(2)}px)` : undefined }}
            filter={isActive ? "url(#score-lift)" : undefined}
          >
            <path d={annulus(R_IN, R_OUT, a0 + GAP, a1 - GAP)} fill={COLORS[s.key]} />
          </g>
        );
      })}
      {/* Hit areas stay put, so a lifting slice never slides out from under
          the pointer and flickers. */}
      {slices.map(({ section: s, a0, a1 }) => (
        <path
          key={s.key}
          d={annulus(R_IN, R_OUT + LIFT, a0, a1)}
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => setActive(s.key)}
          onMouseLeave={() => setActive(null)}
          onClick={() => setActive(s.key === active ? null : s.key)}
        />
      ))}
    </>
  );

  return (
    <div className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-8">
      {/* Tablet and up: ring on the left, with a callout for the hovered slice. */}
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="hidden w-full md:block" aria-hidden="true">
        <defs>
          <filter id="score-lift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="7" floodOpacity="0.22" />
          </filter>
        </defs>
        {ring}
        <text x={CX} y={CY + 7} textAnchor="middle" className="font-heading" fontSize={40} fontWeight={700} fill="#111">
          {score}%
        </text>
        <text x={CX} y={CY + 30} textAnchor="middle" fontSize={12} fill="#4B4B4B">
          profile strength
        </text>
        {current ? <Callout key={current.section.key} slice={current} /> : null}
      </svg>

      {/* Phone: ring alone; the centre shows the tapped section. */}
      <svg viewBox={`${CX - 165} ${CY - 165} 330 330`} className="mx-auto block w-full max-w-[280px] md:hidden" aria-hidden="true">
        {ring}
        {current ? (
          <>
            <text x={CX} y={CY + 2} textAnchor="middle" className="font-heading" fontSize={26} fontWeight={700} fill="#111">
              {sectionValue(current.section)}
            </text>
            <text x={CX} y={CY + 24} textAnchor="middle" fontSize={12} fill="#4B4B4B">
              {current.section.label}
            </text>
          </>
        ) : (
          <>
            <text x={CX} y={CY + 7} textAnchor="middle" className="font-heading" fontSize={40} fontWeight={700} fill="#111">
              {score}%
            </text>
            <text x={CX} y={CY + 30} textAnchor="middle" fontSize={12} fill="#4B4B4B">
              profile strength
            </text>
          </>
        )}
      </svg>

      {/* Legend: right of the ring from tablet up, under it on phones. */}
      <ul className="grid w-full gap-x-6 gap-y-1 sm:grid-cols-2 md:max-w-[380px] md:grid-cols-1 md:justify-self-center">
        <li className="sr-only">Profile strength {score}%.</li>
        {sections.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                s.key === active ? "bg-[#F1F4F4]" : "hover:bg-[#F6F8F8]",
              )}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
              title={s.complete ? undefined : (s.hint ?? undefined)}
            >
              <span className="size-3 shrink-0 rounded-full" style={{ background: COLORS[s.key] }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
                {s.label}
                {s.key === nextKey ? <span className="ml-2 text-xs font-semibold text-[#03535F]">Up next</span> : null}
              </span>
              <span className="shrink-0 text-xs font-semibold text-[#1F1F1F]">{sectionValue(s)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Callout({ slice }: { slice: Slice }) {
  const { section: s, mid } = slice;
  const right = mid < 180;
  const [sx, sy] = polar(R_OUT + LIFT + 4, mid);
  const [ex, rawY] = polar(R_OUT + LIFT + 30, mid);
  // Slices at the very top / bottom would push the label off the chart.
  const ey = Math.min(Math.max(rawY, 18), VB_H - 34);
  const endX = right ? CX + REACH : CX - REACH;
  const textX = right ? endX + 10 : endX - 10;
  const anchor = right ? "start" : "end";
  const color = COLORS[s.key];
  return (
    <g className="score-callout" pointerEvents="none">
      <polyline
        points={`${sx.toFixed(1)},${sy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${endX},${ey.toFixed(1)}`}
        pathLength={1}
        className="score-callout__line"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      <circle cx={endX} cy={ey} r={4.5} fill={color} className="score-callout__text" />
      <text x={textX} y={ey + 7} textAnchor={anchor} className="score-callout__text font-heading" fontSize={22} fontWeight={700} fill="#111">
        {sectionValue(s)}
      </text>
      <text x={textX} y={ey + 26} textAnchor={anchor} fontSize={13} fill="#4B4B4B" className="score-callout__text">
        {s.label}
      </text>
    </g>
  );
}
