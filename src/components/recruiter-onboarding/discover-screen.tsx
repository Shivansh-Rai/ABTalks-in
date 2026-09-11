"use client";

import { motion } from "framer-motion";
import {
  Briefcase,
  FileCode,
  MapPin,
  MoreHorizontal,
  Star,
  StarOff,
  type LucideIcon,
} from "lucide-react";
import {
  LINE_STROKE,
  OnboardingShell,
  drawLine,
  focalEntrance,
  slideIn,
  type HeadingPart,
  type OnboardingScene,
} from "./onboarding-shell";

/*
 * Onboarding 02 / DISCOVER — diagram timeline (the copy column is the shell's):
 *
 *   0.0s  candidate profile card   fade + scale 85% → 100%
 *   1.2s  left connectors          draw from the profile card outward,
 *                                  1.2 / 1.3 / 1.4 / 1.5s
 *         right rail               two segments, 1.2s and 1.4s
 *   2.0s  criteria cards           slide in from −25px, 0.15s apart
 *         match cards              slide in from +25px, 0.15s apart
 *
 * Portraits render as initials until the candidate photos are supplied.
 */

// Authored on the Figma frame's coordinates (a 1050×500 region starting at
// x 570, y 160 of the 1920px frame); the shell scales it to fit. The criteria
// cards run larger than the Figma's, so the region starts 60px further left.
const CANVAS = { w: 1050, h: 500 } as const;
const PROFILE = { x: 401, y: 10, w: 328, h: 479 } as const;

type Criterion = {
  key: string;
  label: string;
  value: string;
  Icon: LucideIcon;
  x: number;
  y: number;
  w: number;
  cardDelay: number;
  /** Starts at the profile card's left edge so the stroke draws outward. */
  path: string;
  lineDelay: number;
};

const CRITERIA: Criterion[] = [
  {
    key: "role",
    label: "Role",
    value: "Product Designer",
    Icon: Briefcase,
    x: 38,
    y: 94,
    w: 190,
    cardDelay: 2.0,
    path: "M401 127H222",
    lineDelay: 1.2,
  },
  {
    key: "location",
    label: "Location",
    value: "Bangalore, India",
    Icon: MapPin,
    x: 28,
    y: 189,
    w: 190,
    cardDelay: 2.15,
    path: "M401 222H212",
    lineDelay: 1.3,
  },
  {
    key: "skills",
    label: "Skills",
    value: "UX/UI, Figma, Design Systems",
    Icon: FileCode,
    x: 18,
    y: 294,
    w: 256,
    cardDelay: 2.3,
    path: "M401 327H268",
    lineDelay: 1.4,
  },
  {
    key: "requirements",
    label: "Requirements",
    value: "Portfolio · User focused",
    Icon: StarOff,
    x: 48,
    y: 398,
    w: 226,
    cardDelay: 2.45,
    path: "M401 431H268",
    lineDelay: 1.5,
  },
];

type Match = {
  key: string;
  score: number;
  name: string;
  role: string;
  y: number;
  delay: number;
};

const MATCH = { x: 787, w: 248, h: 84 } as const;
const MATCHES: Match[] = [
  { key: "riya", score: 89, name: "Riya Mehta", role: "Product Designer", y: 10, delay: 2.0 },
  { key: "arjun", score: 65, name: "Arjun Nair", role: "UX Designer", y: 134, delay: 2.15 },
  { key: "neha", score: 76, name: "Neha Kapoor", role: "Senior Designer", y: 258, delay: 2.3 },
];

// The rail left of the match cards: one dot per card centre, drawn top-down.
const RAIL_X = 768;
const RAIL = [
  { d: `M${RAIL_X} 52V176`, delay: 1.2 },
  { d: `M${RAIL_X} 176V300`, delay: 1.4 },
];
const RAIL_DOTS = [
  { cy: 52, delay: 1.2 },
  { cy: 176, delay: 1.4 },
  { cy: 300, delay: 2.2 },
];

const TOP_SKILLS = ["UX/UI Design", "Figma", "Prototyping", "Design Systems"];

const HEADING: HeadingPart[][] = [
  [{ text: "Meet the" }],
  [{ text: "people " }, { text: "who", accent: true }],
  [{ text: "fit.", accent: true }],
];

// The diagram's place in desk-discover.png and what it must never cover, all
// in the photo's own 1920×845 pixels. The shell keeps the cards clear of these.
const SCENE: OnboardingScene = {
  origin: { x: 570, y: 105 },
  footprint: [
    ...CRITERIA.map((c) => ({ x: c.x, y: c.y, w: c.w, h: 66 })),
    ...MATCHES.map((m) => ({ x: MATCH.x, y: m.y, w: MATCH.w, h: MATCH.h })),
    { x: PROFILE.x, y: PROFILE.y, w: PROFILE.w, h: PROFILE.h },
  ],
  obstacles: [
    { x: 1820, y: 78, w: 100, h: 225 }, // plant
    { x: 1718, y: 266, w: 202, h: 300 }, // her head
    { x: 1478, y: 520, w: 442, h: 325 }, // her shoulders and arm
    { x: 1303, y: 515, w: 280, h: 282 }, // laptop
    { x: 1135, y: 638, w: 124, h: 130 }, // mug
    { x: 818, y: 684, w: 224, h: 106 }, // books
  ],
};

