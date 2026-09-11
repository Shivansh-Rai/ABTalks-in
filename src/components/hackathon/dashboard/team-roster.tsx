import type { HackathonMember } from "@/features/hackathon/get-my-registration";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { RemoveMemberButton } from "@/components/hackathon/dashboard/remove-member-button";

type Props = {
  entryType: "SOLO" | "TEAM";
  teamName: string | null;
  members: HackathonMember[];
  canManage: boolean;
};

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function TeamRoster({
  entryType,
  teamName,
  members,
  canManage,
}: Props) {
  const openSpots =
    entryType === "TEAM"
      ? Math.max(0, HACKATHON.maxTeamSize - members.length)
      : 0;

  const heading =
    entryType === "SOLO"
      ? "Your entry"
      : `${teamName ?? "Your team"} · ${members.length}/${HACKATHON.maxTeamSize}`;

  return (
    <section className="rounded-2xl border border-[#E0E0E0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-6">
      <h2 className="font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.16em] text-[#03535F]">
        {heading}
      </h2>
      <ul className="mt-4 space-y-3">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-3 rounded-xl border border-[#E0E0E0] bg-[#F4F4F4] px-3 py-3"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E7F2F3] text-sm font-semibold text-[#03535F]"
              aria-hidden
            >
              {initials(member.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-black">
                  {member.fullName}
                </p>
                {member.isLeader ? (
                  <span className="rounded-md border border-[#03535F]/30 bg-[#E7F2F3] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#03535F]">
                    Leader
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-[#626262]">{member.college}</p>
            </div>
            {canManage && !member.isLeader ? (
              <RemoveMemberButton
                participantId={member.id}
                memberName={member.fullName}
              />
            ) : null}
          </li>
        ))}
        {Array.from({ length: openSpots }).map((_, i) => (
          <li
            key={`open-${i}`}
            className="flex items-center gap-3 rounded-xl border border-dashed border-[#E0E0E0] bg-transparent px-3 py-3"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-[#D2D2D2] text-sm text-[#787878]"
              aria-hidden
            >
              ?
            </span>
            <p className="text-sm text-[#787878]">Open spot</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
