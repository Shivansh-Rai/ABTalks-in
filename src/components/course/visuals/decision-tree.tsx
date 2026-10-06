"use client";

import { useState } from "react";
import type { DecisionVisual } from "@/features/courses/types";
import { Inline } from "../inline";

/**
 * Walk a decision tree one question at a time. The trail of answers stays
 * visible so the learner sees *why* they landed on an outcome, and can step
 * back to explore other branches.
 */
export function DecisionTree({ config }: { config: DecisionVisual }) {
  const { start, nodes } = config;
  const [path, setPath] = useState<{ id: string; answer?: string }[]>([{ id: start }]);
  const here = path[path.length - 1];
  const node = nodes[here.id];

  function choose(label: string, next: string) {
    setPath((p) => [...p.slice(0, -1), { ...p[p.length - 1], answer: label }, { id: next }]);
  }

  return (
    <div>
      {path.length > 1 ? (
        <ol className="crs-trail" style={{ listStyle: "none", padding: 0, margin: "0 0 10px" }}>
          {path.slice(0, -1).map((s, i) => {
            const n = nodes[s.id];
            return (
              <li key={i}>
                {"question" in n ? n.question : ""} → <b style={{ color: "var(--c-fg)" }}>{s.answer}</b>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div aria-live="polite">
        {node && "question" in node ? (
          <>
            <p style={{ fontWeight: 600, margin: "0 0 8px" }}>
              <Inline text={node.question} />
            </p>
            <div className="crs-controls" style={{ marginTop: 0 }}>
              {node.options.map((o) => (
                <button key={o.label} type="button" className="crs-chip" onClick={() => choose(o.label, o.next)}>
                  {o.label}
                </button>
              ))}
            </div>
          </>
        ) : node ? (
          <div className="crs-outcome" data-tone={node.tone}>
            <b>{node.outcome}</b>
            <div style={{ fontSize: "0.92rem", marginTop: 4 }}>
              <Inline text={node.text} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="crs-controls">
        <button type="button" className="crs-btn crs-btn-ghost" disabled={path.length < 2} onClick={() => setPath((p) => [...p.slice(0, -2), { id: p[p.length - 2].id }])}>
          ← Back
        </button>
        <button type="button" className="crs-btn crs-btn-ghost" disabled={path.length < 2} onClick={() => setPath([{ id: start }])}>
          Start over
        </button>
      </div>
    </div>
  );
}
