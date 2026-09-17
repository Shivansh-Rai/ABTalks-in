"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion, type Transition, type Variants } from "framer-motion";
import { EASE_SPARK, EASE_SPARK_SOFT } from "@/lib/motion";

/*
 * The recruiter onboarding's motion language, in one place. Components pick
 * variants from here; none of them define their own curves or timings.
 *
 *   Step change (desktop, "depth")
 *     forward   the current card lifts up and away (scale .96, tilts ~1.5°
 *               back, recedes) while the next rises out of the stack below it
 *               (from scale .955, 2° tilt, 90px deeper) and straightens.
 *     back      the same poses, swapped: the current card sinks back into the
 *               stack and the previous one comes down to the front.
 *   Phones and tablets ("slide")   a plain horizontal slide, no perspective.
 *   Reduced motion ("fade")        opacity with an 8px nudge, nothing else.
 *
 *   Inside a card   heading → description → fields → actions, 60ms apart.
 *
 * Nothing here waits: the step state changes on click and both cards animate
 * at once, so a recruiter can type into the new step before it has settled.
 * Only transform and opacity are animated.
 */

export type Direction = 1 | -1;
export type MotionMode = "depth" | "slide" | "fade";
/** `instant` restores a saved step on load without playing a transition. */
export type StepMotion = { dir: Direction; mode: MotionMode; instant?: boolean };

export const PERSPECTIVE_PX = 1400;
export const VISUAL_PERSPECTIVE_PX = 1600;

const ENTER_S = 0.62;
const EXIT_S = 0.36;
export const STAGGER_S = 0.06;

/** Resting in the stack, below and behind the active card. */
const STACKED = { opacity: 0, y: 28, z: -90, rotateX: 2, scale: 0.955 };
/** Lifted away above the active card. */
const LIFTED = { opacity: 0, y: -18, z: -60, rotateX: 1.5, scale: 0.96 };
const SETTLED = { opacity: 1, x: 0, y: 0, z: 0, rotateX: 0, scale: 1 };

function enterPose({ dir, mode }: StepMotion) {
  if (mode === "fade") return { opacity: 0, y: dir * 8 };
  if (mode === "slide") return { opacity: 0, x: dir * 28 };
  return dir === 1 ? STACKED : LIFTED;
}

function exitPose({ dir, mode }: StepMotion) {
  if (mode === "fade") return { opacity: 0 };
  if (mode === "slide") return { opacity: 0, x: dir * -20 };
  return dir === 1 ? LIFTED : STACKED;
}

/**
 * The step card. Forward, the outgoing card paints above the incoming one (it
 * is lifting off the stack); back, the incoming card is the one in front.
 */
export const stepVariants: Variants = {
  enter: (m: StepMotion) => ({ ...enterPose(m), zIndex: m.dir === 1 ? 0 : 1 }),
  center: (m: StepMotion) => ({
    ...SETTLED,
    zIndex: m.dir === 1 ? 0 : 1,
    transition: {
      duration: m.instant ? 0 : m.mode === "fade" ? 0.24 : ENTER_S,
      ease: EASE_SPARK,
      delayChildren: m.instant ? 0 : 0.08,
      // Kept in "fade": MotionConfig (reducedMotion="user") already strips the
      // items' translate for reduced-motion visitors, leaving a quiet opacity
      // sequence — and the first load uses "fade" for everyone.
      staggerChildren: m.instant ? 0 : STAGGER_S,
    },
  }),
  exit: (m: StepMotion) => ({
    ...exitPose(m),
    zIndex: m.dir === 1 ? 1 : 0,
    transition: {
      duration: m.instant ? 0 : m.mode === "fade" ? 0.16 : EXIT_S,
      ease: EASE_SPARK_SOFT,
    },
  }),
};

/** One group inside a step: the heading, the copy, a field, the actions. */
export const staggerItem: Variants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_SPARK } },
  exit: {},
};

/** Same stagger for content that swaps inside one step (e.g. code phase). */
export const staggerContainer: Variants = {
  enter: {},
  center: { transition: { staggerChildren: STAGGER_S } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};

/** Skill chips and other small confirmations: scale in, never bounce. */
export const chipVariants: Variants = {
  enter: { opacity: 0, scale: 0.85 },
  center: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: EASE_SPARK } },
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.14, ease: EASE_SPARK_SOFT } },
};

/**
 * Supporting-visual layers settle a beat after the form, and deeper layers a
 * little later still, so the two columns read as separate planes.
 */
export function visualTransition(layer: number, instant = false): Transition {
  if (instant) return { duration: 0 };
  return { duration: 0.75, ease: EASE_SPARK, delay: 0.08 + layer * 0.035 };
}

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** False on the server and on first hydration, then the real answer. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

export function useMotionMode(): MotionMode {
  const reduced = useReducedMotion() ?? false;
  const desktop = useIsDesktop();
  if (reduced) return "fade";
  return desktop ? "depth" : "slide";
}
