"use client";

import { useEffect, useState } from "react";

const QUOTES = [
  "You're one free hour away from being the person everyone asks for AI help. But sure, that tab won't close itself.",
  "Leaving already? Bold move to skip a free AI bootcamp and keep doing everything the slow way.",
  "Everyone's learning AI this week. You were too — for about 4 seconds. Let's fix that.",
];

export default function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState(QUOTES[0]);

  useEffect(() => {
    if (sessionStorage.getItem("wk_exit_shown") === "1") return;

    let lastY = 999;
    let lastTime = 0;

    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onMouseOut);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };

    const trigger = () => {
      if (sessionStorage.getItem("wk_exit_shown") === "1") return;
      sessionStorage.setItem("wk_exit_shown", "1");
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      setOpen(true);
      cleanup();
    };

    // Track pointer + upward velocity so we can catch a fast flick toward the
    // tab/close bar before the cursor even leaves the page.
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      const dt = now - lastTime || 16;
      const vy = (e.clientY - lastY) / dt; // px per ms; negative = moving up
      // Near the top and moving up quickly → they're aiming for the ✕ / tabs.
      if (e.clientY < 60 && vy < -0.35) trigger();
      lastY = e.clientY;
      lastTime = now;
    };

    // Cursor fully left the viewport from the top edge.
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 4) trigger();
    };
    const onLeave = () => {
      if (lastY < 60) trigger();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseout", onMouseOut);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return cleanup;
  }, []);

  if (!open) return null;

  const goToForm = () => {
    setOpen(false);
    const el = document.getElementById("register");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const firstInput = el?.querySelector<HTMLInputElement>('input[type="text"]');
      firstInput?.focus();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-95 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
      onClick={() => setOpen(false)}
    >
      <style>{`
        @keyframes wk-exit-pop {
          0% { transform: scale(0.9) translateY(16px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .wk-exit-card { animation: wk-exit-pop 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="wk-exit-card relative w-full max-w-lg overflow-hidden rounded-3xl p-7 text-center sm:p-10"
        style={{
          background: "rgba(20,16,27,0.92)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          boxShadow: "0 40px 100px -20px rgba(0,0,0,0.9)",
        }}
      >
        {/* top accent */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(255,122,26,0.7), rgba(255,77,148,0.7), transparent)",
          }}
        />

        {/* close */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
        >
          ✕
        </button>

        <span className="mb-4 block select-none text-5xl">🫠</span>

        <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
          Wait — really?
        </h3>

        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
          {quote}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={goToForm}
            className="w-full rounded-full px-7 py-3 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5 sm:w-auto"
            style={{
              background: "linear-gradient(135deg, #ff7a1a 0%, #ff4d94 100%)",
              boxShadow:
                "0 12px 30px -10px rgba(255,77,148,0.65), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            Fine, save my seat →
          </button>
          <button
            onClick={() => setOpen(false)}
            className="w-full rounded-full px-7 py-3 text-[14px] font-medium text-white/50 transition-colors hover:text-white/75 sm:w-auto"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            I&apos;ll stay behind
          </button>
        </div>

        <p className="mt-5 text-[11.5px] text-white/30">
          It&apos;s free, it&apos;s one hour, and it&apos;s live. Your call.
        </p>
      </div>
    </div>
  );
}
