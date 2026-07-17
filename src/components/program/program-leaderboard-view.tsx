"use client";

import type { ProgramLeaderboardRow } from "@/features/program/leaderboard";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

function PodiumCard({
  row,
  place,
}: {
  row: ProgramLeaderboardRow;
  place: 1 | 2 | 3;
}) {
  const isFirst = place === 1;

  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative", isFirst ? "mb-5" : "mb-4")}>
        {isFirst && (
          <div
            className="absolute -top-10 left-1/2 -translate-x-1/2 text-5xl"
            aria-hidden
          >
            👑
          </div>
        )}

        <div
          className={cn(
            "flex items-center justify-center rounded-full object-cover font-bold text-white shadow-xl",
            isFirst
              ? "h-28 w-28 border-[5px] border-yellow-400 bg-[#5B4BDB] text-3xl shadow-[0_0_35px_rgba(250,204,21,.5)]"
              : place === 2
                ? "h-20 w-20 border-4 border-slate-300 bg-[#5B4BDB] text-2xl"
                : "h-20 w-20 border-4 border-orange-400 bg-[#5B4BDB] text-2xl",
          )}
        >
          {initials(row.fullName)}
        </div>

        <div
          className={cn(
            "absolute -right-1 -bottom-1 flex items-center justify-center rounded-full font-bold shadow-lg",
            isFirst
              ? "h-10 w-10 bg-yellow-400 text-black"
              : place === 2
                ? "h-8 w-8 bg-slate-200 text-slate-800"
                : "h-8 w-8 bg-orange-400 text-black",
          )}
        >
          {place}
        </div>
      </div>

      <div
        className={cn(
          "rounded-t-3xl text-center shadow-2xl",
          isFirst
            ? "relative w-52 border border-yellow-400/20 bg-gradient-to-b from-yellow-500/15 via-slate-900 to-slate-950 p-7 shadow-[0_15px_50px_rgba(250,204,21,.2)]"
            : "w-48 border border-white/10 bg-gradient-to-b from-slate-800 to-slate-900 p-6",
        )}
      >
        {/* {isFirst && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-semibold text-yellow-300">
            TOP 1
          </div>
        )} */}

        <h3
          className={cn(
            "truncate text-white",
            isFirst ? "text-xl font-bold" : "text-lg font-semibold",
          )}
        >
          {row.fullName}
        </h3>

        <p className="mt-1 truncate text-sm text-slate-400">
          {row.company} · {row.jobRole}
        </p>

        <div
          className={cn(
            "mt-5 font-bold",
            isFirst
              ? "mt-6 text-4xl font-extrabold text-yellow-300"
              : "text-3xl text-slate-100",
          )}
        >
          {row.totalScore.toLocaleString()}
        </div>

        <p className="mt-1 text-sm text-slate-400">Total Score</p>

        <div
          className={cn(
            "mt-6 rounded-xl bg-gradient-to-b to-transparent",
            isFirst
              ? "mt-7 h-56 from-yellow-400/20"
              : place === 2
                ? "h-40 from-slate-500/20"
                : "h-28 from-orange-400/20",
          )}
        />
      </div>
    </div>
  );
}

export function ProgramLeaderboardView({
  rows,
}: {
  rows: ProgramLeaderboardRow[];
}) {
  const first = rows.find((r) => r.rank === 1) ?? null;
  const second = rows.find((r) => r.rank === 2) ?? null;
  const third = rows.find((r) => r.rank === 3) ?? null;

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100svh-3.5rem)] bg-[#040A12] px-4 py-6 text-white md:-mx-4 md:px-6">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
          Leaderboard
        </h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">
          Sorted by total score, then projects, missions, enrollment date.
        </p>
      </header>

      {(first || second || third) && (
        <div className="mx-auto mb-12 flex max-w-5xl flex-col items-center justify-center gap-6 overflow-x-auto py-8 sm:flex-row sm:items-end sm:py-12">
          {second && <PodiumCard row={second} place={2} />}
          {first && <PodiumCard row={first} place={1} />}
          {third && <PodiumCard row={third} place={3} />}
        </div>
      )}

      {rows.length === 0 && (
        <p className="rounded-2xl border border-[#1E293B] bg-[#0A0F1C] px-6 py-10 text-center text-sm text-[#9CA3AF]">
          No ranked members yet. Complete missions to appear on the board.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[#1E293B] bg-[#070B14]/80">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#1E293B] text-xs font-semibold tracking-wide text-[#64748B] uppercase">
                <th className="px-5 py-4">Rank</th>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Company</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4 text-center">Yrs</th>
                <th className="px-5 py-4 text-center">M/C/C/P</th>
                <th className="px-5 py-4 text-center">Clean%</th>
                <th className="px-5 py-4 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.memberId}
                  className={cn(
                    "border-b border-[#1E293B]/80 last:border-0",
                    row.isViewer && "bg-[#7364E6]/10",
                  )}
                >
                  <td className="px-5 py-4 font-semibold text-white">
                    {row.rank}
                  </td>
                  <td className="px-5 py-4 text-white">{row.fullName}</td>
                  <td className="px-5 py-4 text-[#E2E8F0]">{row.company}</td>
                  <td className="px-5 py-4 text-[#E2E8F0]">{row.jobRole}</td>
                  <td className="px-5 py-4 text-center text-white">
                    {row.yearsExperience}
                  </td>
                  <td className="px-5 py-4 text-center text-[#94A3B8]">
                    {row.missionPoints}/{row.conceptPoints}/{row.commitPoints}/
                    {row.projectPoints}
                  </td>
                  <td className="px-5 py-4 text-center text-[#94A3B8]">
                    {row.cleanPassPct}%
                  </td>
                  <td className="px-5 py-4 text-center text-base font-bold text-white">
                    {row.totalScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
