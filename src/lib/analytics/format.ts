/**
 * Plan 151 (revised). Compact number, duration and percentage formatters for
 * the admin GA analytics section. Kept in `lib/analytics` so both the Server
 * Component (KPI values) and the Client Components (chart tooltips) can share
 * one formatting contract.
 */

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const preciseFmt = new Intl.NumberFormat("en-US");

/** `12,345` → `12.3K`, `1,234,567` → `1.2M`, `950` → `950`. */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) < 1000) return preciseFmt.format(Math.round(value));
  return compactFmt.format(value);
}

/** Seconds → `2m 15s` / `48s`. */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** GA engagementRate / bounceRate are ratios in [0, 1]. */
export function formatRatioAsPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "0%";
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Absolute percent delta with sign, e.g. `+12%` / `-3%`. */
export function formatDeltaPct(delta: number | null | undefined): string | null {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}%`;
}

/** Language tag `en-us` / `en_GB` → `EN`. GA dimension values are noisy. */
export function shortLanguageTag(code: string): string {
  const head = code.split(/[-_]/)[0] ?? code;
  return head.toUpperCase();
}

/** Path `/hire/candidates?x=y` → `/hire/candidates`. Query strings are noise. */
export function trimPath(path: string): string {
  const q = path.indexOf("?");
  return q === -1 ? path : path.slice(0, q);
}
