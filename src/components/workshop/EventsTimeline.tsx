"use client";

import { useState } from "react";
import Link from "next/link";
import ComingSoonCard from "@/components/workshop/ComingSoonCard";
import {
  EVENTS,
  dayNum,
  fullDate,
  monthAbbr,
  weekday,
} from "@/components/workshop/events-data";

export default function EventsTimeline() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-20 sm:pt-12">
      <style>{`
        @keyframes ev-row-in {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ev-row { animation: ev-row-in 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .ev-card { transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease; }
      `}</style>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Events
        </h1>
        <div
          className="inline-flex rounded-full p-1"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize transition-all"
              style={
                tab === t
                  ? {
                      background: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                    }
                  : { color: "rgba(255,255,255,0.45)" }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "past" ? (
        <div
          className="rounded-3xl px-6 py-20 text-center"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span className="mb-3 block text-4xl">🗂️</span>
          <p className="text-[15px] font-semibold text-white/70">
            No past events yet
          </p>
          <p className="mt-1 text-[13px] text-white/40">
            Our journey is just getting started — check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {EVENTS.map((ev, i) => (
            <div
              key={ev.id}
              className="ev-row flex gap-4 sm:gap-6"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {/* date column */}
              <div className="w-14 shrink-0 pt-1 text-right sm:w-16">
                <div className="text-lg font-extrabold leading-none text-white sm:text-xl">
                  {dayNum(ev.date)}
                </div>
                <div className="mt-1 text-[11px] font-medium text-white/40">
                  {monthAbbr(ev.date)}
                </div>
                <div className="mt-0.5 hidden text-[11px] text-white/30 sm:block">
                  {weekday(ev.date)}
                </div>
              </div>

              {/* timeline rail */}
              <div className="relative flex w-3 shrink-0 justify-center">
                <span
                  className="absolute top-2 h-2.5 w-2.5 rounded-full"
                  style={{
                    background: ev.accent,
                    boxShadow: `0 0 10px 1px ${ev.accent}`,
                  }}
                />
                <span
                  className="absolute top-6 bottom-[-24px] w-px"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(255,255,255,0.14), rgba(255,255,255,0.02))",
                  }}
                />
              </div>

              {/* card (registerable events link to the form) */}
              {(() => {
                const cardClass = `ev-card group flex flex-1 gap-4 overflow-hidden rounded-2xl p-4 sm:p-5${
                  ev.register ? " cursor-pointer" : ""
                }`;
                const cardStyle: React.CSSProperties = {
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${ev.register ? `${ev.accent}45` : "rgba(255,255,255,0.08)"}`,
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                };
                const onEnter = (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = `${ev.accent}77`;
                  e.currentTarget.style.boxShadow = `0 18px 40px -14px ${ev.accent}55`;
                };
                const onLeave = (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = ev.register
                    ? `${ev.accent}45`
                    : "rgba(255,255,255,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                };

                const body = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[12.5px] font-semibold"
                        style={{ color: ev.accent }}
                      >
                        {ev.time} · {fullDate(ev.date)}
                      </div>
                      <h3 className="mt-1.5 text-[17px] font-bold leading-snug tracking-tight text-white sm:text-lg">
                        {ev.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-relaxed text-white/45">
                        {ev.desc}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-white/50">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                            style={{ background: `${ev.accent}30` }}
                          >
                            ●
                          </span>
                          By {ev.host}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          📍 {ev.location}
                        </span>
                      </div>

                      {ev.register ? (
                        <span
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={{
                            background: `${ev.accent}20`,
                            color: ev.accent,
                            border: `1px solid ${ev.accent}55`,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: ev.accent, boxShadow: `0 0 6px 1px ${ev.accent}` }}
                          />
                          Register now
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </span>
                      ) : (
                        <span
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.6)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Coming soon
                        </span>
                      )}
                    </div>

                    {/* thumbnail */}
                    <div
                      className="hidden h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl sm:flex sm:h-28 sm:w-28"
                      style={{
                        background: `linear-gradient(135deg, ${ev.accent}33, ${ev.accent}12)`,
                        border: `1px solid ${ev.accent}30`,
                      }}
                    >
                      <span className="text-3xl">{ev.icon}</span>
                      <span
                        className="mt-1.5 text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: ev.accent }}
                      >
                        {ev.tag}
                      </span>
                    </div>
                  </>
                );

                return ev.register ? (
                  <Link
                    href="/ai-workshop#register"
                    className={cardClass}
                    style={cardStyle}
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    className={cardClass}
                    style={cardStyle}
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                  >
                    {body}
                  </div>
                );
              })()}
            </div>
          ))}

          {/* coming-soon teaser */}
          <div className="ev-row flex gap-4 sm:gap-6" style={{ animationDelay: `${EVENTS.length * 0.08}s` }}>
            <div className="w-14 shrink-0 sm:w-16" />
            <div className="relative flex w-3 shrink-0 justify-center">
              <span
                className="absolute top-3 h-2.5 w-2.5 rounded-full border"
                style={{ borderColor: "rgba(255,255,255,0.3)", background: "transparent" }}
              />
            </div>
            <div className="flex-1">
              <ComingSoonCard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
