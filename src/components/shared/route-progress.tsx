"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/*
 * Plan 168. The App Router keeps the OLD page mounted and interactive until
 * the new route's RSC payload resolves. With almost no `loading.tsx` on the
 * platform there was nothing to swap in, so a tab click looked dead and
 * recruiters clicked again. This bar is the "we heard you" signal, and it is
 * mounted once in the root layout so all 160 routes get it without a single
 * per-route change.
 *
 * It listens for anchor clicks rather than router events because the App
 * Router exposes no public navigation-event API.
 */

/** Below this, a warm route has already arrived — painting would be a flash. */
const PAINT_DELAY_MS = 150;
/** Hard stop. A cancelled or failed navigation must never strand the bar. */
const SAFETY_TIMEOUT_MS = 10_000;

/**
 * The finish line, expressed as a remount rather than an effect.
 *
 * `usePathname` only commits once the new route's payload has landed, so
 * keying the bar on it means arrival unmounts the in-flight bar and mounts a
 * fresh idle one. React's own lifecycle clears the timers in the unmount
 * cleanup, which avoids the cascading-render trap of resetting state from an
 * effect (`react-hooks/set-state-in-effect`).
 */
export function RouteProgress() {
  const pathname = usePathname();
  return <RouteProgressBar key={pathname} />;
}

function RouteProgressBar() {
  const [active, setActive] = useState(false);
  const paintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    // Already tracking a navigation. After the paint fires `paintTimer` is
    // null but `safetyTimer` is still armed, so this guard covers both phases.
    if (paintTimer.current || safetyTimer.current) return;
    paintTimer.current = setTimeout(() => {
      paintTimer.current = null;
      setActive(true);
    }, PAINT_DELAY_MS);
    // Only reached when the pathname never changes — a navigation that was
    // cancelled, failed, or only altered the query string.
    safetyTimer.current = setTimeout(() => {
      safetyTimer.current = null;
      setActive(false);
    }, SAFETY_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Anything that will not actually navigate must not paint a bar — it
      // would then sit there for the full safety timeout.
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      // Opt-out for anchors that intentionally do their own thing.
      if (anchor.dataset.noProgress !== undefined) return;

      const anchorTarget = anchor.getAttribute("target");
      if (anchorTarget && anchorTarget !== "_self") return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Also excludes mailto:/tel:, whose origin parses as "null".
      if (url.origin !== window.location.origin) return;
      // Hash-only moves and re-clicks on the current tab never navigate.
      const next = `${url.pathname}${url.search}`;
      const here = `${window.location.pathname}${window.location.search}`;
      if (next === here) return;

      start();
    }

    // Capture phase, so this runs before Link's own handler calls
    // preventDefault on the event.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, [start]);

  useEffect(() => {
    const paint = paintTimer;
    const safety = safetyTimer;
    return () => {
      if (paint.current) clearTimeout(paint.current);
      if (safety.current) clearTimeout(safety.current);
    };
  }, []);

  if (!active) return null;

  return (
    <>
      <div className="route-progress" aria-hidden="true" />
      {/* The bar itself stays out of the a11y tree; this is the one
          announcement a screen reader should get. */}
      <span role="status" className="sr-only">
        Loading page
      </span>
    </>
  );
}
