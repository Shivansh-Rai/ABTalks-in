import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
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

const STATE_LABEL: Record<PracticeDayRow["state"], string> = {
  COMPLETE: "Complete",
  OPEN: "Open",
  LOCKED_PREVIOUS: "Locked",
  LOCKED_DATE: "Locked",
  NOT_STARTED: "Locked",
};

/** The 15 days of a challenge, two questions each. Server component. */
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
    <ol className="space-y-3">
      {rows.map((row) => {
        const open = row.state === "OPEN" || row.state === "COMPLETE";
        return (
          <li
            key={row.day}
            className={cn(
              "rounded-2xl border border-[#E0E0E0] bg-white p-4 sm:p-5",
              open ? "" : "bg-[#FAFAFA]",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-base font-semibold text-black">
                Day {row.day}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  row.state === "COMPLETE"
                    ? "bg-emerald-50 text-emerald-700"
                    : row.state === "OPEN"
                      ? "bg-[#E7F2F3] text-[#03535F]"
                      : "bg-[#F4F4F4] text-[#6B7280]",
                )}
              >
                {open ? null : <Lock className="size-3" aria-hidden="true" />}
                {STATE_LABEL[row.state]}
              </span>
            </div>

            {row.lockNote ? (
              <p className="mt-1 text-sm text-[#6B7280]">{row.lockNote}</p>
            ) : null}

            {row.entry && open ? (
              <ul className="mt-3 divide-y divide-[#F0F0F0]">
                {row.entry.questions.map((q) => (
                  <li key={q.slot}>
                    <Link
                      href={`${PRACTICE_BASE}/${challenge}/${row.day}/${q.slot}`}
                      className="group flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <CheckCircle2
                          className={cn(
                            "size-4 shrink-0",
                            solved.has(q.activityId)
                              ? "text-emerald-600"
                              : "text-[#D4D4D4]",
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium text-black group-hover:text-[#03535F]">
                          {q.title}
                        </span>
                        {solved.has(q.activityId) ? (
                          <span className="sr-only">Solved</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 rounded-full bg-[#F4F4F4] px-2 py-0.5 text-xs font-medium text-[#4B4B4B]">
                        {q.difficulty}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
