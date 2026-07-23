import Image from "next/image";
import Link from "next/link";
import { Countdown } from "@/components/hackathon/countdown";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function Hero() {
  return (
    <section className="relative bg-black">
      <div className="relative mx-auto w-full max-w-[1600px] md:aspect-[1024/568]">
        {/* Hero art — desktop only (background) */}
        <Image
          src="/hackathon/hero-bg.svg"
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="hidden object-contain object-center md:block"
        />
        <div
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.7) 100%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto flex h-[80vh] w-[80vw] max-w-[80vw] flex-col md:absolute md:inset-0 md:mx-auto md:h-auto md:w-full md:max-w-none md:overflow-y-auto md:px-9 md:pt-8">
          {/* Top cluster: title → subheading → date → countdown */}
          <div className="flex shrink-0 flex-col items-center pt-3 md:pt-0">
            <h1
              className="w-full bg-gradient-to-r from-white from-[39%] to-[#A2A2A2] bg-clip-text text-center text-[clamp(1.95rem,4.6vw,4.32rem)] font-normal leading-[1.15] text-transparent"
              style={{ fontFamily: "var(--font-hackathon-display), sans-serif" }}
            >
              {HACKATHON.name}
            </h1>

            <p
              className="mt-3 w-full text-center text-[clamp(0.8rem,1.8vw,1.25rem)] leading-snug text-[#E9E9E9] md:mt-3 md:leading-8"
              style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
            >
              <span className="font-bold text-[#7364E6]">48</span>
              {" hours   ·  No boilerplate   ·  "}
              <span className="font-bold text-[#6B78F0]">Just</span>
              {" you, your ideas, "}
              <span className="font-bold text-[#6B78F0]">and</span>{" "}
              <span className="font-bold text-[#3345EA]">AI</span>.
            </p>

            <p
              className="mt-6 w-full text-center text-[clamp(0.8rem,1.8vw,1.25rem)] font-bold leading-snug text-[#D6DAFB] md:mt-2 md:leading-8"
              style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
            >
              {HACKATHON.kickoffLabel}
            </p>

            <div className="mt-8 flex w-full justify-center md:mt-6">
              <Countdown targetIso={HACKATHON.kickoffUtc} />
            </div>
          </div>

          {/* Mobile: same hero SVG between upper content and Register row — original file, no compression */}
          <div className="flex min-h-0 flex-1 items-center justify-center pt-2 pb-0 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- serve original SVG bytes; no optimizer */}
            <img
              src="/hackathon/hero-bg.svg"
              alt=""
              className="h-auto max-h-full w-full object-contain"
              decoding="async"
            />
          </div>

          {/* CTA — mobile near bottom of 80vh; desktop normal flow */}
          <div className="mt-6 flex w-full shrink-0 flex-col items-center pb-2 md:mt-6 md:pb-0">
            <div className="flex w-full flex-row items-center justify-center gap-2 sm:gap-3 md:w-auto">
              <Link
                href="/hackathon/register"
                className="inline-flex h-8 flex-1 items-center justify-center rounded-[8px] px-2 text-center text-[11px] font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90 sm:h-[47px] sm:flex-none sm:rounded-[10px] sm:px-6 sm:text-[16px]"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(115, 100, 230, 1) 0%, rgba(64, 56, 128, 1) 100%)",
                }}
              >
                Register now →
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-8 flex-1 items-center justify-center rounded-[8px] border border-[#2C1BA9] bg-[#100A3D] px-2 text-center text-[11px] font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90 sm:h-[47px] sm:flex-none sm:rounded-[10px] sm:px-6 sm:text-[16px]"
              >
                How it works
              </Link>
            </div>

            <p className="mt-2 w-full text-center text-[12px] leading-6 text-[#BCBCBC] sm:mt-3 sm:text-[15px] sm:leading-8">
              {HACKATHON.registrationClosesLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
