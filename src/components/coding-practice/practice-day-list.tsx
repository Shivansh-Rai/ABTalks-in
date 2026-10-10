import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Circle, Lock } from "lucide-react";
import { PRACTICE_BASE } from "@/features/coding-practice/constants";
import type { PracticeDayIndexEntry } from "@/features/coding-practice/content";
import type { PracticeDayState } from "@/features/coding-practice/progression";
import { cn } from "@/lib/utils";

export type PracticeDayRow = {
  day: number;
  /** Null for a day whose questions are not published yet. */
  entry: PracticeDayIndexEntry | null;
  /** "NOT_STARTED" before the learner has started the challenge. */
  state: PracticeDayState | "NOT_STARTED";
  /** Why a locked day is locked, ready to show. */
  lockNote: string | null;
};

const DIFFICULTY_CLASS: Record<string, string> = {
  Easy: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  Hard: "bg-red-50 text-red-700",
};

/**
 * The days of a challenge as a timeline: a numbered marker per day, joined by
 * a line, with that day's two questions beside it. Server component.
 */
export function PracticeDayList({
  challenge,
  rows,
  solved,
}: {
  challenge: string;
  rows: PracticeDayRow[];
  solved: ReadonlySet<string>;
}) {
  return (
    <ol>
      {rows.map((row, index) => {
        const complete = row.state === "COMPLETE";
        const open = row.state === "OPEN" || complete;
        const questions = row.entry?.questions ?? [];
        const done = questions.filter((q) => solved.has(q.activityId)).length;
        const last = index === rows.length - 1;

        return (
          <li
            key={row.day}
            id={`day-${row.day}`}
            className="relative flex scroll-mt-24 gap-3 pb-4 sm:gap-4"
          >
            {/* Marker and the line down to the next day */}
            <div className="flex flex-none flex-col items-center">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-sm font-bold",
                  complete
                    ? "bg-emerald-600 text-white"
                    : row.state === "OPEN"
                      ? "bg-[#03535F] text-white ring-4 ring-[#D4EBEC]"
                      : "bg-white text-[#8F8F8F] ring-1 ring-[#E0E0E0]",
                )}
              >
                {complete ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : open ? (
                  row.day
                ) : (
                  <Lock className="size-3.5" aria-hidden="true" />
                )}
              </span>
              {last ? null : (
                <span
                  className={cn(
                    "mt-1 w-0.5 flex-1 rounded-full",
                    complete ? "bg-emerald-300" : "bg-[#E0E0E0]",
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            <div
              className={cn(
                "min-w-0 flex-1 rounded-2xl border bg-white transition-shadow",
                row.state === "OPEN"
                  ? "border-[#03535F]/40 shadow-[0_8px_24px_-12px_rgba(3,83,95,0.35)]"
                  : "border-[#E0E0E0]",
                open ? "" : "opacity-80",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3.5 sm:px-5">
                <h2 className="font-heading text-base font-semibold text-black">
                  Day {row.day}
                </h2>
                {complete ? (
                  <span className="text-xs font-semibold text-emerald-700">
                    Complete
                  </span>
                ) : row.state === "OPEN" ? (
                  <span className="text-xs font-semibold text-[#03535F]">
                    {done} of {questions.length} solved
                  </span>
                ) : (
                  <span className="text-xs font-medium text-[#8F8F8F]">
                    Locked
                  </span>
                )}
              </div>

              {row.lockNote ? (
                <p className="px-4 pb-3.5 pt-1 text-sm text-[#6B7280] sm:px-5">
                  {row.lockNote}
                </p>
              ) : null}

              {open ? (
                <ul className="mt-2 border-t border-[#F0F0F0]">
                  {questions.map((q) => {
                    const isSolved = solved.has(q.activityId);
                    return (
                      <li
                        key={q.slot}
                        className="border-b border-[#F0F0F0] last:border-b-0"
                      >
                        <Link
                          href={`${PRACTICE_BASE}/${challenge}/${row.day}/${q.slot}`}
                          className="group flex items-center gap-3 px-4 py-3 text-sm transition-colors last:rounded-b-2xl hover:bg-[#F7FBFB] focus-visible:bg-[#F7FBFB] focus-visible:outline-none sm:px-5"
                        >
                          {isSolved ? (
                            <CheckCircle2
                              className="size-5 flex-none text-emerald-600"
                              aria-label="Solved"
                            />
                          ) : (
                            <Circle
                              className="size-5 flex-none text-[#D4D4D4]"
                              aria-hidden="true"
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate font-medium text-black group-hover:text-[#03535F]">
                            {q.title}
                          </span>
                          <span
                            className={cn(
                              "flex-none rounded-full px-2 py-0.5 text-xs font-semibold",
                              DIFFICULTY_CLASS[q.difficulty] ??
                                "bg-[#F4F4F4] text-[#4B4B4B]",
                            )}
                          >
                            {q.difficulty}
                          </span>
                          <ArrowRight
                            className="hidden size-4 flex-none text-[#8F8F8F] transition-transform group-hover:translate-x-0.5 group-hover:text-[#03535F] sm:block"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : row.lockNote ? null : (
                <div className="pb-3.5" />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
