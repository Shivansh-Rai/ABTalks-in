import { BrainCircuit, Plug, Sparkles } from "lucide-react";
import Link from "next/link";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

const ICONS = [BrainCircuit, Plug, Sparkles] as const;

export function SponsorSection() {
  const { sponsor } = HACKATHON;

  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#968BEC]">
        {sponsor.kicker} · {sponsor.name}
      </p>
      <h2
        className="mt-3 bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
      >
        {sponsor.heading}
      </h2>
      <p className="mt-3 max-w-3xl text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#BCBCBC]">
        {sponsor.blurb}
      </p>

      <ul className="mt-12 grid gap-6 sm:grid-cols-3 sm:gap-8">
        {sponsor.capabilities.map((item, index) => {
          const Icon = ICONS[index] ?? BrainCircuit;
          return (
            <li
              key={item.title}
              className="rounded-[20px] border border-[#403880] bg-[#030712] p-6 transition-colors hover:border-[#7364E6]"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#403880]/40">
                <Icon className="size-6 text-[#968BEC]" aria-hidden />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#BCBCBC]">
                {item.body}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <Link
          href={sponsor.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#968BEC] underline underline-offset-4 transition-colors hover:text-white"
        >
          {sponsor.name.toLowerCase()}.com
        </Link>
        <Link
          href={sponsor.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#968BEC] underline underline-offset-4 transition-colors hover:text-white"
        >
          Read the docs before kickoff
        </Link>
      </div>
    </section>
  );
}
