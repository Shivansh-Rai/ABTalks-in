"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import CountdownTimer from "./CountdownTimer";

export default function WorkshopHeader() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setCollapsed((prev) => {
          if (!prev && y > 24) return true;
          if (prev && y < 8) return false;
          return prev;
        });
        ticking = false;
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm px-4">
      <div className="max-w-3xl md:max-w-287.5 mx-auto w-full py-1.5 md:py-2 flex flex-col md:flex-row items-center justify-between gap-3.5 md:gap-6">
        <div className="flex items-center gap-3">
          <span data-collapsed={collapsed} className="logo-link focus-spark shrink-0">
            <Image
              src="/abtalks-logo.png"
              alt="ABTalks"
              width={300}
              height={84}
              priority
              className="block h-7 w-auto max-w-none object-cover object-left invert -translate-y-1 translate-x-1"
            />
          </span>
          <div className="h-5 w-px bg-gray-200 shrink-0" />
          <span
            className="text-[10px] font-bold px-2.5 py-1 uppercase tracking-widest border border-[#ff6a00]/20 select-none leading-none"
            style={{ background: "#fff0e6", color: "#ff6a00", borderRadius: "6px" }}
          >
            AI Workshop
          </span>
        </div>
        <CountdownTimer />
      </div>
    </header>
  );
}
