"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";

const TOUR_KEY = "abtalks_tour_done"; // set by DashboardWalkthrough when finished
// July 18, 2026 · 4:00 PM IST
const TARGET = new Date("2026-07-18T10:30:00Z").getTime();

const AVATARS = [
  { i: "A", g: "linear-gradient(135deg,#ff7a1a,#ff4d94)" },
  { i: "R", g: "linear-gradient(135deg,#a855f7,#6366f1)" },
  { i: "P", g: "linear-gradient(135deg,#2dd4bf,#3b82f6)" },
  { i: "S", g: "linear-gradient(135deg,#ff4d94,#a855f7)" },
];

export function WorkshopPromoModal() {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const glowRef = useRef<HTMLDivElement>(null);

  // Show on every dashboard load/refresh. If the first-visit walkthrough is
  // still running, wait for the user to finish it before showing the promo.
  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout>;
    let poll: ReturnType<typeof setInterval>;

    const show = () => {
      showTimer = setTimeout(() => setOpen(true), 3000);
    };

    const tourDone = () => !!localStorage.getItem(TOUR_KEY);

    if (tourDone()) {
      // No walkthrough (or already completed) → show 3s after load.
      show();
    } else {
      // Walkthrough will run first — poll until it's completed, then show.
      poll = setInterval(() => {
        if (tourDone()) {
          clearInterval(poll);
          show();
        }
      }, 500);
    }

    return () => {
      clearTimeout(showTimer);
      clearInterval(poll);
    };
  }, []);

  // live countdown while open
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const diff = Math.max(0, TARGET - Date.now());
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = glowRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.style.opacity = "1";
    el.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
  };
  const onLeave = () => {
    if (glowRef.current) glowRef.current.style.opacity = "0";
  };

  const pad = (n: number) => n.toString().padStart(2, "0");
  const units = [
    { v: t.d, l: "Days" },
    { v: t.h, l: "Hrs" },
    { v: t.m, l: "Min" },
    { v: t.s, l: "Sec" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/65 px-4 backdrop-blur-md"
        >
          <style>{`
            @keyframes wp-halo-spin { to { transform: rotate(360deg); } }
            @keyframes wp-shine { 0%,55% { transform: translateX(-140%) skewX(-16deg); } 100% { transform: translateX(140%) skewX(-16deg); } }
            @keyframes wp-live { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(.82); } }
            .wp-cta::after {
              content:""; position:absolute; inset:0;
              background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.45) 50%,transparent 60%);
              transform:translateX(-140%) skewX(-16deg); animation:wp-shine 3.4s ease-in-out infinite; pointer-events:none;
            }
            .wp-cta:hover { transform: translateY(-2px); filter: brightness(1.06); }
          `}</style>

          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[440px]"
          >
            {/* rotating gradient halo */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[42px] opacity-50 blur-2xl"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff7a1a, #ff4d94, #a855f7, #6366f1, #ff7a1a)",
                animation: "wp-halo-spin 8s linear infinite",
              }}
            />

            {/* card */}
            <div
              onMouseMove={onMove}
              onMouseLeave={onLeave}
              className="relative overflow-hidden rounded-[28px] border border-white/10 p-7 sm:p-8"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% -10%, #1a1424 0%, #0b0912 55%)",
                boxShadow: "0 40px 100px -30px rgba(0,0,0,0.9)",
              }}
            >
              {/* pointer-follow glow */}
              <div
                ref={glowRef}
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 h-[360px] w-[360px] rounded-full opacity-0 transition-opacity duration-300"
                style={{
                  marginLeft: -180,
                  marginTop: -180,
                  background:
                    "radial-gradient(circle, rgba(255,77,148,0.14), transparent 60%)",
                }}
              />

              {/* close */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
              >
                <X className="size-4" aria-hidden />
              </button>

              <div className="relative">
                {/* live pill */}
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/70">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#ff4d94]"
                    style={{ boxShadow: "0 0 8px 1px rgba(255,77,148,.9)", animation: "wp-live 1.8s ease-in-out infinite" }}
                  />
                  Free Live Workshop
                </span>

                <h2 className="mt-4 font-display text-[26px] font-extrabold leading-[1.12] tracking-tight text-white sm:text-[30px]">
                  Become{" "}
                  <span
                    style={{
                      background: "linear-gradient(120deg,#ff9a3c,#ff4d94 55%,#a855f7)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    AI-Fluent
                  </span>{" "}
                  in one free hour
                </h2>

                <p className="mt-3 text-[13.5px] leading-relaxed text-white/50">
                  A hands-on live bootcamp on ChatGPT, Claude &amp; Gemini —
                  prompt engineering, real workflows, and the tools that 10× your
                  output.
                </p>

                {/* countdown */}
                <div className="mt-6">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    Starts in
                  </p>
                  <div className="flex items-center gap-2">
                    {units.map((u, i) => (
                      <div key={u.l} className="flex items-center gap-2">
                        <div
                          className="flex min-w-[52px] flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2"
                          style={{ backdropFilter: "blur(6px)" }}
                        >
                          <span className="font-mono text-lg font-bold tabular-nums text-white">
                            {pad(u.v)}
                          </span>
                          <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-widest text-white/35">
                            {u.l}
                          </span>
                        </div>
                        {i < units.length - 1 && (
                          <span className="text-white/20">:</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* social proof */}
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {AVATARS.map((a) => (
                      <span
                        key={a.i}
                        className="flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-bold text-white"
                        style={{ background: a.g, borderColor: "#0b0912" }}
                      >
                        {a.i}
                      </span>
                    ))}
                    <span
                      className="flex size-7 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white/70"
                      style={{ background: "#241b2f", borderColor: "#0b0912" }}
                    >
                      3k+
                    </span>
                  </div>
                  <span className="text-[12.5px] text-white/45">
                    <span className="font-semibold text-white/70">3,000+ learners</span>{" "}
                    already registered
                  </span>
                </div>

                {/* CTA */}
                <Link
                  href="/ai-workshop"
                  onClick={() => setOpen(false)}
                  className="wp-cta group relative mt-7 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-3.5 text-[15px] font-semibold text-white transition-[transform,filter] duration-200"
                  style={{
                    background: "linear-gradient(135deg,#ff7a1a 0%,#ff4d94 100%)",
                    boxShadow: "0 14px 34px -12px rgba(255,77,148,.65), inset 0 1px 0 rgba(255,255,255,.28)",
                  }}
                >
                  <span className="relative z-10">Reserve your free seat</span>
                  <ArrowRight className="relative z-10 size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>

                <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-white/30">
                  <span>Live on Google Meet</span>
                  <span className="text-white/15">•</span>
                  <span>Limited seats</span>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 w-full text-center text-[12.5px] font-medium text-white/35 transition-colors hover:text-white/60"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
