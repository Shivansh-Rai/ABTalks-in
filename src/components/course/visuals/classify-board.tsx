"use client";

import { useState } from "react";
import type { ClassifyVisual } from "@/features/courses/types";
import { Inline } from "../inline";

/**
 * Sorting exercise: the learner assigns each item to a bucket and gets
 * instant feedback with the reason. Works with mouse, touch and keyboard
 * (buttons only, no drag and drop).
 */
export function ClassifyBoard({ config }: { config: ClassifyVisual }) {
  const { buckets, items } = config;
  const [answers, setAnswers] = useState<(string | null)[]>(() => items.map(() => null));
  const done = answers.filter((a) => a !== null).length;
  const correct = answers.filter((a, i) => a === items[i].bucket).length;

  return (
    <div>
      <ol className="crs-classify">
        {items.map((it, i) => {
          const a = answers[i];
          const ok = a !== null && a === it.bucket;
          return (
            <li key={it.text} className="crs-classify-item" data-state={a === null ? "open" : ok ? "ok" : "no"}>
              <div className="crs-classify-text">
                <Inline text={it.text} />
              </div>
              <div className="crs-controls" style={{ marginTop: 8 }} role="group" aria-label={`Classify: ${it.text}`}>
                {buckets.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="crs-chip"
                    aria-pressed={a === b.id}
                    disabled={a !== null}
                    data-correct={a !== null && b.id === it.bucket}
                    onClick={() => setAnswers((prev) => prev.map((x, j) => (j === i ? b.id : x)))}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {a !== null ? (
                <div className="crs-classify-why" aria-live="polite">
                  <b>{ok ? "Right." : `Better: ${buckets.find((b) => b.id === it.bucket)?.label}.`}</b> <Inline text={it.why} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="crs-controls">
        <span style={{ fontSize: "0.9rem" }}>
          {done === items.length ? (
            <b>
              {correct} / {items.length} correct
            </b>
          ) : (
            `${done} of ${items.length} sorted`
          )}
        </span>
        <button type="button" className="crs-btn crs-btn-ghost" onClick={() => setAnswers(items.map(() => null))}>
          Reset
        </button>
      </div>
    </div>
  );
}
