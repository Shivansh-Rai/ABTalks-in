"use client";

import { useId, useState } from "react";
import type { SequenceVisual } from "@/features/courses/types";
import { Inline } from "../inline";
import { useStepPlayer } from "./use-player";
import { StepControls } from "./step-controls";

const COL = 170;
const TOP = 58;
const ROW = 46;

/**
 * Sequence diagram with step-through messages. Multiple scenarios (e.g. happy
 * path vs tool failure) share the same actors so learners can compare them.
 */
export function SequenceDiagram({ config }: { config: SequenceVisual }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { actors, scenarios } = config;
  const [si, setSi] = useState(0);
  const scenario = scenarios[si];
  const msgs = scenario.messages;
  const p = useStepPlayer(msgs.length, { interval: 1800 });
  const width = actors.length * COL;
  const height = TOP + msgs.length * ROW + 24;
  const xOf = (id: string) => {
    const i = actors.findIndex((a) => a.id === id);
    return i * COL + COL / 2;
  };
  const cur = p.index >= 0 ? msgs[p.index] : null;

  return (
    <div>
      {scenarios.length > 1 ? (
        <div className="crs-controls" style={{ marginTop: 0, marginBottom: 10 }} role="group" aria-label="Scenarios">
          {scenarios.map((s, i) => (
            <button
              key={s.name}
              type="button"
              className="crs-chip"
              aria-pressed={i === si}
              onClick={() => {
                setSi(i);
                p.reset();
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ overflowX: "auto" }}>
        <svg className="crs-svg" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: Math.min(width, 540) }} role="img" aria-label={`Sequence: ${scenario.name}`}>
          <defs>
            <marker id={`sq-${uid}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="arrowhead" />
            </marker>
          </defs>
          {actors.map((a, i) => {
            const x = i * COL + COL / 2;
            return (
              <g key={a.id}>
                <line className="crs-seq-life" x1={x} y1={TOP - 12} x2={x} y2={height - 6} />
                <rect className="crs-seq-actor" x={x - 72} y={6} width={144} height={34} rx={9} />
                <text x={x} y={28} textAnchor="middle" style={{ fontSize: 13, fontWeight: 600 }}>
                  {a.label}
                </text>
              </g>
            );
          })}
          {msgs.map((m, i) => {
            const y = TOP + i * ROW + 20;
            const x1 = xOf(m.from);
            const x2 = xOf(m.to);
            const state = i === p.index ? "now" : i < p.index ? "past" : "future";
            const self = m.from === m.to || m.style === "self";
            const style = m.style ?? "call";
            return (
              <g key={i} className="crs-seq-msg" data-state={state} data-style={style} style={state === "future" ? { opacity: 0.12 } : undefined}>
                {self ? (
                  <path d={`M${x1} ${y - 8}h40v16h-38`} markerEnd={`url(#sq-${uid})`} />
                ) : (
                  <line x1={x1} y1={y} x2={x2 + (x2 > x1 ? -4 : 4)} y2={y} markerEnd={`url(#sq-${uid})`} />
                )}
                <text x={self ? x1 + 46 : (x1 + x2) / 2} y={self ? y + 4 : y - 7} textAnchor={self ? "start" : "middle"}>
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="crs-scroll-hint" aria-hidden="true">← swipe to see the whole diagram →</p>
      <div className="crs-live" aria-live="polite">
        {cur ? (
          <>
            <b>
              {actors.find((a) => a.id === cur.from)?.label} → {actors.find((a) => a.id === cur.to)?.label}:
            </b>{" "}
            {cur.label}
            {cur.note ? (
              <>
                {", "}
                <Inline text={cur.note} />
              </>
            ) : null}
          </>
        ) : (
          <span style={{ color: "var(--c-mu)" }}>Press Start to play the messages one at a time.</span>
        )}
      </div>
      <StepControls
        index={p.index}
        count={msgs.length}
        playing={p.playing}
        canNext={p.index < msgs.length - 1}
        reduced={p.reduced}
        onBack={p.back}
        onNext={p.next}
        onToggle={p.toggle}
        onReset={p.reset}
      />
    </div>
  );
}
