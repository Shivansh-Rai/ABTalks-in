"use client";

import { useState, useRef, useEffect } from "react";

const TOPICS = [
  {
    title: "ChatGPT vs Claude vs Gemini",
    desc: "Deep comparison of today's leading LLMs, their strengths, limitations, and best use cases.",
    icon: "🤖",
    accent: "#ff7a1a",
  },
  {
    title: "Which AI Model Should You Use?",
    desc: "Learn a practical decision framework to pick the best AI tool for coding, writing, or analysis.",
    icon: "💡",
    accent: "#ffb020",
  },
  {
    title: "Prompt Engineering",
    desc: "Master advanced frameworks (CoT, few-shot) to prompt like a pro and get 10x better outputs.",
    icon: "✍️",
    accent: "#ff4d94",
  },
  {
    title: "AI Tools for Students",
    desc: "Supercharge your learning, summarize research papers, and automate notes in seconds.",
    icon: "🎓",
    accent: "#a855f7",
  },
  {
    title: "AI Tools for Professionals",
    desc: "Multiply your office productivity with AI email templates, slides, and automated summaries.",
    icon: "💼",
    accent: "#6366f1",
  },
  {
    title: "AI Workflow Automation",
    desc: "Connect AI tools using Zapier or Make to build simple autonomous agents and bots.",
    icon: "⚡",
    accent: "#ff9a3c",
  },
  {
    title: "Live Practical Use Cases",
    desc: "Watch live coding, content creation, and workflow builds done in real-time from scratch.",
    icon: "🛠️",
    accent: "#2dd4bf",
  },
  {
    title: "Q&A Session",
    desc: "Get your doubts resolved live and ask the instructors anything during the open forum.",
    icon: "💬",
    accent: "#f472b6",
  },
];

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

