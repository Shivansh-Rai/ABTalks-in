"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Circle, Lock, SkipForward } from "lucide-react";
import type { CurriculumDay, DayState } from "@/features/program/progression";
import { cn } from "@/lib/utils";

function StateIcon({ state }: { state: DayState }) {
  switch (state) {
    case "PASSED":
      return <CheckCircle2 className="size-4 text-emerald-400" />;
    case "SKIPPED":
      return <SkipForward className="size-4 text-amber-400" />;
    case "AVAILABLE":
      return <Circle className="size-4 animate-pulse text-[#968BEC]" />;
    default:
      return <Lock className="size-4 text-[#8F8F8F]" />;
  }
}

function DaySidebar({
  currentDay,
  moduleNumber,
  moduleTitle,
  days,
}: {
  currentDay: number;
  moduleNumber: number;
  moduleTitle: string;
  days: CurriculumDay[];
}) {
  const moduleDays = days.filter((d) => d.moduleNumber === moduleNumber);

  return (
    <aside className="sticky top-20 flex h-auto max-h-[50vh] flex-col overflow-hidden rounded-[20px] border border-[#8365E3] bg-[#040B1C] lg:h-[calc(100svh-5.5rem)] lg:max-h-none">
      <div className="shrink-0 border-b border-[#8365E3]/40 bg-gradient-to-b from-[#7528C9]/30 to-transparent px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#968BEC]">
          Phase {moduleNumber}
        </p>
        <p className="mt-1 text-sm font-medium text-white">{moduleTitle}</p>
        <p className="mt-3 font-display text-2xl font-bold text-white/90">
          Day {currentDay}
        </p>
      </div>
      <nav
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3"
        aria-label="Days in this phase"
      >
        {moduleDays.map((d) => {
          const locked = d.state === "LOCKED";
          const active = d.dayNumber === currentDay;
          const className = cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
            active
              ? "bg-[#7364E6]/25 text-white"
              : locked
                ? "cursor-not-allowed text-[#8F8F8F]"
                : "text-[#BCBCBC] hover:bg-white/5 hover:text-white",
          );

          if (locked) {
            return (
              <span key={d.dayNumber} className={className}>
                <StateIcon state={d.state} />
                <span className="truncate">
                  Day {d.dayNumber}
                  <span className="ml-1 hidden text-xs opacity-70 sm:inline">
                    · {d.title}
                  </span>
                </span>
              </span>
            );
          }

          return (
            <Link
              key={d.dayNumber}
              href={`/program/day/${d.dayNumber}`}
              className={className}
              aria-current={active ? "page" : undefined}
            >
              <StateIcon state={d.state} />
              <span className="truncate">
                Day {d.dayNumber}
                <span className="ml-1 hidden text-xs opacity-70 sm:inline">
                  · {d.title}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function DayMetaTag({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "required";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold md:text-sm",
        variant === "required"
          ? "border-[#FF4B4B]/60 bg-[#FF4B4B]/10 text-[#FF8A8A]"
          : "border-[#8365E3]/50 bg-[#110528] text-[#BCBCBC]",
      )}
    >
      {children}
    </span>
  );
}

export function DayShell({
  dayNumber,
  dayTitle,
  moduleNumber,
  moduleTitle,
  days,
  estimatedMin,
  missionPoints,
  onConceptCheckClick,
  children,
}: {
  dayNumber: number;
  dayTitle: string;
  moduleNumber: number;
  moduleTitle: string;
  days: CurriculumDay[];
  estimatedMin: number;
  missionPoints: number;
  onConceptCheckClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -my-6 min-h-[calc(100svh-4rem)] bg-[#030712] px-4 py-6 text-white md:-mx-4 md:px-6">
      <header className="mb-6 flex flex-wrap items-center gap-4 md:gap-6">
        <Link href="/program/dashboard" className="shrink-0">
          <Image
            src="/program/abtalks-mark.png"
            alt="ABTalks"
            width={202}
            height={53}
            className="h-8 w-auto md:h-9"
            priority
          />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full bg-[#FF4B4B]"
            aria-hidden
          />
          <p className="truncate text-sm font-semibold text-[#BCBCBC] md:text-base">
            Phase {moduleNumber}: {moduleTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onConceptCheckClick}
          disabled={!onConceptCheckClick}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-[12px] border border-black bg-[#7364E6] px-4 text-sm font-semibold text-white shadow-[inset_3px_3px_3px_0_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Concept check →
        </button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(240px,352px)_1fr] lg:items-stretch">
        <div className="hidden lg:block">
          <DaySidebar
            currentDay={dayNumber}
            moduleNumber={moduleNumber}
            moduleTitle={moduleTitle}
            days={days}
          />
        </div>

        <div className="min-w-0 space-y-5">
          <div className="relative overflow-hidden rounded-[16px] border border-[#8365E3]/30 bg-gradient-to-br from-[#7528C9]/40 via-[#110528] to-[#030712] px-5 py-6 md:px-7 md:py-8">
            <p className="text-xs font-bold uppercase tracking-wider text-[#968BEC]">
              Day {dayNumber}
            </p>
            <h1 className="mt-1.5 max-w-3xl font-display text-xl font-bold tracking-tight text-white md:text-2xl">
              {dayTitle}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <DayMetaTag>{missionPoints} pts</DayMetaTag>
              <DayMetaTag>~{estimatedMin} min est.</DayMetaTag>
              <DayMetaTag variant="required">Required</DayMetaTag>
            </div>
          </div>

          {/* Mobile day rail */}
          <div className="lg:hidden">
            <DaySidebar
              currentDay={dayNumber}
              moduleNumber={moduleNumber}
              moduleTitle={moduleTitle}
              days={days}
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
