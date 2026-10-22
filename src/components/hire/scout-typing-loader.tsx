"use client";

import { useEffect, useState } from "react";

/**
 * Scout's "working" line in the thread: short phrases typed out one after the
 * other, so a wait reads as progress rather than a frozen spinner.
 *
 * Everything you may want to tune lives in this block.
 */

/** Shortest time the search loader stays up before Scout's summary appears. */
export const SEARCH_LOADER_MIN_MS = 4500;

/** How long the Open the Pool loader runs before the results open. */
export const POOL_LOADER_MIN_MS = 4500;

/** Per character while typing. Lower is faster. */
const TYPE_MS = 28;

/** How long a finished phrase stays before the next one starts. */
const HOLD_MS = 520;

/** While Scout searches and writes its summary. */
export const SEARCH_PHRASES = [
  "Looking in the pool…",
  "Applying your filters…",
  "Matching skills to candidates…",
  "Ranking by verified evidence…",
  "Writing your search summary…",
] as const;

/** After Open the Pool, while the results load. */
export const POOL_PHRASES = [
  "Getting your pool ready…",
  "Lining up the list…",
  "Putting the strongest first…",
  "Polishing the profiles…",
  "Almost there…",
] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * The typed label. Screen readers hear each whole phrase once (the live
 * region), never the letters; with reduced motion the phrases swap whole.
 */
export function ScoutTypingLabel({ phrases }: { phrases: readonly string[] }) {
  const [reduced] = useState(prefersReducedMotion);
  const [index, setIndex] = useState(0);
  const [chars, setChars] = useState(0);
  const phrase = phrases[index % phrases.length] ?? "";
  const typed = reduced || chars >= phrase.length;

  useEffect(() => {
    if (!typed) {
      const t = window.setTimeout(() => setChars((c) => c + 1), TYPE_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(
      () => {
        setIndex((i) => (i + 1) % phrases.length);
        setChars(0);
      },
      reduced ? HOLD_MS * 2 : HOLD_MS,
    );
    return () => window.clearTimeout(t);
  }, [typed, chars, reduced, phrases.length]);

  return (
    <p className="scout-turn__text scout-typing">
      <span className="sr-only" aria-live="polite">
        {phrase}
      </span>
      <span aria-hidden="true">{reduced ? phrase : phrase.slice(0, chars)}</span>
      <span className="scout-typing__caret" aria-hidden="true" />
    </p>
  );
}
