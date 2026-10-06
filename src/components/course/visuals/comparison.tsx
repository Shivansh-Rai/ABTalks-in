"use client";

import { useState } from "react";
import type { CompareVisual } from "@/features/courses/types";
import { Inline } from "../inline";

/**
 * Side-by-side comparison of approaches. When `situations` are given the
 * learner picks one and the better-suited option is highlighted with a reason.
 */
export function Comparison({ config }: { config: CompareVisual }) {
  const { options, dimensions, situations = [] } = config;
  const [picked, setPicked] = useState<number | null>(null);
  const sit = picked === null ? null : situations[picked];

  return (
    <div>
      {situations.length > 0 ? (
        <>
          <div style={{ fontSize: "0.78rem", color: "var(--c-mu)", marginBottom: 6 }}>Pick a situation</div>
          <div className="crs-controls" style={{ marginTop: 0, marginBottom: 12 }} role="group" aria-label="Situations">
            {situations.map((s, i) => (
              <button key={s.label} type="button" className="crs-chip" aria-pressed={picked === i} onClick={() => setPicked(picked === i ? null : i)}>
                {s.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <div className="crs-cmp" style={{ ["--cols" as string]: String(options.length) }}>
        {options.map((o) => (
          <div key={o.id} className="crs-cmp-col" data-best={sit?.best === o.id}>
            <h4>
              {o.label}
              {sit?.best === o.id ? <span style={{ fontSize: "0.75rem", marginLeft: 6 }}>✓ better fit</span> : null}
            </h4>
            <div style={{ fontSize: "0.88rem" }}>
              <Inline text={o.summary} />
            </div>
            <dl>
              {dimensions.map((d) => (
                <div key={d.label}>
                  <dt>{d.label}</dt>
                  <dd>
                    <Inline text={d.values[o.id] ?? "-"} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {situations.length > 0 ? (
        <div className="crs-live" aria-live="polite">
          {sit ? (
            <>
              <b>{options.find((o) => o.id === sit.best)?.label}.</b> <Inline text={sit.why} />
            </>
          ) : (
            <span style={{ color: "var(--c-mu)" }}>Choose a situation to see which approach fits and why.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
