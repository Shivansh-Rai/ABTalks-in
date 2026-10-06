"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Shared step player for every stepped visual: index -1 means "not started".
 * Autoplay is available but never starts on its own; with reduced motion the
 * learner still gets Next/Back, only the timer is disabled.
 */
export function useStepPlayer(count: number, opts: { loop?: boolean; interval?: number } = {}) {
  const { loop = false, interval = 1600 } = opts;
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < count) return i + 1;
      return loop ? 0 : i;
    });
  }, [count, loop]);

  const back = useCallback(() => setIndex((i) => Math.max(-1, i - 1)), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(-1);
  }, []);
  const goTo = useCallback((i: number) => {
    setPlaying(false);
    setIndex(i);
  }, []);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p) setIndex((i) => (i >= count - 1 && !loop ? -1 : i));
      return !p;
    });
  }, [count, loop]);

  useEffect(() => {
    if (!playing) return;
    const tick = () =>
      setIndex((i) => {
        if (i + 1 < count) return i + 1;
        if (loop) return 0;
        setPlaying(false);
        return i;
      });
    tick();
    timer.current = setInterval(tick, interval);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, count, loop, interval]);

  return { index, playing, reduced, next, back, reset, goTo, toggle };
}
