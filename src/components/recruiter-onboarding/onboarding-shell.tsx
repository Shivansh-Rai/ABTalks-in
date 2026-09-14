"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, stagger, useAnimate } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { dsButtonVariants } from "@/components/design/ds-button";
import { cn } from "@/lib/utils";
import { useOnboardingStory } from "./onboarding-story";

/*
 * Shared frame for the recruiter onboarding screens (01 Define, 02 Discover,
 * 03 Connect, 04 Assess). Each screen supplies only its diagram; the frame
 * owns the header, copy column and CTAs so every screen stays identical. The
 * background photo lives one level up, in the story layout, so it persists
 * across screens (see onboarding-story.tsx).
 *
 * Entrance — every animation runs once on mount and then holds:
 *
 *   0.0s–3.1s  the screen's diagram (see the helpers below)
 *   3.2s  label · 3.4s heading types out at 40ms/char · 3.6s copy
 *   3.75s steps · 3.9s Next · 4.05s Skip
 *
 * Exit — Next rewinds the screen before navigating, so the story flows on:
 *
 *   0.0s   copy lifts away, blurring, 60ms apart · connectors fade
 *   0.05s  satellite cards gather back into the focal card, shrinking (0.9s)
 *   0.3s   the background starts morphing to the next photo (2.6s sweep)
 *   0.5s   the focal card shrinks back to 85% and fades (0.8s)
 *   1.3s   navigate — the next screen's entrance plays as the light sweeps on
 *
 * Screens mark their focal card with `data-focal`; everything else directly
 * inside the diagram is a satellite (cards) or the connector svg.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_IN = [0.7, 0, 0.84, 0] as const;
export const DURATION = 0.8;
export const LINE_STROKE = "#5C5C5C";
const TYPE_START = 3.4;
const TYPE_STEP = 0.04;
const STEPS = ["Define", "Discover", "Connect", "Assess"] as const;
/** How far satellites travel toward the focal card's centre as they gather. */
const GATHER = 0.6;
const MORPH_DELAY_MS = 300;

/**
 * DS v2 §9A clay depth, layered on `dsButtonVariants` — shared by every
 * onboarding CTA so they stay identical: lower inset shade + restrained teal
 * elevation; hover lifts the elevation; pressed is #02434D with deeper inset.
 * `[a]:` matches dsButtonVariants' own `[a]:hover:` rule, which otherwise
 * out-specifies a plain `active:` on links and keeps #076573.
 */
export const CLAY_CTA = [
  "shadow-[inset_0_-4px_8px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.14),0_4px_12px_rgba(3,83,95,0.16)]",
  "hover:shadow-[inset_0_-4px_8px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.14),0_8px_20px_rgba(3,83,95,0.28)]",
  "active:!bg-[#02434D] [a]:active:!bg-[#02434D] active:shadow-[inset_0_-1px_3px_rgba(0,0,0,0.28),inset_0_3px_6px_rgba(0,0,0,0.40),0_2px_6px_rgba(3,83,95,0.14)]",
  "disabled:shadow-none",
].join(" ");

export function fadeUp(delay: number, y = 20) {
  return {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: DURATION, ease: EASE },
  };
}

/** Focal card: fade + scale 85% → 100%, starting the timeline at 0s. */
export const focalEntrance = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 1.2, ease: EASE },
};

/** Connector: snaps visible, then its stroke draws from the path's start. */
export function drawLine(delay: number) {
  return {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: {
      pathLength: { delay, duration: DURATION, ease: EASE },
      opacity: { delay, duration: 0 },
    },
  };
}

/** Satellite card: fades in while sliding 25px in from its side. */
export function slideIn(side: "left" | "right", delay: number) {
  return {
    initial: { opacity: 0, x: side === "left" ? -25 : 25 },
    animate: { opacity: 1, x: 0 },
    transition: { delay, duration: DURATION, ease: EASE },
  };
}

/**
 * Satellite card that rolls down: invisible until its moment, then drops
 * 40px into place while fading in over 0.6s.
 */
export function dropIn(delay: number) {
  return {
    initial: { opacity: 0, y: -40 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.6, ease: EASE },
  };
}

export type HeadingPart = { text: string; accent?: boolean };

type Rect = { x: number; y: number; w: number; h: number };

