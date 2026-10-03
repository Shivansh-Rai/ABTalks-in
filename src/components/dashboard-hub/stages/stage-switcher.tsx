"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageKey = "build" | "test" | "hired";

export type StageSummary = {
  key: StageKey;
  /** Panel id — also the hash that opens it (#build-skills …). */
  anchor: string;
  number: string;
  kicker: string | null;
  first: string;
  accent: string;
  pct: number;
  meta: string;
};

/* Stage illustrations (from the design): stacked layers, a target, and a
   flagged mountain — filled two-tone brand shapes, not line icons. */
function BuildIllustration() {
  return (
    <svg viewBox="0 0 48 48" className="size-9" aria-hidden="true">
      <path d="M24 27 L44 35 L24 43 L4 35 Z" fill="#A8DCD3" />
      <path d="M24 17.5 L44 25.5 L24 33.5 L4 25.5 Z" fill="#2BB39A" />
      <path d="M24 5 L44 13 L24 21 L4 13 Z" fill="#03535F" />
    </svg>
  );
}

function TestIllustration() {
  return (
    <svg viewBox="0 0 48 48" className="size-9" aria-hidden="true">
      <g stroke="#03535F" strokeWidth="3" strokeLinecap="round">
        <path d="M24 2.5v7M24 38.5v7M2.5 24h7M38.5 24h7" />
      </g>
      <circle cx="24" cy="24" r="13.5" fill="#fff" stroke="#03535F" strokeWidth="3.5" />
      <circle cx="24" cy="24" r="8.5" fill="#7FD9C4" />
      <circle cx="24" cy="24" r="3.8" fill="#03535F" />
    </svg>
  );
}

function HiredIllustration() {
  return (
    <svg viewBox="0 0 48 48" className="size-9" aria-hidden="true">
      <path d="M25 41 L35.5 23 L46 41 Z" fill="#8FCFC6" />
      <path d="M2 41 L19.5 12 L37 41 Z" fill="#03535F" />
      <path d="M19.5 12 V3" stroke="#03535F" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M19.5 3.2 L28 6.4 L19.5 9.6 Z" fill="#2BD4A0" />
    </svg>
  );
}

const ILLUSTRATIONS: Record<StageKey, () => React.JSX.Element> = {
  build: BuildIllustration,
  test: TestIllustration,
  hired: HiredIllustration,
};

type StageSwitcherProps = {
  stages: StageSummary[];
  /** Profile strength 0–100 — drives the "Complete your profile" tile. */
  profileScore: number;
  /** The first unfinished stage — gets "You are here" and opens by default. */
  current: StageKey;
  panels: Record<StageKey, ReactNode>;
};

/**
 * The three-stage rail and its panels. All panels are server-rendered; this
 * only toggles which one shows. Hash links open the right panel: a stage
 * anchor (#test-skills) or any element inside a panel (#events, #domains…),
 * so the header's section links keep working whichever stage is open.
 */