export default function TopicsSection() {
  const heading = useInView(0.3);
  const infoRow = useInView(0.2);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 md:pb-24">
      <style>{`
        @keyframes wk-fade-down {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wk-slide-left {
          from { opacity: 0; transform: translateX(-40px) translateY(12px); }
          to   { opacity: 1; transform: translateX(0) translateY(0); }
        }
        @keyframes wk-slide-right {
          from { opacity: 0; transform: translateX(40px) translateY(12px); }
          to   { opacity: 1; transform: translateX(0) translateY(0); }
        }
        @keyframes wk-slide-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wk-anim-down  { animation: wk-fade-down 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .wk-anim-left  { animation: wk-slide-left 0.58s cubic-bezier(0.22,1,0.36,1) both; }
        .wk-anim-right { animation: wk-slide-right 0.58s cubic-bezier(0.22,1,0.36,1) both; }
        .wk-anim-up    { animation: wk-slide-up 0.5s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      {/* Heading */}
      <div
        ref={heading.ref}
        className={`mb-12 select-none text-center ${heading.visible ? "wk-anim-down" : "opacity-0"}`}
      >
        <span
          className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest"
          style={{
            background: "rgba(255,122,26,0.1)",
            color: "#ff9a3c",
            border: "1px solid rgba(255,122,26,0.2)",
          }}
        >
          ⚡ Bootcamp Curriculum
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-[38px]">
          What You&apos;ll Learn
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/45 md:text-[15px]">
          Practical AI skills through live, hands-on demonstrations and step-by-step builds.
        </p>
      </div>

      {/* Cards */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOPICS.map((topic, i) => (
          <AnimatedCard key={topic.title} topic={topic} index={i} />
        ))}
      </div>

      {/* Info row */}
      <div ref={infoRow.ref} className="grid grid-cols-3 gap-3">
        {(
          [
            { icon: "⏱️", label: "Duration", value: "1 Hour", subtext: "Live Interactive", accent: "#2dd4bf" },
            { icon: "📍", label: "Platform", value: "Google Meet", subtext: "Secure link sent", accent: "#6366f1" },
            { icon: "💰", label: "Price", value: "FREE", subtext: "100% Sponsored", accent: "#ff7a1a", highlight: true },
          ] as const
        ).map((data, i) => (
          <div
            key={data.label}
            className={infoRow.visible ? "wk-anim-up" : "opacity-0"}
            style={{ animationDelay: infoRow.visible ? `${i * 90}ms` : undefined }}
          >
            <InfoCard {...data} />
          </div>
        ))}
      </div>
    </section>
  );
}

function AnimatedCard({ topic, index }: { topic: (typeof TOPICS)[0]; index: number }) {
  const { ref, visible } = useInView(0.08);
  const isRight = index % 2 === 1;

  return (
    <div
      ref={ref}
      className={visible ? (isRight ? "wk-anim-right" : "wk-anim-left") : "opacity-0"}
      style={{ animationDelay: visible ? `${isRight ? 90 : 0}ms` : undefined }}
    >
      <TiltCard topic={topic} num={index + 1} />
    </div>
  );
}

function TiltCard({ topic, num }: { topic: (typeof TOPICS)[0]; num: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setRotateX((0.5 - y / r.height) * 10);
    setRotateY((x / r.width - 0.5) * 10);
    setGlowPos({ x: (x / r.width) * 100, y: (y / r.height) * 100 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setRotateX(0);
        setRotateY(0);
      }}
      className="relative cursor-pointer select-none overflow-hidden rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? topic.accent + "55" : "rgba(255,255,255,0.08)"}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transform: hovered
          ? `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px) scale(1.015)`
          : "perspective(900px) rotateX(0deg) rotateY(0deg)",
        boxShadow: hovered
          ? `0 20px 44px -12px ${topic.accent}44, inset 0 1px 0 rgba(255,255,255,0.06)`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        transition: "box-shadow 0.22s ease, border-color 0.22s ease, transform 0.15s ease",
        zIndex: hovered ? 10 : 1,
      }}
    >
      {/* top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${topic.accent}, transparent)`,
          opacity: hovered ? 1 : 0.3,
          transition: "opacity 0.22s ease",
        }}
      />

      {/* mouse-follow glow */}
      {hovered && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 220,
            height: 220,
            background: `radial-gradient(circle, ${topic.accent}22 0%, transparent 70%)`,
            left: `calc(${glowPos.x}% - 110px)`,
            top: `calc(${glowPos.y}% - 110px)`,
            transition: "left 0.1s linear, top 0.1s linear",
          }}
        />
      )}

      <div className="relative z-10 p-5">
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px]"
            style={{
              background: `${topic.accent}18`,
              border: `1px solid ${topic.accent}30`,
            }}
          >
            {topic.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span
              className="text-[9px] font-extrabold uppercase tracking-widest"
              style={{ color: topic.accent }}
            >
              {String(num).padStart(2, "0")}
            </span>
            <h4 className="mt-1 text-[15px] font-bold leading-snug tracking-tight text-white">
              {topic.title}
            </h4>
            <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-white/45">
              {topic.desc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface InfoCardProps {
  icon: string;
  label: string;
  value: string;
  subtext: string;
  accent: string;
  highlight?: boolean;
}

function InfoCard({ icon, label, value, subtext, accent, highlight }: InfoCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex select-none flex-col items-center overflow-hidden rounded-2xl p-3 text-center sm:p-4"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? accent + "55" : "rgba(255,255,255,0.08)"}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: hovered
          ? `0 14px 30px -8px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.05)`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        transform: hovered ? "translateY(-5px) scale(1.03)" : undefined,
        transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease",
        zIndex: hovered ? 5 : 1,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />
      <span
        className="mb-1.5 block text-xl sm:text-2xl"
        style={{
          transform: hovered ? "translateY(-3px) scale(1.15)" : "translateY(0) scale(1)",
          transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {icon}
      </span>
      <span className="mb-1.5 text-[8px] font-extrabold uppercase tracking-widest text-white/40 sm:text-[9px]">
        {label}
      </span>
      <span
        className="text-sm font-extrabold leading-none sm:text-[17px]"
        style={{ color: highlight ? accent : "#ffffff" }}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[8.5px] font-medium tracking-wide text-white/35 sm:text-[10px]">
        {subtext}
      </span>
    </div>
  );
}
