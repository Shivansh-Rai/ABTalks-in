"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

// Bump the version suffix to re-show the popup to everyone after a change.
const SEEN_KEY = "abtalks_hackathon_promo_v1";
const TARGET = new Date(HACKATHON.kickoffUtc).getTime();

export function HackathonPromoModal() {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });

  // Show once, ever, 1s after the dashboard loads.
  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    const timer = setTimeout(() => {
      setOpen(true);
      localStorage.setItem(SEEN_KEY, "1");
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Lock background scroll while the popup is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
          transition={{ duration: 0.22 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.92, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[360px] overflow-hidden rounded-3xl border border-white/10 p-6"
            style={{
              background:
                "radial-gradient(120% 90% at 50% -10%, #1a1430 0%, #0b0912 60%)",
              boxShadow: "0 30px 80px -28px rgba(0,0,0,0.85)",
            }}
          >
            {/* top accent line */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(139,92,246,0.8), rgba(99,102,241,0.8), transparent)",
              }}
            />

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 flex size-7 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
            >
              <X className="size-4" aria-hidden />
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
              <Sparkles className="size-3 text-violet-400" aria-hidden />
              AI Hackathon
            </span>

            <h2 className="mt-3.5 font-display text-[22px] font-extrabold leading-[1.15] tracking-tight text-white">
              ABTalks{" "}
              <span
                style={{
                  background: "linear-gradient(120deg,#8b5cf6,#6366f1)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Vibe Code Hackathon
              </span>
            </h2>

            <p className="mt-2 text-[13px] leading-relaxed text-white/50">
              48 hours. No boilerplate. Just you, your ideas, and AI. Build solo
              or in a team of up to 3.
            </p>

            {/* compact countdown */}
            <p className="mt-4 text-[11px] font-medium text-white/45">
              {HACKATHON.kickoffLabel}
            </p>
            <div className="mt-2 flex items-center gap-1">
              {units.map((u, i) => (
                <div key={u.l} className="flex items-center gap-1">
                  <div className="flex min-w-[44px] flex-col items-center rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-1.5">
                    <span className="font-mono text-base font-bold tabular-nums text-white">
                      {pad(u.v)}
                    </span>
                    <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-widest text-white/35">
                      {u.l}
                    </span>
                  </div>
                  {i < units.length - 1 ? (
                    <span className="text-white/20">:</span>
                  ) : null}
                </div>
              ))}
            </div>

            <Link
              href="/hackathon"
              onClick={() => setOpen(false)}
              className="group mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110"
              style={{
                background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
                boxShadow:
                  "0 12px 28px -12px rgba(124,92,246,0.7), inset 0 1px 0 rgba(255,255,255,0.22)",
              }}
            >
              Register now
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full text-center text-[12px] font-medium text-white/35 transition-colors hover:text-white/60"
            >
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
