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
    <div className="inline-flex items-center gap-1.5 sm:gap-3">
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
          <Unit val="00" label="Days" />
          <Sep />
          <Unit val="00" label="Hrs" />
          <Sep />
          <Unit val="00" label="Min" />
          <Sep />
          <Unit val="00" label="Sec" />
        </>
      )}
    </div>
  );
}

function Unit({ val, label }: { val: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 sm:gap-1.5">
      <div
        className="relative flex min-w-[48px] items-center justify-center rounded-lg border border-[#1E1B37] px-2 py-1.5 sm:min-w-[72px] sm:rounded-xl sm:px-3 sm:py-2.5"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(118, 74, 194, 1) 0%, rgba(62, 34, 111, 1) 50%, rgba(0, 0, 0, 1) 100%)",
        }}
      >
        {/* Ghost segments behind for classic LCD look */}
        <span
          aria-hidden
          className="pointer-events-none absolute text-[17px] font-normal tracking-wider text-white/15 sm:text-[1.75rem]"
          style={{ fontFamily: '"DSEG7 Classic", monospace' }}
        >
          88
        </span>
        <span
          className="relative text-[17px] font-normal tracking-wider text-white sm:text-[1.75rem]"
          style={{ fontFamily: '"DSEG7 Classic", monospace' }}
        >
          {val}
        </span>
      </div>
      <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#BCBCBC] sm:text-[9px] sm:tracking-[0.16em]">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return (
    <span
      className="-mt-3 text-[17px] font-normal text-white sm:-mt-4 sm:text-[1.75rem]"
      style={{ fontFamily: '"DSEG7 Classic", monospace' }}
    >
      :
    </span>
  );
}
