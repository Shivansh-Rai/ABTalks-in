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
    <aside className="sticky top-20 flex h-fit flex-col overflow-hidden rounded-[20px] border border-[#8365E3] bg-[#040B1C]">
      <div className="border-b border-[#8365E3]/40 bg-gradient-to-b from-[#7528C9]/30 to-transparent px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#968BEC]">
          Phase {moduleNumber}
        </p>
        <p className="mt-1 text-sm font-medium text-white">{moduleTitle}</p>
        <p className="mt-3 font-display text-4xl font-bold text-white/90">
          Day {currentDay}
        </p>
      </div>
      <nav className="max-h-[60vh] space-y-0.5 overflow-y-auto p-3" aria-label="Days in this phase">
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

export function DayShell({
  dayNumber,
  dayTitle,
  moduleNumber,
  moduleTitle,
  days,
  children,
}: {
  dayNumber: number;
  dayTitle: string;
  moduleNumber: number;
  moduleTitle: string;
  days: CurriculumDay[];
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
            className="h-10 w-auto md:h-12"
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
        <a
          href="#concept-check"
          className="inline-flex h-[58px] shrink-0 items-center justify-center rounded-[15px] border border-black bg-[#7364E6] px-6 text-base font-semibold text-white shadow-[inset_4px_4px_4px_0_rgba(0,0,0,0.5)] md:text-xl"
        >
          Concept check →
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,352px)_1fr]">
        <div className="hidden lg:block">
          <DaySidebar
            currentDay={dayNumber}
            moduleNumber={moduleNumber}
            moduleTitle={moduleTitle}
            days={days}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <div className="relative overflow-hidden rounded-[20px] border border-[#8365E3]/30 bg-gradient-to-br from-[#7528C9]/40 via-[#110528] to-[#030712] px-6 py-10 md:px-10 md:py-14">
            <p className="text-sm font-bold uppercase tracking-wider text-[#968BEC]">
              Day {dayNumber}
            </p>
            <h1 className="mt-2 max-w-3xl font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
              {dayTitle}
            </h1>
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