export function StageSwitcher({ stages, current, panels, profileScore }: StageSwitcherProps) {
  const profileDone = profileScore >= 100;
  const [selected, setSelected] = useState<StageKey>(current);
  /** Bumped on every tile click while the profile is unfinished: the pin
      can't leave the start, so it bounces and says so. */
  const [nudge, setNudge] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  const openFromHash = useCallback(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const stage = stages.find((s) => s.anchor === id);
    if (stage) {
      setSelected(stage.key);
      requestAnimationFrame(() =>
        railRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
      return;
    }
    const target = document.getElementById(id);
    const panel = target?.closest<HTMLElement>("[data-stage-panel]");
    const key = panel?.dataset.stagePanel as StageKey | undefined;
    if (!target || !key) return;
    setSelected(key);
    requestAnimationFrame(() =>
      target.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [stages]);

  useEffect(() => {
    // Arriving with a hash (e.g. /dashboard#events): open its panel once painted.
    const first = requestAnimationFrame(openFromHash);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [openFromHash]);

  const choose = (s: StageSummary) => {
    setSelected(s.key);
    if (!profileDone) setNudge((n) => n + 1);
    window.history.replaceState(null, "", `#${s.anchor}`);
  };

  return (
    <>
      <div ref={railRef} id="stages" className="scroll-mt-24">
        <div className="relative rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.46)_0%,rgba(255,255,255,0.28)_100%)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.35),0_20px_44px_-20px_rgba(3,83,95,0.4)] backdrop-blur-[10px] backdrop-saturate-[1.3] sm:p-3">
          <div
            role="tablist"
            aria-label="Your stages"
            className={cn("grid gap-2.5 sm:gap-3", profileDone ? "xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4")}
          >
            {/* Once the profile is complete the tile steps aside. */}
            {profileDone ? null : <ProfileTile score={profileScore} />}
            {stages.map((s) => {
              const Illustration = ILLUSTRATIONS[s.key];
              const active = s.key === selected;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  id={`${s.anchor}-tab`}
                  aria-selected={active}
                  aria-controls={s.anchor}
                  onClick={() => choose(s)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-[background-color,box-shadow,transform] duration-200 ease-[var(--ease-spark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                    active
                      ? "border border-white/80 bg-white/[0.78] text-black shadow-[0_14px_30px_-12px_rgba(3,40,45,0.45)] backdrop-blur-md"
                      : "border border-white/15 bg-[linear-gradient(160deg,var(--tab-idle-from,rgba(63,117,121,0.74))_0%,var(--tab-idle-to,rgba(45,95,99,0.72))_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md hover:-translate-y-0.5",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-16 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-12",
                      active ? "bg-[#E8F3F2]" : "bg-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.25)]",
                    )}
                    aria-hidden="true"
                  >
                    <Illustration />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em]">
                      <span className={active ? "text-[#03535F]" : "text-white/85"}>{s.number}</span>
                    </span>
                    <span className="mt-0.5 block font-heading text-xl font-bold leading-tight">
                      {s.first}{" "}
                      <span className={active ? "text-[#03535F]" : undefined}>{s.accent}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2 text-sm">
                      <span className="font-bold">{s.pct}%</span>
                      <span
                        className={cn("h-1.5 w-12 shrink-0 overflow-hidden rounded-full", active ? "bg-[#E1E7E7]" : "bg-white/25")}
                        aria-hidden="true"
                      >
                        <span
                          className={cn("block h-full rounded-full", active ? "bg-[#03535F]" : "bg-[#2BD4A0]")}
                          style={{ width: `${s.pct}%` }}
                        />
                      </span>
                      <span className={cn("truncate text-xs", active ? "text-[#4B4B4B]" : "text-white/80")}>
                        {s.meta}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <StageRoad stages={stages} selected={selected} profileDone={profileDone} nudge={nudge} />
        </div>
      </div>

      {stages.map((s) => (
        <div
          key={s.key}
          id={s.anchor}
          role="tabpanel"
          aria-labelledby={`${s.anchor}-tab`}
          data-stage-panel={s.key}
          hidden={s.key !== selected}
          className="scroll-mt-24 pt-10"
        >
          {panels[s.key]}
        </div>
      ))}
    </>
  );
}

/* ─── The road the stages sit on ─────────────────────────────
   A wavy dotted road in a 1000×40 box (x stretches to the tray width,
   y is real pixels). A map pin marks the selected stage; switching
   stages walks it along the curve in small hops. */

const ROAD_H = 30;
/** Pin stops with only the three stage tiles (profile complete). */
const PIN_STOPS: Record<StageKey, number> = { build: 22, test: 500, hired: 945 };
/** Start of the road, under the Complete your profile tile. */
const PROFILE_STOP = 30;

/** Height of the road at x (0–1000), in px from the top of the road box. */
function roadY(x: number): number {
  return 16 + 8 * Math.sin((x / 1000) * Math.PI * 4 + 0.4);
}

const ROAD_D = Array.from({ length: 101 }, (_, i) => {
  const x = i * 10;
  return `${i === 0 ? "M" : "L"}${x} ${roadY(x).toFixed(2)}`;
}).join(" ");

function StageRoad({
  stages,
  selected,
  profileDone,
  nudge,
}: {
  stages: StageSummary[];
  selected: StageKey;
  /** Until the profile is complete the pin waits at the start (under it). */
  profileDone: boolean;
  /** Changes when a tile is clicked with the profile unfinished. */
  nudge: number;
}) {
  const target = profileDone ? PIN_STOPS[selected] : PROFILE_STOP;
  const [pin, setPin] = useState({ x: target, hop: 0 });
  const xRef = useRef(target);

  useEffect(() => {
    const from = xRef.current;
    const to = target;
    if (from === to) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      xRef.current = to;
      const id = requestAnimationFrame(() => setPin({ x: to, hop: 0 }));
      return () => cancelAnimationFrame(id);
    }
    // Walks in distinct hops: each hop covers an equal stretch of road,
    // eases in and out, then the pin rests on the road before the next.
    const hops = Math.max(4, Math.round(Math.abs(to - from) / 45));
    const HOP_MS = 130;
    const MOVE = 0.7; // share of each hop spent in the air; the rest is a pause
    const duration = HOP_MS * hops;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const elapsed = Math.min(duration, now - start);
      const i = Math.min(hops - 1, Math.floor(elapsed / HOP_MS));
      const local = Math.min(1, (elapsed - i * HOP_MS) / (HOP_MS * MOVE));
      const eased = local < 0.5 ? 2 * local * local : 1 - (-2 * local + 2) ** 2 / 2;
      const x = from + ((to - from) * (i + eased)) / hops;
      xRef.current = x;
      setPin({ x, hop: Math.sin(local * Math.PI) * 4 });
      if (elapsed < duration) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const label = stages.find((s) => s.key === selected);
  return (
    <>
    <div className="relative mt-1 hidden xl:block" style={{ height: ROAD_H }}>
      <svg className="absolute inset-0 block size-full overflow-visible" viewBox={`0 0 1000 ${ROAD_H}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={ROAD_D} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={ROAD_D} fill="none" stroke="#03535F" strokeOpacity="0.4" strokeWidth="1.6" strokeDasharray="3 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Goal at the end of the road. */}
      <span
        className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2BD4A0] shadow-[0_0_0_4px_rgba(43,212,160,0.25)]"
        style={{ left: "calc(100% - 14px)", top: roadY(986) }}
        aria-hidden="true"
      />

      {/* Map pin: its tip sits on the road; it lifts off the road on each hop. */}
      <span
        className="pointer-events-none absolute"
        style={{ left: `${pin.x / 10}%`, top: roadY(pin.x) }}
        role="img"
        aria-label={label ? `You're on ${label.first} ${label.accent}` : undefined}
      >
        <span
          className="absolute left-0 top-0 h-1.5 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#03535F]/25"
          style={{ transform: `translate(-50%, -50%) scale(${1 - pin.hop / 14})` }}
          aria-hidden="true"
        />
        {/* Keyed on nudge so each blocked click replays the bounce. */}
        <span key={nudge} className={cn("absolute left-0 top-0", nudge > 0 && "pin-stuck")}>
          <svg
            viewBox="0 0 24 32"
            className="absolute left-0 top-0 h-8 w-6 drop-shadow-[0_3px_4px_rgba(3,40,45,0.35)]"
            style={{ transform: `translate(-50%, calc(-100% - ${pin.hop}px))` }}
            aria-hidden="true"
          >
            <path d="M12 31 C 12 31 2 19 2 11.5 A 10 10 0 0 1 22 11.5 C 22 19 12 31 12 31 Z" fill="#03535F" stroke="#fff" strokeWidth="1.5" />
            <circle cx="12" cy="11.5" r="4" fill="#2BD4A0" />
          </svg>
        </span>
      </span>

    </div>

    {/* Thought bubble when the pin is stuck. It gets its own room: this slot
        opens below the road, holds, then closes, so the bubble never sits on
        top of anything. Pure CSS, keyed on nudge to replay; hovering pauses
        it so the link can be clicked. */}
    {nudge > 0 && !profileDone ? (
      <div key={nudge} className="pin-thought-slot relative hidden overflow-hidden xl:block" role="status">
        <div className="absolute top-0" style={{ left: `${pin.x / 10}%` }}>
          <span className="absolute left-[2px] top-[4px] size-2 rounded-full bg-white shadow-[0_1px_4px_rgba(3,40,45,0.25)]" aria-hidden="true" />
          <span className="absolute left-[10px] top-[13px] size-3 rounded-full bg-white shadow-[0_1px_4px_rgba(3,40,45,0.25)]" aria-hidden="true" />
          <p className="absolute left-[16px] top-[26px] whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-sm text-[#1F1F1F] shadow-[0_6px_16px_-6px_rgba(3,40,45,0.4)]">
            <span className="font-heading font-bold text-[#C62D1F]">Oh nooo!!</span>{" "}I can&apos;t move forward till
            you complete your profile.{" "}
            <Link
              href="/profile"
              className="font-semibold text-[#03535F] underline decoration-[1.5px] underline-offset-4 hover:decoration-2"
            >
              Do that now →
            </Link>
          </p>
        </div>
      </div>
    ) : null}
    </>
  );
}
/* ─── Complete your profile (first tile; links to /profile) ────
   Incomplete: a warm red alert tile with a pulsing dot to pull the eye.
   Complete: calm white with a check in the corner and "100% completed". */

function ProfileTile({ score }: { score: number }) {
  const done = score >= 100;
  return (
    <Link
      href="/profile"
      className={cn(
        "relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        done
          ? "border border-white/80 bg-white/[0.78] text-black shadow-[0_14px_30px_-12px_rgba(3,40,45,0.35)] backdrop-blur-md"
          : "border border-[#FFB3A7] bg-[linear-gradient(150deg,#FFF1EE_0%,#FFD9D2_100%)] text-[#5A1208] shadow-[0_12px_28px_-12px_rgba(224,58,40,0.55)]",
      )}
    >
      {done ? (
        <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-[#2BD4A0] text-[#053B33]" aria-label="Completed">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span className="absolute right-3 top-3 flex size-2.5" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#E5392A] opacity-70" />
          <span className="relative inline-flex size-2.5 rounded-full bg-[#E5392A]" />
        </span>
      )}
      <span
        className={cn(
          "flex size-16 shrink-0 items-center justify-center rounded-2xl",
          done ? "bg-[#E8F3F2] text-[#03535F]" : "bg-white text-[#E5392A] shadow-[0_4px_10px_-4px_rgba(224,58,40,0.45)]",
        )}
        aria-hidden="true"
      >
        <UserRound className="size-10" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-xs font-semibold tracking-[0.14em]", done ? "text-[#03535F]" : "text-[#C62D1F]")}>
          {done ? "DONE" : "START HERE"}
        </span>
        <span className="mt-0.5 block font-heading text-xl font-bold leading-tight">
          Complete <span className={done ? "text-[#03535F]" : "text-[#C62D1F]"}>profile</span>
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-sm">
          <span className="font-bold">{score}%</span>
          <span className={cn("h-1.5 w-12 shrink-0 overflow-hidden rounded-full", done ? "bg-[#E1E7E7]" : "bg-white/70")} aria-hidden="true">
            <span className={cn("block h-full rounded-full", done ? "bg-[#03535F]" : "bg-[#E5392A]")} style={{ width: `${score}%` }} />
          </span>
          <span className={cn("truncate text-xs", done ? "text-[#4B4B4B]" : "text-[#8A2A1E]")}>
            {done ? "completed" : "finish it now"}
          </span>
        </span>
      </span>
    </Link>
  );
}
