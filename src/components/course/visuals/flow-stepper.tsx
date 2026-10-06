"use client";

import type { FlowVisual } from "@/features/courses/types";
import { Inline } from "../inline";
import { useStepPlayer } from "./use-player";
import { StepControls } from "./step-controls";

/**
 * Ordered process: loops, pipelines, recovery ladders, state evolution.
 * Every step is clickable; optional per-step `state` renders a key/value panel
 * with the keys that changed since the previous step highlighted.
 */
export function FlowStepper({ config }: { config: FlowVisual }) {
  const { steps, loop, stateTitle } = config;
  const p = useStepPlayer(steps.length, { loop: Boolean(loop) });
  const current = p.index >= 0 ? steps[p.index] : null;
  const prevState = p.index > 0 ? steps[p.index - 1].state ?? {} : {};
  const hasState = steps.some((s) => s.state);

  return (
    <div>
      <div className="crs-flow" role="list">
        {steps.map((s, i) => (
          <div key={i} role="listitem" style={{ display: "contents" }}>
            {i > 0 ? (
              <span className="crs-flow-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
            <button
              type="button"
              className="crs-flow-node"
              data-state={i === p.index ? "on" : i < p.index ? "done" : "idle"}
              data-tone={s.tone}
              aria-current={i === p.index ? "step" : undefined}
              onClick={() => p.goTo(i)}
            >
              <span style={{ opacity: 0.7, fontSize: "0.75rem", marginRight: 4 }}>{i + 1}</span>
              {s.label}
            </button>
          </div>
        ))}
      </div>
      {loop ? (
        <div className="crs-flow-loop" aria-hidden="true">
          <span>↺</span> {loop.label}
        </div>
      ) : null}

      <div className="crs-live" aria-live="polite">
        {current ? (
          <>
            <b>{current.label}.</b> <Inline text={current.detail} />
          </>
        ) : (
          <span style={{ color: "var(--c-mu)" }}>Press Start, or click any step.</span>
        )}
      </div>

      {hasState && current?.state ? (
        <div>
          <div style={{ fontSize: "0.78rem", color: "var(--c-mu)", marginTop: 10 }}>
            {stateTitle ?? "State"}
          </div>
          <dl className="crs-kv" style={{ marginTop: 4 }}>
            {Object.entries(current.state).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd data-changed={p.index > 0 && prevState[k] !== v ? "true" : "false"}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <StepControls
        index={p.index}
        count={steps.length}
        playing={p.playing}
        canNext={Boolean(loop) || p.index < steps.length - 1}
        reduced={p.reduced}
        onBack={p.back}
        onNext={p.next}
        onToggle={p.toggle}
        onReset={p.reset}
      />
    </div>
  );
}