/**
 * How a diagram sits in its background photo, so the cards never cover the
 * photo's objects. `origin` (the canvas's top-left, as the Figma frame places
 * it) and `obstacles` (mug, laptop, person…) are in the photo's own 1920×845
 * pixels; `footprint` is the cards' boxes in canvas pixels.
 */
export type OnboardingScene = {
  origin: { x: number; y: number };
  footprint: Rect[];
  obstacles: Rect[];
};

const PHOTO = { w: 1920, h: 845 } as const;
const EDGE = 16; // keep cards this far inside the stage
const CLEARANCE = 12; // and at least this far from any photo object
const MIN_SCENE_SCALE = 0.45;

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function clamp(value: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(value, hi));
}

/**
 * Desktop placement against the photo. The photo is object-cover anchored
 * bottom-right, so its objects land somewhere computable for any stage size.
 * Start from the mockup's placement (the canvas origin mapped through the
 * photo's own transform), then take the largest scale — never above the
 * photo's — at which no card touches an object, the copy column or the stage
 * edge. Null when nothing fits; the caller then falls back to a plain fit.
 */
function placeInScene(
  stage: { w: number; h: number },
  minLeft: number,
  canvas: { w: number; h: number },
  scene: OnboardingScene,
): { left: number; top: number; scale: number } | null {
  const s = Math.max(stage.w / PHOTO.w, stage.h / PHOTO.h);
  const ox = stage.w - PHOTO.w * s;
  const oy = stage.h - PHOTO.h * s;
  const obstacles = scene.obstacles.map((o) => ({
    x: ox + o.x * s - CLEARANCE,
    y: oy + o.y * s - CLEARANCE,
    w: o.w * s + 2 * CLEARANCE,
    h: o.h * s + 2 * CLEARANCE,
  }));

  // Bounds of the cards themselves — a canvas may carry empty margins.
  const fx0 = Math.min(...scene.footprint.map((f) => f.x));
  const fx1 = Math.max(...scene.footprint.map((f) => f.x + f.w));
  const fy0 = Math.min(...scene.footprint.map((f) => f.y));
  const fy1 = Math.max(...scene.footprint.map((f) => f.y + f.h));

  const top0 = oy + scene.origin.y * s;
  const centre0 = ox + (scene.origin.x + canvas.w / 2) * s;
  const maxScale = Math.min(
    s,
    1.25,
    (stage.w - EDGE - minLeft) / (fx1 - fx0),
    (stage.h - 2 * EDGE) / (fy1 - fy0),
  );

  for (let d = maxScale; d >= MIN_SCENE_SCALE; d -= 0.01) {
    const left = clamp(
      centre0 - (canvas.w * d) / 2,
      minLeft - fx0 * d,
      stage.w - EDGE - fx1 * d,
    );
    const top = clamp(top0, EDGE - fy0 * d, stage.h - EDGE - fy1 * d);
    const clear = scene.footprint.every((f) => {
      const card = { x: left + f.x * d, y: top + f.y * d, w: f.w * d, h: f.h * d };
      return obstacles.every((o) => !overlaps(card, o));
    });
    if (clear) return { left, top, scale: d };
  }
  return null;
}

type Props = {
  step: 0 | 1 | 2 | 3;
  /** One array per visual line; parts carry their own spacing. */
  heading: HeadingPart[][];
  description: string;
  nextHref: string;
  /** The final screen closes the flow with its own label. */
  nextLabel?: string;
  /**
   * Where the diagram sits in the story's background photo and what it must
   * not cover. On desktop the diagram is placed against the photo so cards
   * never overlap its objects; without it, the diagram simply fits its column.
   */
  scene?: OnboardingScene;
  /** The diagram's authored size — it is scaled as one unit to fit. */
  canvas: { w: number; h: number };
  children: ReactNode;
};

