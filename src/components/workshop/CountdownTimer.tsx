"use client";

import { useState, useEffect } from "react";

// July 11, 2026 at 4:00 PM IST (= 10:30 AM UTC)
const WEBINAR_TARGET = new Date("2026-07-11T10:30:00Z").getTime();

export default function CountdownTimer() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      const diff = Math.max(0, WEBINAR_TARGET - Date.now());
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
  }, []);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="inline-flex items-center gap-2.5 sm:gap-3.5 bg-white border border-orange-200 rounded-[16px] md:rounded-[20px] px-3.5 md:px-5 py-2 md:py-2.5 select-none" style={{ boxShadow: "0 0 0 1px rgba(255,106,0,0.15), 0 0 16px 2px rgba(255,106,0,0.18), 0 0 32px 4px rgba(232,67,147,0.10)" }}>
      <span className="text-[10px] md:text-xs text-gray-400 font-semibold uppercase tracking-wider mr-1 md:mr-1.5">
        Starts in
      </span>
      {mounted ? (
        <div className="flex items-center gap-2 md:gap-3">
          <Unit val={pad(time.d)} label="DAYS" />
          <Sep />
          <Unit val={pad(time.h)} label="HRS" />
          <Sep />
          <Unit val={pad(time.m)} label="MIN" />
          <Sep />
          <Unit val={pad(time.s)} label="SEC" orange />
        </div>
      ) : (
        <span className="text-xs text-gray-400">Loading...</span>
      )}
    </div>
  );
}

interface UnitProps {
  val: string;
  label: string;
  orange?: boolean;
}

function Unit({ val, label, orange }: UnitProps) {
  return (
    <div className="flex flex-col items-center min-w-[26px] md:min-w-[32px]">
      <span
        className={`text-base md:text-[20px] font-extrabold leading-none tracking-tight ${
          orange ? "text-[#ff6a00]" : "text-gray-900"
        }`}
      >
        {val}
      </span>
      <span className="text-[6.5px] md:text-[8px] text-gray-400 font-extrabold tracking-wider mt-1.5">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return (
    <span className="text-gray-300 text-xs md:text-sm font-light self-center -translate-y-[2px] md:-translate-y-[3px]">
      :
    </span>
  );
}
