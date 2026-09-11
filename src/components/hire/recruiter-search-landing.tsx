"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Screen 1's own pieces — the heading above the search bar and the suggestion
 * stack below it.
 *
 * The search bar is deliberately NOT here. It is ScoutChat's composer, one
 * element rendered in the same place in the tree on both screens, so pressing
 * Search can move it from the centre of the green hero to the bottom of the
 * results column without it ever being unmounted. These two pieces are what
 * screen 1 has that screen 2 does not; on the way out ScoutChat pins them where
 * they were (`frozen`) and lets them fade while the workspace comes in.
 */

export const SEARCH_SUGGESTIONS = [
  "AI Engineer in Bangalore with 2+ years of experience and remote work",
  "AI Engineer in Delhi with 4+ years of experience in Agentic AI",
  "AI Engineer in Bangalore",
  "Full Stack Developer in Hyderabad with React and Node.js expertise",
  "Data Scientist in Mumbai with 3+ years in NLP and deep learning",
  "Product Designer in Pune with Figma and design systems experience",
  "DevOps Engineer in Bangalore with AWS and Kubernetes skills",
  "Backend Engineer in Chennai with Go and microservices architecture",
] as const;

/** One turn of the suggestion cube. Matches `rsearch-cube-*` in CSS. */
const CUBE_MS = 700;

export function RecruiterSearchTitle({
  leaving = false,
  frozen,
}: {
  leaving?: boolean;
  frozen?: CSSProperties;
}) {
  return (
    <h1
      className={cn("rsearch__title", leaving && "is-leaving")}
      style={frozen}
      aria-hidden={leaving || undefined}
    >
      Who are you looking for?
    </h1>
  );
}

export function RecruiterSearchSuggestions({
  pending,
  onPick,
  leaving = false,
  frozen,
}: {
  pending: boolean;
  onPick: (query: string) => void;
  leaving?: boolean;
  frozen?: CSSProperties;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  /**
   * The step being played, if any: where the stack came FROM and which way it
   * turned. Each line renders that old text as an outgoing face and the new
   * text as the incoming one, so the stack rolls like a row of cubes turning
   * — up when it moves forward, down when scrolled back. `id` re-keys the
   * faces so a second step mid-roll starts a fresh turn.
   */
  const [roll, setRoll] = useState<{ from: number; dir: 1 | -1; id: number } | null>(
    null,
  );
  const activeRef = useRef(0);
  const rollId = useRef(0);

  const step = (dir: 1 | -1) => {
    const from = activeRef.current;
    const next = (from + dir + SEARCH_SUGGESTIONS.length) % SEARCH_SUGGESTIONS.length;
    activeRef.current = next;
    rollId.current += 1;
    setActive(next);
    setRoll({ from, dir, id: rollId.current });
  };

  // The outgoing faces only exist for the length of the turn.
  useEffect(() => {
    if (!roll) return;
    const id = window.setTimeout(() => setRoll(null), CUBE_MS);
    return () => window.clearTimeout(id);
  }, [roll]);

  /**
   * One line every 5s, on its own.
   *
   * Keyed on `active`, so a manual scroll restarts the clock rather than
   * leaving a stale timer to fire a moment later and skip a line. It holds
   * while the pointer is over the stack — the lines are buttons, and moving
   * one out from under a click is how you mis-send a search — and it does not
   * run under prefers-reduced-motion, where unprompted movement is exactly what
   * the setting asks you not to do.
   */
  useEffect(() => {
    if (paused || leaving) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => step(1), 5000);
    return () => window.clearTimeout(id);
    // `step` only reads refs; `active` is the clock's reset signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, leaving]);

  /**
   * The stack also answers the scroll. Nothing on screen 1 overflows, so there
   * is no native scroll to hook — wheel/touch delta is accumulated to a
   * threshold instead, which keeps one trackpad notch equal to one line. It is
   * listened for on the document because the whole screen is the hero.
   */
  const wheelAccum = useRef(0);
  const touchY = useRef<number | null>(null);

  useEffect(() => {
    if (leaving) return;
    const STEP = 90;

    function onWheel(e: WheelEvent) {
      wheelAccum.current += e.deltaY;
      if (Math.abs(wheelAccum.current) < STEP) return;
      step(wheelAccum.current > 0 ? 1 : -1);
      wheelAccum.current = 0;
    }
    function onTouchStart(e: TouchEvent) {
      touchY.current = e.touches[0]?.clientY ?? null;
    }
    function onTouchMove(e: TouchEvent) {
      const start = touchY.current;
      const y = e.touches[0]?.clientY;
      if (start == null || y == null) return;
      const delta = start - y;
      if (Math.abs(delta) < 48) return;
      step(delta > 0 ? 1 : -1);
      touchY.current = y;
    }

    document.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const textAt = (base: number, offset: number) =>
    SEARCH_SUGGESTIONS[(base + offset) % SEARCH_SUGGESTIONS.length]!;

  return (
    <ul
      className={cn("rsearch__suggest", leaving && "is-leaving")}
      style={frozen}
      aria-label="Suggested searches"
      aria-hidden={leaving || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {[0, 1, 2].map((offset) => {
        const suggestion = textAt(active, offset);
        const arrow =
          offset === 0 ? (
            <span className="rsearch__suggest-arrow" aria-hidden="true">
              →
            </span>
          ) : null;
        return (
          <li
            key={offset}
            className={cn("rsearch__suggest-slot", `is-${offset}`)}
          >
            <span className="rsearch__cube">
              {roll && (
                <span
                  key={`out-${roll.id}`}
                  className={cn(
                    "rsearch__face is-out",
                    roll.dir < 0 && "is-back",
                  )}
                  aria-hidden="true"
                >
                  {arrow}
                  {textAt(roll.from, offset)}
                </span>
              )}
              <button
                key={`in-${roll?.id ?? 0}`}
                type="button"
                className={cn(
                  "rsearch__face",
                  roll && "is-in",
                  roll && roll.dir < 0 && "is-back",
                )}
                disabled={pending || leaving}
                tabIndex={leaving ? -1 : undefined}
                onClick={() => onPick(suggestion)}
              >
                {arrow}
                {suggestion}
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
