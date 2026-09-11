/**
 * Screen 2's scale.
 *
 * The results dashboard is built from the Figma frame's pixel values, and they
 * are only right at a ~1920px-wide layout. A 1080p laptop at 125–150% Windows
 * scaling hands the browser 1280–1536 CSS px, where every value rendered ~1.5x
 * too large and the nav card was switched off by the ≤1365px rule. So below the
 * design width the dashboard is laid out AT the design width and scaled down
 * with CSS `zoom` (which, unlike `transform`, scales layout too — scrolling and
 * hit targets stay correct).
 *
 * Shared by the server layout (an inline script sets it before first paint, so
 * a results page never flashes full-size and then shrinks) and HireChrome
 * (which keeps it current on resize and client navigation).
 */

export const HIRE_DESIGN_WIDTH = 1920;

/**
 * Below this the type gets too small to read, so the dashboard stops shrinking
 * and starts reflowing instead. At the floor the layout is still ≥1453px wide,
 * which keeps the nav card on screen.
 */
export const HIRE_MIN_ZOOM = 0.62;

/** ≤900px is the phone layout, which has its own sizes and is never zoomed. */
export function hireZoomFor(viewportWidth: number): number {
  if (viewportWidth <= 900) return 1;
  return Math.min(1, Math.max(HIRE_MIN_ZOOM, viewportWidth / HIRE_DESIGN_WIDTH));
}

/** The same rule, as a blocking inline script for the server layout. */
export const HIRE_ZOOM_SCRIPT = `(function(){try{var w=window.innerWidth;var z=w<=900?1:Math.min(1,Math.max(${HIRE_MIN_ZOOM},w/${HIRE_DESIGN_WIDTH}));document.documentElement.style.setProperty("--hire-zoom",String(z));}catch(e){}})();`;
