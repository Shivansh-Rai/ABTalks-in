"use client";

import { useEffect, useState } from "react";

export function Countdown({ targetIso }: { targetIso: string }) {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    setMounted(true);
    const target = new Date(targetIso).getTime();
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
  }, [targetIso]);

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
          <Unit val={pad(time.s)} label="Sec" />
        </>
      ) : (
        <>
          <Unit val="--" label="Days" />
          <Sep />
          <Unit val="--" label="Hrs" />
          <Sep />
          <Unit val="--" label="Min" />
          <Sep />
          <Unit val="--" label="Sec" />
        </>
      )}
    </div>
  );
}

function Unit({ val, label }: { val: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex min-w-[52px] items-center justify-center rounded-xl border border-border bg-card px-2.5 py-2 shadow-sm sm:min-w-[64px] sm:px-3 sm:py-2.5">
        <span className="font-mono text-lg font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {val}
        </span>
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return (
    <span className="-mt-4 text-lg font-light text-muted-foreground/50 sm:text-xl">
      :
    </span>
  );
}