export function OnboardingShell({
  step,
  heading,
  description,
  nextHref,
  nextLabel = "Next",
  scene,
  canvas,
  children,
}: Props) {
  const router = useRouter();
  const story = useOnboardingStory();
  const [scope, animateScope] = useAnimate<HTMLDivElement>();
  const leaving = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [placement, setPlacement] = useState<{
    left: number;
    top: number;
    scale: number;
  } | null>(null);

  useLayoutEffect(() => {
    const stageEl = stageRef.current;
    const cellEl = fitRef.current;
    if (!stageEl || !cellEl) return;
    const desktop = window.matchMedia("(min-width: 1024px)");

    const update = () => {
      const stage = stageEl.getBoundingClientRect();
      const cell = cellEl.getBoundingClientRect();
      if (scene && desktop.matches) {
        const cellLeft = cell.left - stage.left;
        const cellTop = cell.top - stage.top;
        const placed = placeInScene(
          { w: stage.width, h: stage.height },
          cellLeft + 8,
          canvas,
          scene,
        );
        if (placed) {
          // Stored relative to the diagram cell, which positions the canvas.
          setPlacement({
            left: placed.left - cellLeft,
            top: placed.top - cellTop,
            scale: placed.scale,
          });
          return;
        }
      }
      setPlacement(null);
      const pad = getComputedStyle(cellEl);
      const w = cell.width - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      const h = cell.height - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
      // Never upscale past the design size.
      setScale(Math.min(w / canvas.w, h / canvas.h, 1));
    };

    const observer = new ResizeObserver(update);
    observer.observe(stageEl);
    observer.observe(cellEl);
    desktop.addEventListener("change", update);
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", update);
    };
  }, [canvas, scene]);

  // The exit only navigates once it has played, so have the route ready.
  useEffect(() => {
    router.prefetch(nextHref);
  }, [router, nextHref]);

  function playExit() {
    const runs = [
      animateScope(
        "[data-story='copy']",
        { opacity: 0, y: -14, filter: "blur(4px)" },
        { duration: 0.6, delay: stagger(0.06), ease: EASE_IN },
      ),
    ];

    const diagram = scope.current.querySelector<HTMLElement>("[data-story='diagram']");
    if (diagram) {
      const focal = diagram.querySelector<HTMLElement>(":scope > [data-focal]");
      // Offsets are the diagram's own unscaled pixels, the space the cards
      // are transformed in, so the gather lines up at any fit scale.
      const fx = focal ? focal.offsetLeft + focal.offsetWidth / 2 : diagram.offsetWidth / 2;
      const fy = focal ? focal.offsetTop + focal.offsetHeight / 2 : diagram.offsetHeight / 2;

      diagram.querySelectorAll<SVGSVGElement>(":scope > svg").forEach((lines) => {
        runs.push(animateScope(lines, { opacity: 0 }, { duration: 0.5, ease: EASE_IN }));
      });
      diagram
        .querySelectorAll<HTMLElement>(":scope > div:not([data-focal])")
        .forEach((card, i) => {
          const cx = card.offsetLeft + card.offsetWidth / 2;
          const cy = card.offsetTop + card.offsetHeight / 2;
          runs.push(
            animateScope(
              card,
              { x: (fx - cx) * GATHER, y: (fy - cy) * GATHER, scale: 0.6, opacity: 0 },
              { duration: 0.9, delay: 0.05 + i * 0.06, ease: EASE_IN },
            ),
          );
        });
      if (focal) {
        runs.push(
          animateScope(
            focal,
            { scale: 0.85, opacity: 0 },
            { duration: 0.8, delay: 0.5, ease: EASE_IN },
          ),
        );
      }
    }
    return Promise.all(runs);
  }

  async function handleNext(event: MouseEvent<HTMLAnchorElement>) {
    // Modified clicks (new tab…), reduced motion and screens rendered outside
    // the story layout keep plain link behaviour.
    if (
      !story ||
      story.reducedMotion ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (leaving.current) return;
    leaving.current = true;
    window.setTimeout(() => story.morphTo(nextHref), MORPH_DELAY_MS);
    await playExit();
    router.push(nextHref);
  }

  const headingText = heading
    .map((line) => line.map((part) => part.text).join(""))
    .join(" ");
  let charIndex = 0;

  return (
    <div ref={scope} className="flex h-svh flex-col overflow-hidden text-[#161616]">
      <header className="flex h-[55px] shrink-0 items-center bg-white px-5 lg:px-[54px]">
        <Link href="/" aria-label="ABTalks home">
          <Image
            src="/abt-logo2.png"
            alt="ABTalks"
            width={318}
            height={74}
            priority
            className="h-[26px] w-auto"
          />
        </Link>
      </header>

      {/* Phones: pb-[76px] keeps Next clear of the fixed chat bubble. */}
      <div
        ref={stageRef}
        className="relative isolate flex min-h-0 flex-1 flex-col gap-4 px-5 pb-[76px] pt-6 lg:grid lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0 lg:p-0">
        <section className="shrink-0 lg:col-start-1 lg:row-start-1 lg:pl-[72px] lg:pt-[clamp(32px,11vh,100px)]">
          <motion.p
            {...fadeUp(3.2)}
            data-story="copy"
            className="text-[12.5px] font-bold uppercase tracking-[0.02em] text-[#03535F]"
          >
            0{step + 1} / {STEPS[step]}
          </motion.p>

          <h1
            data-story="copy"
            className="mt-4 font-heading text-[38px] font-semibold leading-[0.98] tracking-[-0.02em] sm:text-[52px] lg:mt-6 lg:text-[60px] xl:text-[72px] [@media(max-height:720px)]:lg:text-[52px]"
          >
            <span className="sr-only">{headingText}</span>
            <span aria-hidden>
              {heading.map((line, li) => (
                <span key={li} className="block">
                  {line.map((part) => (
                    <span
                      key={part.text}
                      className={part.accent ? "text-[#0E7F8A]" : undefined}
                    >
                      {Array.from(part.text).map((char) => {
                        const delay = TYPE_START + charIndex++ * TYPE_STEP;
                        return (
                          // Characters hold their space from the start, so the
                          // layout never shifts while the heading types out.
                          // Line breaks are layout, not characters: no pause.
                          <motion.span
                            key={delay}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay, duration: 0 }}
                          >
                            {char}
                          </motion.span>
                        );
                      })}
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </h1>

          <motion.p
            {...fadeUp(3.6)}
            data-story="copy"
            className="mt-5 max-w-[510px] text-[15px] leading-[1.6] text-[#5A5A5A] lg:mt-10 lg:text-[17px] lg:leading-[1.65]"
          >
            {description}
          </motion.p>

          <motion.ol
            {...fadeUp(3.75)}
            data-story="copy"
            aria-label="Onboarding steps"
            className="mt-5 flex items-center gap-3 text-[12.5px] font-semibold uppercase tracking-[0.03em] sm:gap-6.5 lg:mt-7"
          >
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-3 sm:gap-6.5">
                {i > 0 && (
                  <span aria-hidden className="text-[#9A9A9A]">
                    ·
                  </span>
                )}
                <span
                  className={i === step ? "text-[#03535F]" : "text-[#5A5A5A]"}
                  aria-current={i === step ? "step" : undefined}
                >
                  {label}
                </span>
              </li>
            ))}
          </motion.ol>
        </section>

        <div
          ref={fitRef}
          className="relative min-h-[200px] flex-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:px-5"
          aria-hidden
        >
          {/* With a scene on desktop, the inline placement (computed against
              the photo) overrides the classes. Otherwise: centred on phones,
              pinned right of the copy column a little above centre on desktop. */}
          <div
            data-story="diagram"
            className="absolute left-1/2 top-1/2 origin-center transform-[translate(-50%,-50%)_scale(var(--fit))] lg:left-5 lg:top-[calc(50%-40px)] lg:origin-left lg:transform-[translate(0,-50%)_scale(var(--fit))]"
            style={
              placement
                ? {
                    width: canvas.w,
                    height: canvas.h,
                    left: placement.left,
                    top: placement.top,
                    transform: `scale(${placement.scale})`,
                    transformOrigin: "0 0",
                  }
                : ({ width: canvas.w, height: canvas.h, "--fit": scale } as CSSProperties)
            }
          >
            {children}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between lg:col-start-1 lg:row-start-2 lg:flex-col lg:items-start lg:justify-between lg:pb-12 lg:pl-[72px] lg:pt-6">
          <motion.div {...fadeUp(4.05, 15)} data-story="copy" className="lg:order-2">
            <Link
              href="/hire"
              className="text-[15px] text-[#5E5E5E] transition-colors hover:text-[#03535F]"
            >
              Skip
            </Link>
          </motion.div>
          <motion.div {...fadeUp(3.9)} data-story="copy" className="lg:order-1">
            <Link
              href={nextHref}
              onClick={handleNext}
              className={cn(
                // DS v2 Large CTA (48 / 24 / 14) + the shared clay depth.
                dsButtonVariants({ size: "lg" }),
                "min-w-[160px] gap-2",
                CLAY_CTA,
              )}
            >
              {nextLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
