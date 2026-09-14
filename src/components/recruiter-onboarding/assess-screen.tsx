"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Check,
  Clock,
  Eye,
  FileText,
  Star,
  Users,
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
 * Onboarding 04 / ASSESS: diagram timeline (the copy column is the shell's):
 *
 *   0.0s  Create an assessment card   fade + scale 85% → 100%
 *   1.2s  connectors                  draw from the builder card outward,
 *                                     1.2 / 1.3 / 1.4s
 *   2.0s  left feature cards          slide in from −25px, 0.15s apart
 *         right feature cards         slide in from +25px, 0.15s apart
 */

// Authored on the Figma frame's coordinates (a 1240×650 region starting at
// x 480, y 110 of the 1920px frame); the shell scales it to fit.
const CANVAS = { w: 1240, h: 650 } as const;
const BUILDER = { x: 290, y: 0, w: 660, h: 640 } as const;

type Feature = {
  key: string;
  title: string;
  body: string;
  Icon: LucideIcon;
  side: "left" | "right";
  x: number;
  y: number;
  w: number;
  h: number;
  cardDelay: number;
  /** Starts at the builder card's edge so the stroke draws outward. */
  path: string;
  lineDelay: number;
};

const FEATURES: Feature[] = [
  {
    key: "customise",
    title: "Customise",
    body: "Add questions, set duration and pass marks.",
    Icon: FileText,
    side: "left",
    x: 0,
    y: 40,
    w: 262,
    h: 112,
    cardDelay: 2.0,
    path: "M290 157H276V104Q276 96 268 96H262",
    lineDelay: 1.2,
  },
  {
    key: "question-types",
    title: "Flexible question types",
    body: "MCQs, coding, subjective and more.",
    Icon: Star,
    side: "left",
    x: 0,
    y: 229,
    w: 262,
    h: 128,
    cardDelay: 2.15,
    path: "M290 306H262",
    lineDelay: 1.3,
  },
  {
    key: "multiple-candidates",
    title: "For multiple candidates",
    body: "Send to your shortlist in just a few clicks.",
    Icon: Users,
    side: "left",
    x: 0,
    y: 444,
    w: 262,
    h: 128,
    cardDelay: 2.3,
    path: "M290 474H276V500Q276 508 268 508H262",
    lineDelay: 1.4,
  },
  {
    key: "preview",
    title: "Preview",
    body: "See exactly what candidates will see.",
    Icon: Eye,
    side: "right",
    x: 978,
    y: 42,
    w: 262,
    h: 124,
    cardDelay: 2.0,
    path: "M950 187H964V112Q964 104 972 104H978",
    lineDelay: 1.2,
  },
  {
    key: "insights",
    title: "Get better insights",
    body: "Evaluate responses and identify top talent.",
    Icon: BarChart3,
    side: "right",
    x: 978,
    y: 256,
    w: 262,
    h: 124,
    cardDelay: 2.15,
    path: "M950 342H978",
    lineDelay: 1.3,
  },
];

const HEADING: HeadingPart[][] = [
  [{ text: "Create" }],
  [{ text: "assessments" }],
  [{ text: "with " }, { text: "ease.", accent: true }],
];

// The diagram's place in desk-assess.png and what it must never cover, all in
// the photo's own 1920×845 pixels. The shell keeps the cards clear of these.
// The note and plant boxes are tight on purpose: the design lets cards brush
// the corkboard frame and the outermost leaf tips.
const SCENE: OnboardingScene = {
  origin: { x: 480, y: 110 },
  footprint: [
    ...FEATURES.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h })),
    BUILDER,
  ],
  obstacles: [
    { x: 1745, y: 30, w: 125, h: 170 }, // "Assess Learn Grow" note
    { x: 1790, y: 220, w: 130, h: 310 }, // plant
    { x: 1620, y: 475, w: 105, h: 215 }, // pencil cup
    { x: 1733, y: 565, w: 170, h: 155 }, // mug
    { x: 1212, y: 685, w: 570, h: 160 }, // assessment sheet
  ],
};

const FIELD_LABEL = "text-[12.5px] font-semibold leading-none text-[#161616]";
const FIELD_INPUT =
  "flex h-[34px] items-center rounded-[7px] border border-[#E3E3E3] bg-white px-3 text-[12px] text-[#8A8A8A]";

