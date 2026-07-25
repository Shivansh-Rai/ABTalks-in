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
  let accent: "purple" | "cyan" | "red" | "muted" = "purple";
  let absoluteLabel: string = HACKATHON.kickoffLabel;

  if (phase === "LIVE") {
    label = "TIME LEFT TO SUBMIT";
    accent = underOneHour ? "red" : "cyan";
    absoluteLabel = HACKATHON.deadlineLabel;
  } else if (phase === "ENDED") {
    label = "SUBMISSIONS CLOSED";
    accent = "muted";
    absoluteLabel = resultsLabel;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center sm:px-6">
      <p
        className={`text-xs font-semibold uppercase tracking-[0.2em] ${
          accent === "purple"
            ? "text-[#A78BFA]"
            : accent === "cyan"
              ? "text-cyan-300"
              : accent === "red"
                ? "animate-pulse text-red-400"
                : "text-zinc-400"
        }`}
      >
        {label}
      </p>

      {phase === "ENDED" ? (
        <div className="mt-6 space-y-3">
          <p
            className="text-2xl tracking-wider text-zinc-400 sm:text-3xl"
            style={{ fontFamily: '"DSEG7 Classic", monospace' }}
          >
            CLOSED
          </p>
          <p
            className="text-sm text-zinc-400"
            style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
          >
            {resultsLabel}
          </p>
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
        <p className="mt-4 text-sm text-zinc-400">{absoluteLabel}</p>
      ) : null}
    </section>
  );
}

function unitBackground(accent: "purple" | "cyan" | "red" | "muted") {
  if (accent === "cyan") {
    return "radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.85) 0%, rgba(6, 95, 70, 0.9) 50%, rgba(0, 0, 0, 1) 100%)";
  }
  if (accent === "red") {
    return "radial-gradient(circle at 50% 50%, rgba(248, 113, 113, 0.9) 0%, rgba(127, 29, 29, 0.95) 50%, rgba(0, 0, 0, 1) 100%)";
  }
  if (accent === "muted") {
    return "radial-gradient(circle at 50% 50%, rgba(113, 113, 122, 0.7) 0%, rgba(39, 39, 42, 0.95) 50%, rgba(0, 0, 0, 1) 100%)";
  }
  return "radial-gradient(circle at 50% 50%, rgba(118, 74, 194, 1) 0%, rgba(62, 34, 111, 1) 50%, rgba(0, 0, 0, 1) 100%)";
}

function Unit({
  val,
  label,
  accent,
}: {
  val: string;
  label: string;
  accent: "purple" | "cyan" | "red" | "muted";
}) {
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-1.5">
      <div
        className="relative flex min-w-[56px] items-center justify-center rounded-xl border border-[#1E1B37] px-2.5 py-2.5 sm:min-w-[88px] sm:px-4 sm:py-3.5"
        style={{ background: unitBackground(accent) }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute text-[22px] font-normal tracking-wider text-white/15 sm:text-[2.25rem]"
          style={{ fontFamily: '"DSEG7 Classic", monospace' }}
        >
          88
        </span>
        <span
          className="relative text-[22px] font-normal tracking-wider text-white sm:text-[2.25rem]"
          style={{ fontFamily: '"DSEG7 Classic", monospace' }}
        >
          {val}
        </span>
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#BCBCBC] sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

function Sep({ accent }: { accent: "purple" | "cyan" | "red" | "muted" }) {
  return (
    <span
      className={`-mt-4 text-[22px] font-normal sm:-mt-5 sm:text-[2.25rem] ${
        accent === "muted" ? "text-zinc-500" : "text-white"
      }`}
      style={{ fontFamily: '"DSEG7 Classic", monospace' }}
    >
      :
    </span>
  );
}
