"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Time a card rests before the rail steps to the next one. */
const AUTOPLAY_MS = 3000;
/** How long autoplay stays out of the way after the user takes control. */
const RESUME_AFTER_INPUT_MS = 8000;

/**
 * Horizontal rail for the testimonial cards. Advances one card at a time on a
 * timer, and yields to the user: hovering, focusing, swiping, or using the
 * arrows pauses it. Cards are passed as children so they stay Server
 * Components.
 */
export function TestimonialsScroller({
  children,
}: {
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cooldownRef = useRef<number | null>(null);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Reasons autoplay should hold off, tracked separately so they can overlap.
  const [engaged, setEngaged] = useState(false); // pointer over / focus inside
  const [cooling, setCooling] = useState(false); // recently took manual control
  const [hidden, setHidden] = useState(false); // tab in the background
  const [reducedMotion, setReducedMotion] = useState(true); // assume until known

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  const step = useCallback((direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector("figure");
    // Card width plus the gap-5 (1.25rem) between cards.
    const distance = card ? card.clientWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * distance, behavior: "smooth" });
  }, []);

  /** Hand control to the user and keep autoplay off for a beat. */
  const holdAutoplay = useCallback(() => {
    setCooling(true);
    if (cooldownRef.current) window.clearTimeout(cooldownRef.current);
    cooldownRef.current = window.setTimeout(
      () => setCooling(false),
      RESUME_AFTER_INPUT_MS,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) window.clearTimeout(cooldownRef.current);
    };
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncEdges();
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncEdges]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const apply = () => setHidden(document.hidden);
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, []);

  const autoplaying = !reducedMotion && !engaged && !cooling && !hidden;

  useEffect(() => {
    if (!autoplaying) return;
    const timer = window.setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const finished = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if (finished) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        step(1);
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [autoplaying, step]);

  const manualStep = (direction: 1 | -1) => {
    holdAutoplay();
    step(direction);
  };

  return (
    <div
      className="mt-8"
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
    >
      <div className="mx-auto hidden max-w-7xl justify-end gap-2 px-5 md:flex md:px-8">
        <ArrowButton
          label="Previous testimonials"
          disabled={atStart}
          onClick={() => manualStep(-1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </ArrowButton>
        <ArrowButton
          label="Next testimonials"
          disabled={atEnd}
          onClick={() => manualStep(1)}
        >
          <ChevronRight className="h-5 w-5" />
        </ArrowButton>
      </div>

      <div
        ref={trackRef}
        onScroll={syncEdges}
        onPointerDown={holdAutoplay}
        onTouchStart={holdAutoplay}
        tabIndex={0}
        role="region"
        aria-label="Testimonials, scroll horizontally"
        className="no-scrollbar mt-4 snap-x snap-mandatory scroll-pl-5 overflow-x-auto scroll-smooth outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:scroll-pl-8"
      >
        <div className="mx-auto flex w-max max-w-none items-stretch gap-5 px-5 md:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/60 text-foreground backdrop-blur-md transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "hover:border-border hover:bg-card",
      )}
    >
      {children}
    </button>
  );
}
