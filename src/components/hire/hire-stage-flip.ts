/**
 * Shared-element movement for the Hire search bar.
 *
 * The bar is ONE element that lives in the DOM across both Figma screens: on
 * screen 1 it sits centred under the heading, on screen 2 it is pinned to the
 * bottom of the results column. CSS moves it instantly when the stage class
 * flips; this replays that jump as motion — measure where it was, apply the
 * inverse transform, then animate the transform away (FLIP).
 *
 * Transform only. Animating top/left/width would relayout the whole column on
 * every frame, and the point of the move is that the recruiter can see it is
 * the same control.
 */

export type StageRect = { top: number; left: number; width: number; height: number };

export function measureStage(el: HTMLElement | null): StageRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Play `first` → current position on `el`.
 *
 * `duration` covers the whole journey down the page, so it is deliberately
 * longer than the 200–400ms used for things that only fade: a bar that travels
 * most of the viewport height reads as a jump-cut at 300ms.
 */
/**
 * Length of every screen 1 <-> 2 move: the bar's travel AND the background
 * morph (`1200ms` in hire-scout.css — keep the two equal, that is what makes
 * the surface feel attached to the bar).
 */
export const HIRE_STAGE_MS = 1200;

export function playStageFlip(
  el: HTMLElement | null,
  first: StageRect | null,
  duration = HIRE_STAGE_MS,
): Animation | null {
  if (!el || !first) return null;
  if (prefersReducedMotion()) return null;
  if (typeof el.animate !== "function") return null;

  const last = measureStage(el);
  if (!last || !last.width || !first.width) return null;

  // Rects are in viewport pixels, but a transform is applied in the element's
  // own coordinate space — and screen 2 is scaled with CSS `zoom`, which that
  // space includes. Without dividing it out the bar overshoots by 1/zoom.
  // (`scale` is a ratio of two viewport widths, so it needs no correction.)
  const zoom =
    "currentCSSZoom" in el
      ? (el as HTMLElement & { currentCSSZoom: number }).currentCSSZoom || 1
      : 1;
  const dx = (first.left - last.left) / zoom;
  const dy = (first.top - last.top) / zoom;
  const scale = first.width / last.width;

  // Sub-pixel drift is not a move; skip it so a resize cannot trigger a slide.
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(scale - 1) < 0.01) {
    return null;
  }

  return el.animate(
    [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        transformOrigin: "left top",
      },
      { transform: "translate(0, 0) scale(1)", transformOrigin: "left top" },
    ],
    {
      duration,
      /**
       * Evenly paced, NOT an easeOut.
       *
       * This was `cubic-bezier(0.22, 1, 0.36, 1)` — easeOutQuint — and the
       * motion was measurably over before anyone could see it: sampled per
       * frame, the bar covered more than half of a 298px drop in the first
       * 80ms and then crept for the remaining 600. The duration was honest
       * and the transition still read as instant. A gentle ease-in-out
       * spends the time on the part of the journey the eye is following.
       */
      easing: "cubic-bezier(0.45, 0.05, 0.25, 1)",
      fill: "none",
    },
  );
}
