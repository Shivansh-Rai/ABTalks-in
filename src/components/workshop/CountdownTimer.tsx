"use client";

import { useState, useEffect } from "react";

export default function CountdownTimer({ targetUtc }: { targetUtc: string }) {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    setMounted(true);
    const target = new Date(targetUtc).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetUtc]);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="inline-flex items-center gap-2 sm:gap-3">
      {mounted ? (
        <>
          <Unit val={pad(time.d)} label="Days" />
          <Sep />
          <Unit val={pad(time.h)} label="Hrs" />
          <Sep />
          <Unit val={pad(time.m)} label="Min" />
          <Sep />
          <Unit val={pad(time.s)} label="Sec" live />
        </>
      ) : (
        <>
          <Unit val="--" label="Days" />
          <Sep />
          <Unit val="--" label="Hrs" />
          <Sep />
          <Unit val="--" label="Min" />
          <Sep />
          <Unit val="--" label="Sec" live />
        </>
      )}
    </div>
  );
}

function Unit({ val, label, live }: { val: string; label: string; live?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative flex min-w-[52px] items-center justify-center rounded-xl px-2.5 py-2 sm:min-w-[64px] sm:px-3 sm:py-2.5"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: live
            ? "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 20px -4px rgba(255,77,148,0.4)"
            : "inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span
          className="font-mono text-lg font-bold tabular-nums tracking-tight sm:text-2xl"
          style={{
            background: live
              ? "linear-gradient(135deg, #ff9a3c, #ff4d94)"
              : "linear-gradient(180deg, #ffffff, #cfc8d8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {val}
        </span>
      </div>
      <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:text-[9px]">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return (
    <span className="-mt-4 text-lg font-light text-white/20 sm:text-xl">:</span>
  );
}
