import Link from "next/link";
import type { Domain } from "@prisma/client";
import { ArrowRight, Check } from "lucide-react";
import { isClaudeEnabled } from "@/lib/feature-flags";
import { JoinClaudeButton } from "@/components/dashboard-hub/join-claude-button";

/* Three suggested 60-day tracks as static cards: a dark cover (artwork +
   title) on top of a white details body. No hover animation. */

type Track = {
  domain: Domain;
  title: string;
  kicker: string;
  tagline: string;
  cover: string;
  /** Background behind the artwork (also fills the cover when art is small). */
  bg: string;
  path: string;
  skills: string[];
  outcomes: string[];
};

const TRACKS: Track[] = [
  {
    domain: "AI",
    title: "Artificial Intelligence",
    kicker: "Automation & performance",
    tagline: "Build with models, agents and data.",
    cover: "/dashboard/ai-track.jpg",
    bg: "#050A12",
    path: "/ai",
    skills: ["Python", "LLMs", "RAG", "Agents", "Evaluation"],
    outcomes: [
      "Build and ship LLM-powered features end to end",
      "Design retrieval and agent workflows",
      "Evaluate and improve model quality",
    ],
  },
  {
    domain: "SE",
    title: "Software Engineering",
    kicker: "Build & ship",
    tagline: "Ship real software, one task a day.",
    cover: "/dashboard/track-thumb.png",
    bg: "#0B1020",
    path: "/se",
    skills: ["TypeScript", "React", "APIs", "SQL", "Testing"],
    outcomes: [
      "Build full-stack features from scratch",
      "Write clean, tested, reviewable code",
      "Deploy and maintain production apps",
    ],
  },
  {
    domain: "DS",
    title: "Data Science",
    kicker: "Analyse & predict",
    tagline: "Turn raw data into real insight.",
    cover: "/dashboard/track-ds.svg",
    bg: "#1A1206",
    path: "/ds",
    skills: ["Python", "Pandas", "SQL", "Statistics", "ML"],
    outcomes: [
      "Clean, explore and visualise real datasets",
      "Build and validate predictive models",
      "Communicate findings with clear stories",
    ],
  },
  {
    domain: "CLAUDE",
    title: "Claude",
    kicker: "Build with AI",
    tagline: "Master Claude AI in 60 days.",
    cover: "/dashboard/track-claude.svg",
    bg: "#1C0F08",
    path: "/claude",
    skills: ["Prompting", "Tool use", "Claude API", "MCP", "Agents"],
    outcomes: [
      "Write prompts that work reliably",
      "Build apps and agents on the Claude API",
      "Ship a public build every day",
    ],
  },
];

export function TrackCards({ abandoned }: { abandoned: Domain[] }) {
  const removed = new Set(abandoned);
  // Three suggestions (Claude only when live).
  const tracks = TRACKS.filter((t) => t.domain !== "CLAUDE" || isClaudeEnabled()).slice(0, 3);
  return (
    <ul id="domains" className="grid scroll-mt-24 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {tracks.map((t, i) => (
        <li
          key={t.domain}
          className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_-26px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.04]"
        >
          {/* Cover */}
          <div
            className="relative flex min-h-[220px] flex-col justify-center overflow-hidden px-7 py-8 text-white"
            style={{ background: t.bg }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static cover art */}
            <img src={t.cover} alt="" className="absolute inset-0 size-full object-cover object-right brightness-[0.6]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.55)_45%,rgba(0,0,0,0)_80%)]" aria-hidden="true" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                {String(i + 1).padStart(2, "0")} / Career track
              </p>
              <h4 className="mt-1.5 max-w-[16ch] font-heading text-[32px] font-bold leading-[1.1]">{t.title}</h4>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1FB6C9]">{t.kicker}</p>
              <p className="mt-1.5 text-sm text-white/80">{t.tagline}</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col px-7 pb-6 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">What you learn:</p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {t.skills.map((k) => (
                <li key={k} className="rounded-md border border-[#E3E7E7] bg-[#F7F8F8] px-3 py-1.5 text-xs text-[#1F1F1F]">
                  {k}
                </li>
              ))}
            </ul>
            <ul className="mt-5 space-y-2.5">
              {t.outcomes.map((o) => (
                <li key={o} className="flex items-start gap-2.5 text-[13px] text-[#1F1F1F]">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#6B7280]" aria-hidden="true" />
                  {o}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex items-center justify-end gap-6 pt-6">
              <Link href={t.path} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[#03535F] hover:underline">
                More Details <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              {removed.has(t.domain) ? (
                <Link href={t.path} className={ENROLL}>View status</Link>
              ) : t.domain === "CLAUDE" ? (
                <JoinClaudeButton className={ENROLL} />
              ) : (
                <Link href={`/register?domain=${t.domain}`} className={ENROLL}>Enroll Now</Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const ENROLL =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[linear-gradient(180deg,#0E6B76_0%,#03535F_100%)] px-5 text-[13px] font-semibold text-white shadow-[inset_0_-4px_12px_rgba(0,0,0,0.25),0_8px_18px_-10px_rgba(3,83,95,0.8)] transition-colors hover:bg-[#076573] disabled:opacity-60";
