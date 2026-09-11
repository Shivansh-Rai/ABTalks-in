"use client";

import { motion } from "framer-motion";
import { Bell, Mail, MapPin, Send, Users, type LucideIcon } from "lucide-react";
import {
  OnboardingShell,
  dropIn,
  focalEntrance,
  type HeadingPart,
  type OnboardingScene,
} from "./onboarding-shell";

/*
 * Onboarding 03 / CONNECT — diagram timeline (the copy column is the shell's):
 *
 *   0.0s  Your Shortlist card   fade + scale 85% → 100%
 *   1.5s  feature cards         roll down 40px, invisible until their moment;
 *                               both columns in step, second row at 1.75s
 *
 * No connector lines on this screen.
 */

// Figma frame region 1100×540 from x 630, y 140. The bottom ~165px is empty
// on purpose: once the shell centres the canvas it keeps the cards high,
// where the design places them above the desk.
const CANVAS = { w: 1100, h: 540 } as const;
const FEATURE = { w: 278, h: 107 } as const;
const SHORTLIST_CARD = { x: 315, y: 11, w: 468, h: 364 } as const;

type Feature = {
  key: string;
  title: string;
  body: string;
  Icon: LucideIcon;
  x: number;
  y: number;
  delay: number;
};

const FEATURES: Feature[] = [
  {
    key: "smart-match",
    title: "Smart Match",
    body: "AI finds profiles that match your needs.",
    Icon: Users,
    x: 11,
    y: 11,
    delay: 1.5,
  },
  {
    key: "shortlist",
    title: "Shortlist",
    body: "Save and organize potential matches.",
    Icon: Send,
    x: 11,
    y: 136,
    delay: 1.75,
  },
  {
    key: "email-templates",
    title: "Email Templates",
    body: "Use proven templates to start conversations.",
    Icon: Mail,
    x: 809,
    y: 11,
    delay: 1.5,
  },
  {
    key: "response-alerts",
    title: "Response Alerts",
    body: "Get notified when someone replies.",
    Icon: Bell,
    x: 809,
    y: 136,
    delay: 1.75,
  },
];

const SHORTLISTED = [
  { name: "Riva Mehta", role: "UI/UX Designer at Swiggy" },
  { name: "Arjun Nair", role: "Product Designer at Razorpay" },
  { name: "Sneha Iyer", role: "UX Researcher at Microsoft" },
];

const HEADING: HeadingPart[][] = [
  [{ text: "Build your" }],
  [{ text: "shortlist and" }],
  [{ text: "start hiring.", accent: true }],
];

// The diagram's place in desk-connect.png and what it must never cover, all
// in the photo's own 1920×845 pixels. The shell keeps the cards clear of these.
const SCENE: OnboardingScene = {
  origin: { x: 630, y: 85 },
  footprint: [
    ...FEATURES.map((f) => ({ x: f.x, y: f.y, w: FEATURE.w, h: FEATURE.h })),
    SHORTLIST_CARD,
  ],
  obstacles: [
    { x: 1813, y: 76, w: 107, h: 216 }, // plant
    { x: 1735, y: 263, w: 185, h: 260 }, // her head
    { x: 1663, y: 493, w: 140, h: 160 }, // her hand at her chin
    { x: 1593, y: 540, w: 327, h: 305 }, // her shoulders
    { x: 1296, y: 544, w: 325, h: 258 }, // laptop
    { x: 1134, y: 641, w: 125, h: 128 }, // mug
    { x: 818, y: 685, w: 224, h: 107 }, // books
  ],
};

function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("");
}

export function ConnectScreen() {
  return (
    <OnboardingShell
      step={2}
      heading={HEADING}
      description="Shortlist the right people, reach out with confidence and start hiring."
      nextHref="/recruiter-onboarding/signup"
      nextLabel="Let’s Go"
      background="/recruiter-onboarding/desk-connect.png"
      scene={SCENE}
      canvas={CANVAS}
    >
      {FEATURES.map((f) => (
        <motion.div
          key={f.key}
          className="absolute flex gap-4 rounded-[12px] border border-[#E6E6E6] bg-white p-5 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.18)]"
          style={{ left: f.x, top: f.y, width: FEATURE.w, height: FEATURE.h }}
          {...dropIn(f.delay)}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#E8F4F2] text-[#2F7F86]">
            <f.Icon className="size-5" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-[17px] font-semibold uppercase leading-tight text-[#03535F]">
              {f.title}
            </p>
            <p className="mt-1.5 text-[14px] leading-5 text-[#555555]">
              {f.body}
            </p>
          </div>
        </motion.div>
      ))}

      <motion.div
        className="absolute rounded-[14px] border border-[#E6E6E6] bg-white p-6 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.22)]"
        style={{
          left: SHORTLIST_CARD.x,
          top: SHORTLIST_CARD.y,
          width: SHORTLIST_CARD.w,
          height: SHORTLIST_CARD.h,
        }}
        {...focalEntrance}
      >
        <div className="flex items-center justify-between">
          <p className="font-heading text-[22px] font-semibold text-[#03535F]">
            Your Shortlist
          </p>
          <span className="rounded-full bg-[#E7F2F3] px-2.5 py-1 text-[12px] font-semibold text-[#03535F]">
            12 people
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {SHORTLISTED.map((person) => (
            <div
              key={person.name}
              className="flex h-[82px] items-center gap-3 rounded-[10px] bg-[#F4F8F8] px-3"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E7F2F3] font-heading text-[15px] font-semibold text-[#03535F]">
                {initials(person.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[14.5px] font-semibold leading-tight text-[#161616]">
                  {person.name}
                </p>
                <p className="mt-1 text-[13px] leading-tight text-[#4B4B4B]">
                  {person.role}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[12px] leading-tight text-[#6B6B6B]">
                  <MapPin className="size-3.5 text-[#03535F]" strokeWidth={2} />
                  Bangalore, India
                </p>
              </div>
              {/* Decorative (the whole diagram is aria-hidden) — clay, small. */}
              <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] bg-[#03535F] px-3.5 text-[13px] font-semibold text-white shadow-[inset_0_-4px_8px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.14),0_4px_12px_rgba(3,83,95,0.16)]">
                <Send className="size-3.5" strokeWidth={2} />
                Shortlist
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </OnboardingShell>
  );
}
