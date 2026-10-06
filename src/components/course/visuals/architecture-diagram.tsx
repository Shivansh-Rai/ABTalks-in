"use client";

import { useId, useState } from "react";
import type { ArchitectureVisual, DiagramNode } from "@/features/courses/types";
import { Inline } from "../inline";
import { useStepPlayer } from "./use-player";
import { StepControls } from "./step-controls";

const DEFAULT_W = 140;
const DEFAULT_H = 48;

type Box = { x: number; y: number; w: number; h: number; cx: number; cy: number };

function box(n: DiagramNode): Box {
  const w = n.w ?? DEFAULT_W;
  const h = n.h ?? DEFAULT_H;
  return { x: n.x, y: n.y, w, h, cx: n.x + w / 2, cy: n.y + h / 2 };
}

/** Point where the ray from the box centre towards (tx, ty) leaves the box. */
function exitPoint(b: Box, tx: number, ty: number): [number, number] {
  const dx = tx - b.cx;
  const dy = ty - b.cy;
  if (dx === 0 && dy === 0) return [b.cx, b.cy];
  const t = Math.min(
    dx === 0 ? Infinity : b.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : b.h / 2 / Math.abs(dy),
  );
  return [b.cx + dx * t, b.cy + dy * t];
}

function edgePath(a: Box, b: Box, elbow?: "hv" | "vh"): { d: string; mid: [number, number] } {
  if (elbow === "hv") {
    const sx = b.cx > a.cx ? a.x + a.w : a.x;
    const ey = b.cy > a.cy ? b.y : b.y + b.h;
    return { d: `M${sx} ${a.cy}H${b.cx}V${ey}`, mid: [(sx + b.cx) / 2, a.cy] };
  }
  if (elbow === "vh") {
    const sy = b.cy > a.cy ? a.y + a.h : a.y;
    const ex = b.cx > a.cx ? b.x : b.x + b.w;
    return { d: `M${a.cx} ${sy}V${b.cy}H${ex}`, mid: [a.cx, (sy + b.cy) / 2] };
  }
  const [x1, y1] = exitPoint(a, b.cx, b.cy);
  const [x2, y2] = exitPoint(b, a.cx, a.cy);
  return { d: `M${x1} ${y1}L${x2} ${y2}`, mid: [(x1 + x2) / 2, (y1 + y2) / 2] };
}

/**
 * Inspectable architecture / graph diagram. Click (or Enter on) a node to read
 * what it does; pick a scenario to trace a request, failure or handoff through
 * the system step by step. Used for architectures, pipelines, multi-agent
 * topologies and failure propagation.
 */
