import { Sparkles, Trophy } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function Prizes() {
  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24">
      <h2
        className="bg-gradient-to-r from-white from-[75%] to-[#A5A5A5] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        Prizes
      </h2>
      <p className="mt-3 max-w-3xl text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#D2D2D2]">
        What you&apos;re competing for.
      </p>

      {HACKATHON.prizes.length === 0 ? (
        <div className="mt-12 max-w-2xl rounded-[20px] border border-[#03535F] bg-[#000000] p-6 sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#03535F]/40">
            <Trophy className="size-6 text-[#A6D2D5]" aria-hidden />
          </div>
          <p className="mt-5 text-base text-[#E9E9E9] sm:text-lg">
            Prizes announced soon, register now, we&apos;ll email you the moment
            they&apos;re live.
          </p>
        </div>
      ) : (
        <ul className="mt-12 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {HACKATHON.prizes.map((prize) => (
            <li
              key={prize.place}
              className="rounded-[20px] border border-[#03535F] bg-[#000000] p-6 transition-colors hover:border-[#076573]"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#03535F]/40">
                <Trophy className="size-6 text-[#A6D2D5]" aria-hidden />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                {prize.place}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#D2D2D2]">
                {prize.reward}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 max-w-2xl rounded-[20px] border border-[#03535F] bg-[#000000] p-6 sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[#03535F]/40">
          <Sparkles className="size-6 text-[#A6D2D5]" aria-hidden />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#A6D2D5]">
          Sponsored by {HACKATHON.sponsor.name}
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">
          {HACKATHON.sponsor.prizeTitle}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#D2D2D2]">
          {HACKATHON.sponsor.prizeReward}
        </p>
      </div>
    </section>
  );
}
