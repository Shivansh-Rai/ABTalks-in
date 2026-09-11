"use client";

import { motion } from "framer-motion";

/*
 * Left panel of the recruiter sign-up screen: an ambient "lava lamp" of
 * blurred blobs behind a four-quote carousel.
 *
 *   Blobs   8s ping-pong loop, forever — each drifts 150–300px and scales
 *           0.8×–1.35×, peaking at 4s and back home at 8s (ease in-out).
 *           This is the one deliberately looping motion in the onboarding.
 *   Quotes  play ONCE over 8s and rest on the last quote. Each: 1.2s hold,
 *           0.8s fade + 12px upward drift, bezier (0.4, 0, 0.2, 1).
 *
 * Both are transform/opacity only, so the app's MotionConfig
 * (reducedMotion="user") stills the blobs for reduced-motion visitors.
 * The panel is decorative and hidden from assistive tech.
 */

const LOOP = 8;
const QUOTE_EASE = [0.4, 0, 0.2, 1] as const;

type Blob = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  dx: number;
  dy: number;
  scale: number;
};

// Authored in the Figma panel's 922×753 space, as percentages below so the
// composition holds at any panel size.
const PANEL = { w: 922, h: 753 } as const;
const BLOBS: Blob[] = [
  { x: -80, y: -60, w: 527, h: 566, color: "#16B386", dx: 250, dy: 180, scale: 1.25 },
  { x: 420, y: -120, w: 527, h: 566, color: "#022B30", dx: -300, dy: 150, scale: 1.3 },
  { x: 300, y: 380, w: 737, h: 469, color: "#3FD8AC", dx: 280, dy: -200, scale: 0.8 },
  { x: 560, y: 120, w: 527, h: 566, color: "#0A4F55", dx: 180, dy: -250, scale: 0.85 },
  { x: -160, y: 420, w: 560, h: 420, color: "#07363B", dx: 200, dy: -150, scale: 1.2 },
  { x: 120, y: 160, w: 480, h: 480, color: "#0F8F74", dx: -180, dy: 220, scale: 0.9 },
  { x: 640, y: -200, w: 420, h: 420, color: "#04323A", dx: -200, dy: 260, scale: 1.15 },
  { x: 700, y: 420, w: 420, h: 420, color: "#2CC99A", dx: -260, dy: -160, scale: 1.3 },
  { x: -120, y: 100, w: 380, h: 380, color: "#1FCB93", dx: 220, dy: 160, scale: 0.85 },
  { x: 260, y: -60, w: 400, h: 340, color: "#05424A", dx: 160, dy: 220, scale: 1.2 },
  { x: 480, y: 520, w: 460, h: 360, color: "#0C6B66", dx: -220, dy: -180, scale: 1.1 },
  { x: 40, y: 560, w: 420, h: 300, color: "#0B5A5C", dx: 260, dy: -120, scale: 0.9 },
  { x: 380, y: 240, w: 360, h: 360, color: "#34D6A6", dx: -150, dy: 200, scale: 1.35 },
];

const QUOTES = [
  {
    text: "Your time is limited, so don’t waste it living someone else’s life",
    author: "Steve Jobs",
  },
  { text: "Hire character. Train skill.", author: "Peter Schutz" },
  {
    text: "Great vision without great people is irrelevant.",
    author: "Jim Collins",
  },
  {
    text: "The secret to successful hiring is to look for people who want to change the world.",
    author: "Marc Benioff",
  },
];

// Keyframes over one 8s pass (times are fractions of it). Each quote holds,
// then transitions for 0.8s; hold segments are linear, transitions eased.
const QUOTE_TRACKS = [
  // 1: visible from 0s, out 1.2s → 2.0s
  { opacity: [1, 1, 0, 0], y: [0, 0, -12, -12], times: [0, 0.15, 0.25, 1] },
  // 2: in 2.0s → 2.8s, hold, out 4.0s → 4.8s
  {
    opacity: [0, 0, 1, 1, 0, 0],
    y: [12, 12, 0, 0, -12, -12],
    times: [0, 0.25, 0.35, 0.5, 0.6, 1],
  },
  // 3: in 4.0s → 4.8s, hold, out 6.0s → 6.8s
  {
    opacity: [0, 0, 1, 1, 0, 0],
    y: [12, 12, 0, 0, -12, -12],
    times: [0, 0.5, 0.6, 0.75, 0.85, 1],
  },
  // 4: in 6.0s → 6.8s, then stays
  { opacity: [0, 0, 1, 1], y: [12, 12, 0, 0], times: [0, 0.75, 0.85, 1] },
];

/** Per-segment easing: linear across holds, the editorial curve on moves. */
function segmentEase(track: { opacity: number[] }) {
  return track.opacity
    .slice(1)
    .map((to, i) => (to === track.opacity[i] ? "linear" : QUOTE_EASE));
}

const pct = (value: number, of: number) => `${(value / of) * 100}%`;

export function SignupQuotePanel() {
  return (
    // clip-path as well as overflow: Chrome lets blurred, transformed layers
    // escape an overflow + border-radius clip, which squared off the corners.
    <div
      aria-hidden
      className="relative h-full w-full overflow-hidden rounded-[36px] bg-[#073B40] [clip-path:inset(0_round_36px)]"
    >
      <div className="absolute inset-0">
        {BLOBS.map((b, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full blur-[70px] will-change-transform"
            style={{
              left: pct(b.x, PANEL.w),
              top: pct(b.y, PANEL.h),
              width: pct(b.w, PANEL.w),
              height: pct(b.h, PANEL.h),
              backgroundColor: b.color,
            }}
            animate={{
              x: [0, b.dx, 0],
              y: [0, b.dy, 0],
              scale: [1, b.scale, 1],
            }}
            transition={{
              duration: LOOP,
              times: [0, 0.5, 1],
              ease: "easeInOut",
              repeat: Infinity,
            }}
          />
        ))}
      </div>

      {/* All four quotes share one grid cell, bottom-aligned, so quotes of
          different lengths sit on the same baseline area. */}
      <div className="absolute inset-x-[5.3%] bottom-[9%] grid">
        {QUOTES.map((quote, i) => {
          const track = QUOTE_TRACKS[i];
          return (
            <motion.figure
              key={quote.author}
              className="col-start-1 row-start-1 self-end"
              initial={{ opacity: track.opacity[0], y: track.y[0] }}
              animate={{ opacity: track.opacity, y: track.y }}
              transition={{
                duration: LOOP,
                times: track.times,
                ease: segmentEase(track),
              }}
            >
              <blockquote className="font-heading text-[clamp(30px,3.1vw,60px)] font-medium leading-[1.17] tracking-[-0.01em] text-white">
                {quote.text}
              </blockquote>
              <figcaption className="mt-4 text-right font-heading text-[clamp(16px,1.25vw,24px)] text-white/90">
                — {quote.author}
              </figcaption>
            </motion.figure>
          );
        })}
      </div>
    </div>
  );
}