export function AssessScreen() {
  return (
    <OnboardingShell
      step={3}
      heading={HEADING}
      description="Build custom assessments, test the right skills and get deeper insights so you hire with confidence."
      nextHref="/recruiter-onboarding/signup"
      nextLabel="Let’s Go"
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
        {FEATURES.map((f) => (
          <motion.path
            key={f.key}
            d={f.path}
            stroke={LINE_STROKE}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...drawLine(f.lineDelay)}
          />
        ))}
      </svg>

      {FEATURES.map((f) => (
        <motion.div
          key={f.key}
          className="absolute flex gap-3.5 rounded-[12px] border border-[#E6E6E6] bg-white py-4 pl-4 pr-4 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.18)]"
          style={{ left: f.x, top: f.y, width: f.w, height: f.h }}
          {...slideIn(f.side, f.cardDelay)}
        >
          <span className="flex size-[54px] shrink-0 items-center justify-center rounded-lg bg-[#E8F4F2] text-[#2F7F86]">
            <f.Icon className="size-[26px]" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-heading text-[15.5px] font-semibold uppercase leading-[1.3] text-[#03535F]">
              {f.title}
            </p>
            <p className="mt-1.5 text-[14px] leading-[1.45] text-[#555555]">
              {f.body}
            </p>
          </div>
        </motion.div>
      ))}

      <motion.div
        className="absolute flex flex-col rounded-[16px] border border-[#E6E6E6] bg-white p-[26px] shadow-[0_12px_32px_-16px_rgba(0,0,0,0.22)]"
        style={{
          left: BUILDER.x,
          top: BUILDER.y,
          width: BUILDER.w,
          height: BUILDER.h,
        }}
        {...focalEntrance}
        data-focal
      >
        <p className="font-heading text-[24px] font-semibold leading-tight text-[#161616]">
          Create an assessment
        </p>
        <p className="mt-1 text-[14px] text-[#6B6B6B]">
          For 6 shortlisted candidates
        </p>

        <div className="mt-5 grid min-h-0 flex-1 grid-cols-[1fr_1fr] gap-6">
          {/* Builder form */}
          <div className="flex flex-col gap-3 rounded-[10px] bg-[#FAFAFA] p-3.5">
            <div className="space-y-1.5">
              <p className={FIELD_LABEL}>Assessment Title</p>
              <div className={FIELD_INPUT}>e.g. Backend fundamentals screen</div>
            </div>
            <div className="space-y-1.5">
              <p className={FIELD_LABEL}>Subheading</p>
              <div className={FIELD_INPUT}>Optional one-liner under the title</div>
            </div>
            <div className="space-y-1.5">
              <p className={FIELD_LABEL}>Instructions</p>
              <div className={`${FIELD_INPUT} h-[76px] items-start pt-2.5`}>
                What the candidate should know before starting
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className={`${FIELD_LABEL} w-[64px] leading-[1.3]`}>
                Duration (minutes)
              </p>
              <div className={`${FIELD_INPUT} w-[96px]`} />
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#161616]">
                <span className="flex size-4 items-center justify-center rounded-[3px] bg-[#0E7F8A] text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                Untimed
              </span>
            </div>
            <div className="flex items-center gap-3">
              <p className={`${FIELD_LABEL} w-[64px] leading-[1.3]`}>
                Pass mark %
              </p>
              <div className={`${FIELD_INPUT} w-[84px] text-[#161616]`}>60</div>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#161616]">Questions</p>
              <span className="text-[12px] font-semibold text-[#0E7F8A]">
                Add question
              </span>
            </div>
            <div className="min-h-0 flex-1 rounded-[7px] border border-[#E3E3E3] bg-white">
              <div className="grid grid-cols-2 gap-4 rounded-t-[7px] bg-[#F3F3F3] px-3.5 py-2.5 text-[11.5px] font-semibold text-[#161616]">
                <span>Type</span>
                <span>Points</span>
              </div>
              <div className="space-y-3 px-3.5 py-3">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="grid grid-cols-2 gap-4">
                    <span className="h-2.5 rounded-full bg-[#ECECEC]" />
                    <span className="h-2.5 rounded-full bg-[#ECECEC]" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Candidate preview */}
          <div className="flex flex-col gap-3">
            <p className="rounded-[7px] bg-[#FFF3EA] px-3 py-2.5 text-[11px] leading-[1.45] text-[#D9622B]">
              Preview of what the candidate will see. Answers are not saved.
            </p>
            <div className="rounded-[10px] border border-[#E6E6E6] p-3.5">
              <p className="font-heading text-[19px] font-semibold leading-tight text-[#161616]">
                Untitled assessment
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="flex items-center gap-1 rounded-full bg-[#E7F2F3] px-2.5 py-1 text-[#03535F]">
                  <Clock className="size-3" strokeWidth={2.5} />
                  Untimed
                </span>
                <span className="rounded-full bg-[#F1F1F1] px-2.5 py-1 text-[#353535]">
                  1 question
                </span>
                <span className="rounded-full bg-[#F1F1F1] px-2.5 py-1 text-[#353535]">
                  Pass mark 60%
                </span>
              </div>
            </div>
            <div className="rounded-[10px] border border-[#E6E6E6] p-3.5">
              <div className="flex gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E7F2F3] text-[10px] font-bold text-[#03535F]">
                  Q1
                </span>
                <div>
                  <p className="text-[13px] font-semibold leading-tight text-[#161616]">
                    Untitled question <span className="text-[#D9442B]">*</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6B6B6B]">
                    1 pt · Choose one
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {["Option 1", "Option 2"].map((option) => (
                  <div
                    key={option}
                    className="flex h-[34px] items-center gap-2.5 rounded-[7px] border border-[#E3E3E3] px-3 text-[12px] text-[#353535]"
                  >
                    <span className="size-3.5 rounded-full border border-[#C9C9C9]" />
                    {option}
                  </div>
                ))}
              </div>
            </div>
            {/* Decorative (the whole diagram is aria-hidden): the disabled submit. */}
            <span className="flex h-[40px] items-center justify-center rounded-[7px] bg-[#6FA7AD] text-[13px] font-semibold text-white">
              Submit assessment
            </span>
          </div>
        </div>
      </motion.div>
    </OnboardingShell>
  );
}
