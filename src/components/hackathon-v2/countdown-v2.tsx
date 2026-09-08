"use client";

import { useEffect, useState } from "react";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function CountdownV2({ targetIso }: { targetIso: string }) {
  const [mounted, setMounted] = useState(false);
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0, done: false });
  const [live, setLive] = useState("");

  useEffect(() => {
    setMounted(true);
    const target = new Date(targetIso).getTime();
    let lastMinute = -1;

    function tick() {
      const ms = Math.max(0, target - Date.now());
      const total = Math.floor(ms / 1000);
      const d = Math.floor(total / 86400);
      const h = Math.floor((total % 86400) / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      setT({ d, h, m, s, done: ms === 0 });
      if (m !== lastMinute) {
        lastMinute = m;
        setLive(
          ms === 0
            ? "The hackathon countdown has ended."
            : `${d} days, ${h} hours and ${m} minutes remaining.`,
        );
      }
      return ms;
    }

    tick();
    const timer = window.setInterval(() => {
      if (tick() === 0) window.clearInterval(timer);
    }, 1000);

    function onVisibility() {
      if (!document.hidden) tick();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [targetIso]);

  const display = mounted
    ? { d: pad(t.d), h: pad(t.h), m: pad(t.m), s: pad(t.s) }
    : { d: "--", h: "--", m: "--", s: "--" };

  return (
    <div
      className="hk-count"
      data-countdown
      data-deadline={targetIso}
      role="timer"
      aria-label="Time remaining until the next hackathon"
      {...(t.done ? { "data-elapsed": true } : {})}
    >
      <div className="hk-count__unit">
        <span className="hk-count__value" data-unit="days">{display.d}</span>
        <span className="hk-count__label">Days</span>
      </div>
      <span className="hk-count__sep" aria-hidden>:</span>
      <div className="hk-count__unit">
        <span className="hk-count__value" data-unit="hours">{display.h}</span>
        <span className="hk-count__label">Hrs</span>
      </div>
      <span className="hk-count__sep" aria-hidden>:</span>
      <div className="hk-count__unit">
        <span className="hk-count__value" data-unit="minutes">{display.m}</span>
        <span className="hk-count__label">Min</span>
      </div>
      <span className="hk-count__sep" aria-hidden>:</span>
      <div className="hk-count__unit">
        <span className="hk-count__value" data-unit="seconds">{display.s}</span>
        <span className="hk-count__label">Sec</span>
      </div>
      <p className="ab-sr" aria-live="polite">{live}</p>
    </div>
  );
}
