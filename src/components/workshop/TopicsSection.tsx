"use client";

import { useState, useRef, useEffect } from "react";

const TOPICS = [
  {
    title: "ChatGPT vs Claude vs Gemini",
    desc: "Deep comparison of today's leading LLMs, their strengths, limitations, and best use cases.",
    icon: "🤖",
    gradient: "from-orange-400 to-red-400",
    bg: "from-orange-50 to-red-50",
  },
  {
    title: "Which AI Model Should You Use?",
    desc: "Learn a practical decision framework to pick the best AI tool for coding, writing, or analysis.",
    icon: "💡",
    gradient: "from-yellow-400 to-orange-400",
    bg: "from-yellow-50 to-orange-50",
  },
  {
    title: "Prompt Engineering",
    desc: "Master advanced frameworks (CoT, few-shot) to prompt like a pro and get 10x better outputs.",
    icon: "✍️",
    gradient: "from-pink-400 to-rose-400",
    bg: "from-pink-50 to-rose-50",
  },
  {
    title: "AI Tools for Students",
    desc: "Supercharge your learning, summarize research papers, and automate notes in seconds.",
    icon: "🎓",
    gradient: "from-violet-400 to-purple-400",
    bg: "from-violet-50 to-purple-50",
  },
  {
    title: "AI Tools for Professionals",
    desc: "Multiply your office productivity with AI email templates, slides, and automated summaries.",
    icon: "💼",
    gradient: "from-blue-400 to-indigo-400",
    bg: "from-blue-50 to-indigo-50",
  },
  {
    title: "AI Workflow Automation",
    desc: "Connect AI tools using Zapier or Make to build simple autonomous agents and bots.",
    icon: "⚡",
    gradient: "from-amber-400 to-yellow-400",
    bg: "from-amber-50 to-yellow-50",
  },
  {
    title: "Live Practical Use Cases",
    desc: "Watch live coding, content creation, and workflow builds done in real-time from scratch.",
    icon: "🛠️",
    gradient: "from-teal-400 to-cyan-400",
    bg: "from-teal-50 to-cyan-50",
  },
  {
    title: "Q&A Session",
    desc: "Get your doubts resolved live and ask the instructors anything during the open forum.",
    icon: "💬",
    gradient: "from-fuchsia-400 to-pink-400",
    bg: "from-fuchsia-50 to-pink-50",
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
        if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold }
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
    <section className="w-full max-w-175 mx-auto px-4 py-14 md:py-20">
      <style>{`
        /* --- Scroll-in animations --- */
        @keyframes fade-down {
          from { opacity: 0; transform: translateY(-20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes slide-left {
          from { opacity: 0; transform: translateX(-44px) translateY(12px); }
          to   { opacity: 1; transform: translateX(0)     translateY(0);    }
        }
        @keyframes slide-right {
          from { opacity: 0; transform: translateX(44px)  translateY(12px); }
          to   { opacity: 1; transform: translateX(0)     translateY(0);    }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        .anim-fade-down  { animation: fade-down  0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .anim-slide-left { animation: slide-left 0.58s cubic-bezier(0.22,1,0.36,1) both; }
        .anim-slide-right{ animation: slide-right 0.58s cubic-bezier(0.22,1,0.36,1) both; }
        .anim-slide-up   { animation: slide-up   0.50s cubic-bezier(0.22,1,0.36,1) both; }

        /* --- Info card idle pulses --- */
        @keyframes pulse-gray {
          0%, 100% { box-shadow: 0 0 0 1px rgba(20,184,166,0.30), 0 0 12px 3px rgba(20,184,166,0.14), 0 2px 8px rgba(0,0,0,0.04); }
          50%       { box-shadow: 0 0 0 1px rgba(20,184,166,0.52), 0 0 20px 6px rgba(20,184,166,0.24), 0 2px 8px rgba(0,0,0,0.04); }
        }
        @keyframes pulse-indigo {
          0%, 100% { box-shadow: 0 0 0 1px rgba(99,102,241,0.20), 0 0 10px 2px rgba(99,102,241,0.10), 0 2px 8px rgba(0,0,0,0.04); }
          50%       { box-shadow: 0 0 0 1px rgba(99,102,241,0.35), 0 0 16px 4px rgba(99,102,241,0.16), 0 2px 8px rgba(0,0,0,0.04); }
        }
        @keyframes pulse-orange {
          0%, 100% { box-shadow: 0 0 0 1px rgba(255,106,0,0.22), 0 0 10px 2px rgba(255,106,0,0.12), 0 2px 8px rgba(0,0,0,0.04); }
          50%       { box-shadow: 0 0 0 1px rgba(255,106,0,0.38), 0 0 18px 5px rgba(255,106,0,0.18), 0 2px 8px rgba(0,0,0,0.04); }
        }
        .pulse-gray   { animation: pulse-gray   2.4s ease-in-out infinite; }
        .pulse-indigo { animation: pulse-indigo  2.4s ease-in-out infinite; }
        .pulse-orange { animation: pulse-orange  2.4s ease-in-out infinite; }

        /* --- Hover interactions --- */
        @keyframes shine-sweep {
          0%   { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(260%)  skewX(-15deg); }
        }
        .topic-card:hover .card-shine { animation: shine-sweep 0.55s ease forwards; }
        .topic-card {
          transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease;
        }
      `}</style>

      {/* Heading — fades down */}
      <div
        ref={heading.ref}
        className={`text-center mb-12 select-none ${heading.visible ? "anim-fade-down" : "opacity-0"}`}
      >
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold text-[#e16213] bg-linear-to-r from-[#ffdcca]/60 to-[#fce7f3]/60 rounded-full mb-4 uppercase tracking-wider border border-orange-100">
          ⚡ Bootcamp Curriculum
        </span>
        <h2 className="text-3xl md:text-[34px] font-extrabold text-gray-900 tracking-tight mb-3">
          What You&apos;ll Learn
        </h2>
        <p className="text-gray-500 text-sm md:text-[15px] max-w-115 mx-auto leading-relaxed">
          Practical AI skills through live, hands-on demonstrations and step-by-step builds.
        </p>
      </div>

      {/* Cards — left col slides from left, right col from right */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {TOPICS.map((topic, i) => (
          <AnimatedCard key={topic.title} topic={topic} index={i} />
        ))}
      </div>

      {/* Info row — slides up with stagger */}
      <div
        ref={infoRow.ref}
        className="grid grid-cols-3 gap-3"
      >
        {(["⏱️", "📍", "💰"] as const).map((icon, i) => {
          const data = [
            { icon: "⏱️", label: "Duration", value: "1 Hour",  subtext: "Live Interactive", highlight: false },
            { icon: "📍", label: "Platform", value: "Zoom",    subtext: "Secure link sent", highlight: false },
            { icon: "💰", label: "Price",    value: "FREE",    subtext: "100% Sponsored",   highlight: true  },
          ][i];
          return (
            <div
              key={icon}
              className={infoRow.visible ? "anim-slide-up" : "opacity-0"}
              style={{ animationDelay: infoRow.visible ? `${i * 90}ms` : undefined }}
            >
              <InfoCard {...data} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AnimatedCard({ topic, index }: { topic: typeof TOPICS[0]; index: number }) {
  const { ref, visible } = useInView(0.08);
  const isRight = index % 2 === 1;

  return (
    <div
      ref={ref}
      className={visible ? (isRight ? "anim-slide-right" : "anim-slide-left") : "opacity-0"}
      style={{ animationDelay: visible ? `${isRight ? 90 : 0}ms` : undefined }}
    >
      <TiltCard topic={topic} num={index + 1} />
    </div>
  );
}

function TiltCard({ topic, num }: { topic: typeof TOPICS[0]; num: number }) {
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
    setRotateX((0.5 - y / r.height) * 12);
    setRotateY((x / r.width - 0.5) * 12);
    setGlowPos({ x: (x / r.width) * 100, y: (y / r.height) * 100 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setRotateX(0); setRotateY(0); }}
      className="topic-card relative bg-white rounded-2xl overflow-hidden cursor-pointer select-none"
      style={{
        transform: hovered
          ? `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px) scale(1.018)`
          : "perspective(900px) rotateX(0deg) rotateY(0deg)",
        boxShadow: hovered
          ? "0 16px 40px -8px rgba(225,98,19,0.18), 0 4px 12px -2px rgba(232,67,147,0.12), 0 0 0 1px rgba(225,98,19,0.10)"
          : "0 2px 8px -2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)",
        zIndex: hovered ? 10 : 1,
      }}
    >
      {/* Top gradient accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.75 bg-linear-to-r ${topic.gradient}`} />

      {/* Mouse-follow glow */}
      {hovered && (
        <div
          className="absolute pointer-events-none rounded-full opacity-[0.10]"
          style={{
            width: 200,
            height: 200,
            background: "radial-gradient(circle, #ff6a00 0%, transparent 70%)",
            left: `calc(${glowPos.x}% - 100px)`,
            top: `calc(${glowPos.y}% - 100px)`,
            transition: "left 0.08s linear, top 0.08s linear",
            filter: "blur(8px)",
          }}
        />
      )}

      {/* Shine sweep */}
      <div
        className="card-shine absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)",
          transform: "translateX(-100%) skewX(-15deg)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-5">
        <div className="flex items-start gap-4">
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl bg-linear-to-br ${topic.bg} shrink-0 text-[22px]`}>
            {topic.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span className={`text-[9px] font-extrabold bg-linear-to-r ${topic.gradient} bg-clip-text text-transparent uppercase tracking-widest`}>
              {String(num).padStart(2, "0")}
            </span>
            <h4 className="text-[14px] font-bold text-gray-900 leading-snug tracking-tight mt-1">
              {topic.title}
            </h4>
            <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed font-medium">
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
  highlight?: boolean;
}

function InfoCard({ icon, label, value, subtext, highlight }: InfoCardProps) {
  const [hovered, setHovered] = useState(false);

  const accent =
    highlight
      ? { ring: "rgba(255,106,0,0.40)", glow: "rgba(255,106,0,0.22)", bar: "from-orange-400 to-amber-400", pulse: "pulse-orange" }
      : label === "Platform"
      ? { ring: "rgba(99,102,241,0.35)", glow: "rgba(99,102,241,0.18)", bar: "from-indigo-400 to-blue-400", pulse: "pulse-indigo" }
      : { ring: "rgba(20,184,166,0.40)", glow: "rgba(20,184,166,0.20)", bar: "from-teal-400 to-cyan-400", pulse: "pulse-gray" };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex flex-col items-center p-3 sm:p-4 bg-white rounded-2xl text-center select-none overflow-hidden ${!hovered ? accent.pulse : ""}`}
      style={{
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: hovered
          ? `0 0 0 1.5px ${accent.ring}, 0 14px 32px -6px ${accent.glow}, 0 2px 8px rgba(0,0,0,0.06)`
          : undefined,
        transform: hovered ? "translateY(-6px) scale(1.05)" : undefined,
        transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease",
        zIndex: hovered ? 5 : 1,
      }}
    >
      {/* Colored top accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-0.75 bg-linear-to-r ${accent.bar}`}
        style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease" }}
      />

      {/* Icon — bounces up on hover */}
      <span
        className="text-xl sm:text-2xl mb-1.5 block"
        style={{
          transform: hovered ? "translateY(-4px) scale(1.18)" : "translateY(0) scale(1)",
          transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {icon}
      </span>

      <span className="text-[8px] sm:text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
        {label}
      </span>
      <span className={`text-sm sm:text-[17px] font-extrabold leading-none ${highlight ? "text-[#ff6a00]" : "text-gray-900"}`}>
        {value}
      </span>
      <span className="text-[8.5px] sm:text-[10px] text-gray-400 mt-1.5 font-medium tracking-wide">
        {subtext}
      </span>
    </div>
  );
}
