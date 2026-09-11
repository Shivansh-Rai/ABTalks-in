import type { WinnerPlace } from "@/components/hackathon/dashboard/vicodathon-winners";

export function WinnerCard({ place }: { place: WinnerPlace }) {
  return (
    <section className="rounded-2xl border border-[#E0E0E0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-6">
      <h2 className="font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.16em] text-[#03535F]">
        {place.placeLabel}
      </h2>
      <p className="mt-3 text-xl font-semibold tracking-tight text-black">
        {place.entryLabel}
      </p>
      <p className="mt-2 text-sm text-[#353535]">
        <span className="text-[#787878]">Problem statement · </span>
        {place.problemStatement}
      </p>

      <ul className="mt-4 space-y-3">
        {place.members.map((member) => {
          const meta = [
            member.college,
            member.graduationYear != null
              ? `Grad ${member.graduationYear}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <li
              key={`${place.place}-${member.fullName}`}
              className="rounded-xl border border-[#E0E0E0] bg-[#F4F4F4] px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-black">
                  {member.fullName}
                </p>
                <span className="rounded-md border border-[#03535F]/30 bg-[#E7F2F3] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#03535F]">
                  {member.role}
                </span>
              </div>
              {meta ? (
                <p className="mt-1 text-xs text-[#626262]">{meta}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
