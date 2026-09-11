"use client";

import { motion } from "framer-motion";
import {
  Award,
  Briefcase,
  FileCode,
  GraduationCap,
  MapPin,
  StarOff,
  UserCog,
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
 * Onboarding 01 / DEFINE — diagram timeline (the copy column is the shell's):
 *
 *   0.0s  Role Brief card   fade + scale 85% → 100%
 *   1.2s  connector lines   path-trim outward, three waves 0.1s apart
 *   2.0s  criteria cards    fade + slide ±25px, pairs 0.15s apart
 */

// The diagram is authored on the Figma frame's own coordinates (a 920×590
// region of the 1920px frame) and scaled as one unit to fit the space left.
const CANVAS = { w: 920, h: 590 } as const;

type Criterion = {
  key: string;
  label: string;
  lines: string[];
  Icon: LucideIcon;
  side: "left" | "right";
  x: number;
  y: number;
  w: number;
  cardDelay: number;
  /** Starts at the Role Brief card so the stroke draws outward. */
  path: string;
  lineDelay: number;
};

const CRITERIA: Criterion[] = [
  {
    key: "role",
    label: "Role",
    lines: ["Product Designer"],
    Icon: Briefcase,
    side: "left",
    x: 46,
    y: 61,
    w: 194,
    cardDelay: 2.0,
    path: "M342 212L232 128",
    lineDelay: 1.2,
  },
  {
    key: "skills",
    label: "Skills",
    lines: ["UX/UI, Figma, Design System", "User Research, Prototyping"],
    Icon: FileCode,
    side: "right",
    x: 555,
    y: 12,
    w: 272,
    cardDelay: 2.0,
    path: "M552 210L650 102",
    lineDelay: 1.2,
  },
  {
    key: "location",
    label: "Location",
    lines: ["Bangalore, India"],
    Icon: MapPin,
    side: "left",
    x: 16,
    y: 256,
    w: 188,
    cardDelay: 2.15,
    path: "M339 311H196",
    lineDelay: 1.3,
  },
  {
    key: "requirements",
    label: "Requirements",
    lines: ["Bring portfolio", "Problem solver", "User focused mindset"],
    Icon: StarOff,
    side: "right",
    x: 680,
    y: 190,
    w: 227,
    cardDelay: 2.15,
    path: "M558 269H688",
    lineDelay: 1.3,
  },
  {
    key: "experience-left",
    label: "Experience",
    lines: ["3–5 Years"],
    Icon: GraduationCap,
    side: "left",
    x: 56,
    y: 491,
    w: 172,
    cardDelay: 2.3,
    path: "M342 457L220 497",
    lineDelay: 1.4,
  },
  {
    key: "experience-right",
    label: "Experience",
    lines: ["3–5 Years"],
    Icon: Award,
    side: "right",
    x: 664,
    y: 394,
    w: 171,
    cardDelay: 2.3,
    path: "M558 417L672 434",
    lineDelay: 1.4,
  },
];

const HEADING: HeadingPart[][] = [
  [{ text: "Tell us who" }],
  [{ text: "you're " }, { text: "looking", accent: true }],
  [{ text: "for." }],
];

// The diagram's place in desk-define.png and what it must never cover, all in
// the photo's own 1920×845 pixels. The shell keeps the cards clear of these.
const SCENE: OnboardingScene = {
  origin: { x: 620, y: 65 },
  footprint: [
    { x: 46, y: 61, w: 194, h: 78 }, // role
    { x: 555, y: 12, w: 272, h: 95 }, // skills
    { x: 16, y: 256, w: 188, h: 78 }, // location
    { x: 680, y: 190, w: 227, h: 117 }, // requirements
    { x: 56, y: 491, w: 172, h: 78 }, // experience (left)
    { x: 664, y: 394, w: 171, h: 78 }, // experience (right)
    { x: 339, y: 211, w: 218, h: 248 }, // role brief
  ],
  obstacles: [
    { x: 1080, y: 695, w: 270, h: 95 }, // books
    { x: 1285, y: 553, w: 140, h: 185 }, // plant
    { x: 1408, y: 670, w: 145, h: 125 }, // mug
    { x: 1543, y: 520, w: 377, h: 280 }, // laptop
  ],
};

export function DefineRoleScreen() {
  return (
    <OnboardingShell
      step={0}
      heading={HEADING}
      description="Set the role, skills and requirements that matter. ABTalks turns your brief into a focused hiring journey."
      nextHref="/recruiter-onboarding/discover"
      background="/recruiter-onboarding/desk-define.png"
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
            strokeWidth={1.5}
            strokeLinecap="round"
            {...drawLine(c.lineDelay)}
          />
        ))}
      </svg>

      {CRITERIA.map((c) => (
        <motion.div
          key={c.key}
          className="absolute rounded-[10px] border border-[#E6E6E6] bg-white py-4.5 pl-4 pr-3 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.18)]"
          style={{ left: c.x, top: c.y, width: c.w }}
          {...slideIn(c.side, c.cardDelay)}
        >
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F4F2] text-[#2F7F86]">
              <c.Icon className="size-5" strokeWidth={1.6} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[12px] font-bold uppercase tracking-[0.02em] text-[#03535F]">
                {c.label}
              </p>
              {c.lines.map((line) => (
                <p
                  key={line}
                  className="mt-1 whitespace-nowrap text-[12.5px] leading-[1.45] text-[#2B2B2B]"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </motion.div>
      ))}

      <motion.div
        className="absolute rounded-[10px] border border-[#E6E6E6] bg-white p-[22px] shadow-[0_12px_32px_-16px_rgba(0,0,0,0.22)]"
        style={{ left: 339, top: 211, width: 218, height: 248 }}
        {...focalEntrance}
      >
        <span className="flex size-[50px] items-center justify-center rounded-lg bg-[#03535F] text-white">
          <UserCog className="size-6" strokeWidth={1.6} />
        </span>
        <p className="mt-[22px] text-[14px] font-bold uppercase tracking-[0.01em] text-[#03535F]">
          Role Brief
        </p>
        <p className="mt-4 text-[14px] leading-[1.45] text-[#2B2B2B]">
          We&apos;ll find the right people who match your requirements.
        </p>
      </motion.div>
    </OnboardingShell>
  );
}
