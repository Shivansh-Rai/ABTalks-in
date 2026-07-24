import type { HackathonMember } from "@/lib/hackathon-supabase";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

type Props = {
  entryType: "SOLO" | "TEAM";
  teamName: string | null;
  members: HackathonMember[];
};

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function TeamRoster({ entryType, teamName, members }: Props) {
  const openSpots =
    entryType === "TEAM"
      ? Math.max(0, HACKATHON.maxTeamSize - members.length)
      : 0;

  const heading =
    entryType === "SOLO"
      ? "Your entry"
      : `${teamName ?? "Your team"} · ${members.length}/${HACKATHON.maxTeamSize}`;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
        {heading}
      </h2>
      <ul className="mt-4 space-y-3">
        {members.map((member) => (
          <li
            key={`${member.slotIndex}-${member.fullName}`}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-3"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2C1BA9]/20 text-sm font-semibold text-[#C4B5FD]"
              aria-hidden
            >
              {initials(member.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-white">
                  {member.fullName}
                </p>
                {member.isLeader ? (
                  <span className="rounded-md border border-[#7364E6]/40 bg-[#7364E6]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C4B5FD]">
                    Leader
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-zinc-400">{member.college}</p>
            </div>
          </li>
        ))}
        {Array.from({ length: openSpots }).map((_, i) => (
          <li
            key={`open-${i}`}
            className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-transparent px-3 py-3"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 text-sm text-zinc-500"
              aria-hidden
            >
              ?
            </span>
            <p className="text-sm text-zinc-500">Open spot</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
