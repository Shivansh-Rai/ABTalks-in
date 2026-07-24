import { Trophy } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function Prizes() {
  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24">
      <h2
        className="bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
      >
        Prizes
      </h2>
      <p className="mt-3 max-w-3xl text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#BCBCBC]">
        What you&apos;re competing for.
      </p>

      {HACKATHON.prizes.length === 0 ? (
        <div className="mt-12 max-w-2xl rounded-[20px] border border-[#403880] bg-[#030712] p-6 sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#403880]/40">
            <Trophy className="size-6 text-[#968BEC]" aria-hidden />
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
              className="rounded-[20px] border border-[#403880] bg-[#030712] p-6 transition-colors hover:border-[#7364E6]"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#403880]/40">
                <Trophy className="size-6 text-[#968BEC]" aria-hidden />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                {prize.place}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#BCBCBC]">
                {prize.reward}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
