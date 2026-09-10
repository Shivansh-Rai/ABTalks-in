"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

type Phase = "PRE" | "LIVE" | "ENDED";

type Props = {
  kickoffUtc: string;
  deadlineUtc: string;
  resultsLabel: string;
};

function resolvePhase(now: number, kickoff: number, deadline: number): Phase {
  if (now < kickoff) return "PRE";
  if (now < deadline) return "LIVE";
  return "ENDED";
}

/**
 * Countdown in the Design System v2 palette: Primary Teal before kickoff,
 * success green while live, semantic red in the final hour, neutral once
 * closed. Digits are Outfit with tabular figures; the phase is also spelled
 * out in the label, so the state never relies on colour alone.
 */
type Accent = "brand" | "live" | "urgent" | "muted";

const ACCENT_TEXT: Record<Accent, string> = {
  brand: "text-[#03535F]",
  live: "text-[#197E23]",
  urgent: "text-[#D92D20]",
  muted: "text-[#8F8F8F]",
};

const ACCENT_TILE: Record<Accent, string> = {
  brand: "border-[#D4EBEC] bg-[#E7F2F3]",
  live: "border-[#D6F7EC] bg-[#D6F7EC]",
  urgent: "border-[#D92D2033] bg-[#D92D2014]",
  muted: "border-[#E0E0E0] bg-[#F4F4F4]",
};

export function MissionTimer({
  kickoffUtc,
  deadlineUtc,
  resultsLabel,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const refreshedRef = useRef(false);
  const prevPhaseRef = useRef<Phase | null>(null);

  const kickoff = new Date(kickoffUtc).getTime();
  const deadline = new Date(deadlineUtc).getTime();
  const phase = resolvePhase(now, kickoff, deadline);

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      const t = Date.now();
      const next = resolvePhase(t, kickoff, deadline);
      setNow(t);
      if (
        !refreshedRef.current &&
        prevPhaseRef.current === "PRE" &&
        next === "LIVE"
      ) {
        refreshedRef.current = true;
        router.refresh();
      }
      prevPhaseRef.current = next;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kickoff, deadline, router]);

  const target = phase === "PRE" ? kickoff : deadline;
  const diff = Math.max(0, target - now);
  const time = {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
  const pad = (n: number) => n.toString().padStart(2, "0");

  const underOneHour = phase === "LIVE" && diff < 60 * 60 * 1000;

  let label = "STARTS IN";
  let accent: Accent = "brand";
  let absoluteLabel: string = HACKATHON.kickoffLabel;

  if (phase === "LIVE") {
    label = "TIME LEFT TO SUBMIT";
    accent = underOneHour ? "urgent" : "live";
    absoluteLabel = HACKATHON.deadlineLabel;
  } else if (phase === "ENDED") {
    label = "SUBMISSIONS CLOSED";
    accent = "muted";
    absoluteLabel = resultsLabel;
  }

  return (
    <section className="rounded-2xl border border-[#E0E0E0] bg-white px-4 py-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:px-6">
      <p
        className={`font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.2em] ${
          ACCENT_TEXT[accent]
        } ${accent === "urgent" ? "animate-pulse" : ""}`}
      >
        {label}
      </p>

      {phase === "ENDED" ? (
        <div className="mt-6 space-y-3">
          <p className="font-heading text-2xl font-semibold tracking-wider text-[#8F8F8F] sm:text-3xl">
            CLOSED
          </p>
          <p className="text-sm text-[#626262]">{resultsLabel}</p>
        </div>
      ) : (
        <div className="mt-6 inline-flex items-center gap-2 sm:gap-4">
          {mounted ? (
            <>
              <Unit val={pad(time.d)} label="Days" accent={accent} />
              <Sep accent={accent} />
              <Unit val={pad(time.h)} label="Hrs" accent={accent} />
              <Sep accent={accent} />
              <Unit val={pad(time.m)} label="Min" accent={accent} />
              <Sep accent={accent} />
              <Unit val={pad(time.s)} label="Sec" accent={accent} />
            </>
          ) : (
            <>
              <Unit val="00" label="Days" accent={accent} />
              <Sep accent={accent} />
              <Unit val="00" label="Hrs" accent={accent} />
              <Sep accent={accent} />
              <Unit val="00" label="Min" accent={accent} />
              <Sep accent={accent} />
              <Unit val="00" label="Sec" accent={accent} />
            </>
          )}
        </div>
      )}

      {phase !== "ENDED" ? (
        <p className="mt-4 text-sm text-[#626262]">{absoluteLabel}</p>
      ) : null}
    </section>
  );
}

function Unit({
  val,
  label,
  accent,
}: {
  val: string;
  label: string;
  accent: Accent;
}) {
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-1.5">
      <div
        className={`flex min-w-[56px] items-center justify-center rounded-[12px] border px-2.5 py-2.5 sm:min-w-[88px] sm:px-4 sm:py-3.5 ${ACCENT_TILE[accent]}`}
      >
        <span
          className={`font-heading text-[22px] font-semibold tabular-nums sm:text-[2.25rem] ${ACCENT_TEXT[accent]}`}
        >
          {val}
        </span>
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#787878]">
        {label}
      </span>
    </div>
  );
}

function Sep({ accent }: { accent: Accent }) {
  return (
    <span
      className={`-mt-4 font-heading text-[22px] font-semibold sm:-mt-5 sm:text-[2.25rem] ${ACCENT_TEXT[accent]}`}
    >
      :
    </span>
  );
}