const PORTRAIT_FILL =
  "bg-[linear-gradient(135deg,#EEF6F6_0%,#D4EBEC_100%)] font-heading font-semibold text-[#03535F]/55";

function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("");
}

export function DiscoverScreen() {
  return (
    <OnboardingShell
      step={1}
      heading={HEADING}
      description="Explore relevant candidates, understand their strengths and build your shortlist without the endless scrolling."
      nextHref="/recruiter-onboarding/connect"
      background="/recruiter-onboarding/desk-discover.png"
      scene={SCENE}
      canvas={CANVAS}
    >
      <svg
        className="absolute inset-0"
        width={CANVAS.w}
        height={CANVAS.h}
        viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
        fill="none"
      >
        {CRITERIA.map((c) => (
          <motion.path
            key={c.key}
            d={c.path}
            stroke={LINE_STROKE}
            strokeWidth={1.25}
            strokeLinecap="round"
            {...drawLine(c.lineDelay)}
          />
        ))}
        {RAIL.map((segment) => (
          <motion.path
            key={segment.d}
            d={segment.d}
            stroke={LINE_STROKE}
            strokeWidth={1.25}
            strokeLinecap="round"
            {...drawLine(segment.delay)}
          />
        ))}
        {RAIL_DOTS.map((dot) => (
          <motion.circle
            key={dot.cy}
            cx={RAIL_X}
            cy={dot.cy}
            r={4.5}
            fill={LINE_STROKE}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: dot.delay, duration: 0 }}
          />
        ))}
      </svg>

      {CRITERIA.map((c) => (
        <motion.div
          key={c.key}
          className="absolute flex h-16.5 items-center gap-3 rounded-[10px] border border-[#E6E6E6] bg-white pl-3 pr-3.5 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.18)]"
          style={{ left: c.x, top: c.y, width: c.w }}
          {...slideIn("left", c.cardDelay)}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F4F2] text-[#2F7F86]">
            <c.Icon className="size-5" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.02em] text-[#03535F]">
              {c.label}
            </p>
            <p className="mt-1 whitespace-nowrap text-[12.5px] text-[#2B2B2B]">
              {c.value}
            </p>
          </div>
        </motion.div>
      ))}

      {MATCHES.map((m) => (
        <motion.div
          key={m.key}
          className="absolute flex items-center gap-3 rounded-[10px] border border-[#E6E6E6] bg-white pl-2.5 pr-3 shadow-[0_6px_18px_-12px_rgba(0,0,0,0.18)]"
          style={{ left: MATCH.x, top: m.y, width: MATCH.w, height: MATCH.h }}
          {...slideIn("right", m.delay)}
        >
          <span
            className={`flex h-[62px] w-[54px] shrink-0 items-center justify-center rounded-md text-[15px] ${PORTRAIT_FILL}`}
          >
            {initials(m.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-[19px] font-bold leading-none text-[#03535F]">
              {m.score}%
            </p>
            <p className="mt-2 font-heading text-[11px] font-semibold leading-tight text-[#161616]">
              {m.name}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-[#8A8A8A]">
              {m.role}
            </p>
          </div>
          <MoreHorizontal className="mt-5 size-5 self-start text-[#353535]" />
        </motion.div>
      ))}

      <motion.div
        className="absolute rounded-[12px] border border-[#E6E6E6] bg-white p-[23px] shadow-[0_12px_32px_-16px_rgba(0,0,0,0.22)]"
        style={{ left: PROFILE.x, top: PROFILE.y, width: PROFILE.w, height: PROFILE.h }}
        {...focalEntrance}
      >
        <div
          className={`flex h-[190px] items-center justify-center rounded-md text-[56px] ${PORTRAIT_FILL}`}
        >
          AS
        </div>
        <p className="mt-4 font-heading text-[24px] font-semibold leading-tight text-[#161616]">
          Ananya Sharma
        </p>
        <div className="mt-2">
          <span className="inline-flex rounded-md bg-[#E7F2F3] px-2.5 py-1 text-[12px] font-bold text-[#03535F]">
            Product Designer
          </span>
        </div>
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-[#6B6B6B]">
          Bangalore, India
          <span className="h-3.5 w-px bg-[#A5A5A5]" />
          Experience: 4+ Years
        </p>
        <p className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.02em] text-[#161616]">
          Top skills
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TOP_SKILLS.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-[#D2D2D2] px-2 py-[3px] text-[10px] leading-[14px] text-[#353535]"
            >
              {skill}
            </span>
          ))}
        </div>
        <div className="absolute inset-x-[23px] bottom-[23px] flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#03535F]">
            View Profile
          </span>
          {/* Decorative (the whole diagram is aria-hidden) — clay, Small-ish. */}
          <span className="inline-flex h-[35px] items-center gap-1.5 rounded-[10px] bg-[#03535F] px-[18px] text-[13px] font-semibold text-white shadow-[inset_0_-4px_8px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.14),0_4px_12px_rgba(3,83,95,0.16)]">
            <Star className="size-3.5 fill-current" strokeWidth={1.6} />
            Shortlist
          </span>
        </div>
      </motion.div>
    </OnboardingShell>
  );
}
