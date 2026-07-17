"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { HOW_IT_WORKS_STEPS } from "@/data/roadmap";
import { Roadmap } from "@/components/program/roadmap/Roadmap";
import { cn } from "@/lib/utils";

type Cta = { label: string; href: string };

const requirements = [
  {
    text: "Laptop with at least ",
    highlight: "8 GB RAM",
    suffix: "",
  },
  {
    text: "",
    highlight: "~2–4 hours",
    suffix: " per day for 31 days",
  },
  {
    text: "A ",
    highlight: "GitHub",
    suffix: " account",
  },
  {
    text: "",
    highlight: "Everything else is free!",
    suffix: " (Ollama / Groq / Chroma — no paid API keys needed)",
  },
];

const primaryBtnClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7364E6] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#7364E6]/90 md:h-12 md:text-base";

const outlineBtnClass =
  "inline-flex h-11 items-center justify-center rounded-lg border border-[#7364E6]/70 bg-transparent px-6 text-sm font-semibold text-white transition-colors hover:border-[#968BEC] hover:bg-white/5 md:h-12 md:text-base";

function RequirementsTree() {
  return (
    <div className="hidden md:block">
      {/* stem from title */}
      <div className="mx-auto h-10 w-[3px] bg-white" aria-hidden />

      <div className="relative mx-auto w-full max-w-6xl">
        <svg
          className="pointer-events-none absolute inset-x-0 top-0 h-[44px] w-full"
          viewBox="0 0 1200 44"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1="150"
            y1="0"
            x2="1050"
            y2="0"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[150, 450, 750, 1050].map((x) => (
            <line
              key={x}
              x1={x}
              y1="0"
              x2={x}
              y2="44"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div className="grid grid-cols-4 gap-3 pt-[44px]">
          {requirements.map((item, i) => (
            <div
              key={i}
              className="flex min-h-[88px] items-start justify-center px-1 text-center"
            >
              <p className="text-base font-semibold leading-snug text-white lg:text-[24px] lg:leading-[29px]">
                {item.text}
                <span className="text-[#4C9EEB]">{item.highlight}</span>
                {item.suffix}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RequirementsMobile() {
  return (
    <ul className="mx-auto mt-6 max-w-lg space-y-4 md:hidden">
      {requirements.map((item, i) => (
        <li
          key={i}
          className="text-center text-sm font-semibold leading-snug text-white"
        >
          {item.text}
          <span className="text-[#4C9EEB]">{item.highlight}</span>
          {item.suffix}
        </li>
      ))}
    </ul>
  );
}

export function ProgramLanding({ cta }: { cta: Cta }) {
  return (
    <main className="min-h-svh overflow-x-hidden bg-[#030712] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#030712] to-[#030712]" />
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 50% at 75% 40%, rgba(115,100,230,0.22), transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-5 pt-6 md:px-10 md:pt-8">
          <Link href="/" className="inline-block">
            <Image
              src="/program/abtalks-mark.png"
              alt="ABTalks"
              width={202}
              height={53}
              className="h-9 w-auto md:h-10"
              priority
            />
          </Link>
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-10 md:grid-cols-2 md:gap-6 md:px-10 md:pb-16 md:pt-12 lg:gap-10">
          <div className="max-w-xl text-left">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#8365E3]/40 bg-[#110528]/80 px-3 py-1.5 text-xs font-medium text-[#968BEC] md:text-sm">
              <Users className="size-3.5 shrink-0" aria-hidden />
              For students &amp; recent grads · ~2–4 hrs/day
            </span>

            {/* <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              AI Cohort
            </h1> */}
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              AI{" "}
              <span className="bg-gradient-to-r from-slate-300 via-blue-400 to-indigo-500 bg-clip-text text-transparent">
                Cohort
              </span>
            </h1>

            <p className="mt-4 text-base leading-relaxed text-[#E9E9E9] md:text-lg">
              Build and deploy a production-grade enterprise AI chatbot in 31
              days RAG, agents, MCP, guardrails, Docker, Kubernetes and get
              in front of recruiters.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={cta.href} className={primaryBtnClass}>
                {cta.label}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              {/* <Link href="/talent/register" className={outlineBtnClass}>
                I&apos;m a recruiter
              </Link> */}
            </div>
          </div>

          
        </div>
      </section>

      {/* Requirements */}
      <section className="relative px-4 pb-6 md:px-8 md:pb-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-[#968BEC] md:text-[32px]">
            Requirements
          </h2>
          <div className="mt-1">
            <RequirementsTree />
            <RequirementsMobile />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="flex flex-wrap items-end justify-center gap-x-2 gap-y-1 px-4 pb-8 md:gap-x-4 md:pb-12">
        <span
          className="font-semibold leading-none"
          style={{ fontSize: "clamp(4rem, 12vw, 8rem)", color: "#F0AA5B" }}
        >
          8
        </span>
        <span className="mb-2 text-2xl font-medium md:text-5xl">Phases</span>
        <span
          className="ml-8 font-semibold leading-none md:ml-12"
          style={{ fontSize: "clamp(4rem, 12vw, 8rem)", color: "#6AE276" }}
        >
          31
        </span>
        <span className="mb-2 text-2xl font-medium md:text-5xl">Days</span>
      </section>

      {/* Course roadmap */}
      <Roadmap />

      {/* How it works */}
      <section className="px-4 py-12 md:px-8 md:py-16">
        <h2 className="mb-10 text-center text-2xl font-bold text-[#968BEC] underline decoration-[#968BEC]/50 underline-offset-8 md:text-[32px]">
          How it works
        </h2>
        <div className="mx-auto max-w-6xl">
          <div className="hidden md:flex md:items-start md:justify-between">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div
                key={step.step}
                className="relative flex flex-1 flex-col items-center"
              >
                {i > 0 && (
                  <div
                    className="absolute right-1/2 top-10 h-0.5 w-full -translate-x-1/2 border-t-2 border-dashed border-[#8147E7]/80"
                    style={{ width: "calc(100% + 2rem)", left: "-50%" }}
                    aria-hidden
                  />
                )}
                <div
                  className="relative z-10 flex size-16 items-center justify-center rounded-full border-[3px] text-xl font-semibold shadow-[0_4px_10px_rgba(0,0,0,0.25)]"
                  style={{
                    borderColor: "#1E1B37",
                    background:
                      "radial-gradient(circle, rgba(62,34,111,1) 0%, rgba(0,0,0,1) 100%)",
                  }}
                >
                  {step.step}
                </div>
                <p className="mt-4 text-center text-xl font-semibold">
                  {step.title}
                </p>
                <p className="mt-2 max-w-[200px] text-center text-sm leading-snug text-[#E9E9E9]">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
          <ol className="space-y-6 md:hidden">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <li
                key={step.step}
                className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#1E1B37] bg-[radial-gradient(circle,rgba(62,34,111,1)_0%,rgba(0,0,0,1)_100%)] text-sm font-semibold">
                  {step.step}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm text-[#BCBCBC]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 md:px-8 md:pb-24">
        <div
          className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-[15px] px-6 py-8 md:flex-row md:items-center md:px-10 md:py-10"
          style={{
            background:
              "linear-gradient(0deg, rgba(31, 14, 65, 1) 0%, rgba(17, 5, 40, 1) 100%)",
          }}
        >
          <div>
            <h2 className="text-2xl font-semibold md:text-[40px] md:leading-tight">
              Ready to build?
            </h2>
            <p className="mt-2 max-w-md text-sm text-[#E9E9E9] md:text-base">
              Free for participants. One batch at a time — apply while
              enrollment is open.
            </p>
          </div>
          <Link href={cta.href} className={cn(primaryBtnClass, "h-[52px] px-8 md:text-xl")}>
            {cta.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}
