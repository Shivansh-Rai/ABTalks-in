"use client";

import { useSyncExternalStore } from "react";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

/**
 * The clock as an external store — the same shape `hero-section.tsx` uses for
 * matchMedia, and the reason this is not a `setState` inside an effect: the
 * wall clock is an outside system this component subscribes to, not state it
 * owns.
 */
function subscribeSecond(onStoreChange: () => void) {
  const timer = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(timer);
}

function getSecondSnapshot(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 0 means "no clock yet" — the server render and the hydration pass. React
 * re-renders with the real snapshot straight after hydrating, so the figures
 * appear immediately without the server and the browser ever disagreeing.
 */
function getServerSnapshot(): number {
  return 0;
}

function remainingFrom(targetMs: number, nowMs: number): Remaining | null {
  const diff = targetMs - nowMs;
  if (diff <= 0) return null;
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

/**
 * Plan 191 — the live countdown to the next Claude Challenge.
 *
 * Falls back to `label` (the plain date) before the clock is available and
 * again once the target has passed, so the page degrades to a date rather than
 * a row of zeros.
 */
export function LaunchCountdown({
  targetIso,
  label,
}: {
  targetIso: string;
  label: string;
}) {
  const nowSec = useSyncExternalStore(
    subscribeSecond,
    getSecondSnapshot,
    getServerSnapshot,
  );

  const targetMs = new Date(targetIso).getTime();
  const left =
    nowSec === 0 || !Number.isFinite(targetMs)
      ? null
      : remainingFrom(targetMs, nowSec * 1000);

  if (!left) {
    return <p className="launch__date">{label}</p>;
  }

  const cells: { value: number; unit: string }[] = [
    { value: left.days, unit: left.days === 1 ? "day" : "days" },
    { value: left.hours, unit: "hrs" },
    { value: left.minutes, unit: "min" },
    { value: left.seconds, unit: "sec" },
  ];

  return (
    <div className="launch__clock">
      <p className="launch__date">{label}</p>
      <ul className="launch__cells">
        {cells.map((cell) => (
          <li className="launch__cell" key={cell.unit}>
            <span className="launch__cell-value">
              {String(cell.value).padStart(2, "0")}
            </span>
            <span className="launch__cell-unit">{cell.unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