export function ArchitectureDiagram({ config }: { config: ArchitectureVisual }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { nodes, edges, scenarios = [], width, height } = config;
  const [selected, setSelected] = useState<string | null>(null);
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const scenario = scenarios[scenarioIdx];
  const p = useStepPlayer(scenario?.steps.length ?? 0, { interval: 2200 });
  const step = scenario && p.index >= 0 ? scenario.steps[p.index] : null;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const hotNodes = new Set(step?.nodes ?? []);
  const hotEdges = new Set((step?.edges ?? []).map(([a, b]) => `${a}>${b}`));
  const tracing = Boolean(step);
  const sel = selected ? byId.get(selected) : null;
  const inspectable = nodes.filter((n) => n.detail && !n.group);

  function pickScenario(i: number) {
    setScenarioIdx(i);
    p.reset();
  }

  return (
    <div>
      {scenarios.length > 1 ? (
        <div className="crs-controls" style={{ marginTop: 0, marginBottom: 10 }} role="group" aria-label="Scenarios">
          {scenarios.map((s, i) => (
            <button key={s.name} type="button" className="crs-chip" aria-pressed={i === scenarioIdx} onClick={() => pickScenario(i)}>
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <svg
          className="crs-svg"
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: Math.min(width, 560) }}
          role="group"
          aria-label="Interactive diagram"
        >
          <defs>
            <marker id={`ah-${uid}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="arrowhead" />
            </marker>
            <marker id={`ahh-${uid}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="arrowhead-hot" />
            </marker>
          </defs>

          {nodes.filter((n) => n.group).map((n) => {
            const b = box(n);
            return (
              <g key={n.id}>
                <rect className="n-group" x={b.x} y={b.y} width={b.w} height={b.h} rx={14} />
                <text className="n-group-label" x={b.x + 12} y={b.y + 18}>
                  {n.label}
                </text>
              </g>
            );
          })}

          {edges.map((e) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const { d, mid } = edgePath(box(a), box(b), e.elbow);
            const key = `${e.from}>${e.to}`;
            const hot = hotEdges.has(key);
            const labelW = e.label ? e.label.length * 6 + 10 : 0;
            return (
              <g key={key}>
                <path
                  className="e-line"
                  d={d}
                  data-hot={hot}
                  data-dim={tracing && !hot}
                  strokeDasharray={e.dashed ? "5 4" : undefined}
                  markerEnd={`url(#${hot ? "ahh" : "ah"}-${uid})`}
                />
                {e.label ? (
                  <g opacity={tracing && !hot ? 0.35 : 1}>
                    <rect className="e-label-bg" x={mid[0] - labelW / 2} y={mid[1] - 9} width={labelW} height={16} rx={4} />
                    <text className="e-label" x={mid[0]} y={mid[1] + 3} textAnchor="middle">
                      {e.label}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {nodes.filter((n) => !n.group).map((n) => {
            const b = box(n);
            const hot = hotNodes.has(n.id);
            const activate = () => setSelected((s) => (s === n.id ? null : n.id));
            return (
              <g
                key={n.id}
                className="node"
                role="button"
                tabIndex={0}
                aria-label={`${n.label}${n.sub ? `, ${n.sub}` : ""}`}
                aria-pressed={selected === n.id}
                data-hot={hot}
                data-hot-tone={step?.tone}
                data-sel={selected === n.id}
                data-dim={tracing && !hot}
                onClick={activate}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    activate();
                  }
                }}
              >
                <rect className="n-box" data-tone={n.tone} x={b.x} y={b.y} width={b.w} height={b.h} rx={10} />
                <text className="n-label" x={b.cx} y={n.sub ? b.cy - 2 : b.cy + 4} textAnchor="middle">
                  {n.label}
                </text>
                {n.sub ? (
                  <text className="n-sub" x={b.cx} y={b.cy + 13} textAnchor="middle">
                    {n.sub}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="crs-scroll-hint" aria-hidden="true">← swipe to see the whole diagram →</p>

      {scenario ? (
        <>
          <div className="crs-live" aria-live="polite">
            {step ? (
              <Inline text={step.text} />
            ) : (
              <span style={{ color: "var(--c-mu)" }}>
                Scenario: <b>{scenario.name}</b>. Press Start to trace it through the diagram.
              </span>
            )}
          </div>
          <StepControls
            index={p.index}
            count={scenario.steps.length}
            playing={p.playing}
            canNext={p.index < scenario.steps.length - 1}
            reduced={p.reduced}
            onBack={p.back}
            onNext={p.next}
            onToggle={p.toggle}
            onReset={p.reset}
          />
        </>
      ) : null}

      {inspectable.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: "0.78rem", color: "var(--c-mu)", marginBottom: 6 }}>Inspect a component</div>
          <div className="crs-controls" style={{ marginTop: 0 }} role="group" aria-label="Components">
            {inspectable.map((n) => (
              <button
                key={n.id}
                type="button"
                className="crs-chip"
                aria-pressed={selected === n.id}
                onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
              >
                {n.label}
              </button>
            ))}
          </div>
          <div className="crs-live" aria-live="polite">
            {sel?.detail ? (
              <>
                <b>{sel.label}.</b> <Inline text={sel.detail} />
              </>
            ) : (
              <span style={{ color: "var(--c-mu)" }}>Select a component in the diagram or above to see its role.</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
