"use client";

import { useId, useState } from "react";
import type { BudgetVisual } from "@/features/courses/types";
import { Inline } from "../inline";

/**
 * Capacity simulator: a fixed budget (tokens, ms, rupees…) and candidate items
 * with a cost and priority. Required items always go in; the rest are packed
 * greedily by priority. Dragging the budget shows what gets squeezed out first.
 */
export function BudgetPacker({ config }: { config: BudgetVisual }) {
  const id = useId();
  const { unit, min, max, initial, items } = config;
  const [budget, setBudget] = useState(initial);
  const [off, setOff] = useState<Set<number>>(new Set());

  const order = items
    .map((it, i) => ({ ...it, i }))
    .filter((it) => !off.has(it.i))
    .sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)) || b.priority - a.priority);

  const included = new Set<number>();
  let used = 0;
  for (const it of order) {
    if (it.required || used + it.cost <= budget) {
      included.add(it.i);
      used += it.cost;
    }
  }
  const over = used > budget;
  const pct = Math.min(100, (used / budget) * 100);
  const dropped = items.filter((_, i) => !off.has(i) && !included.has(i)).map((it) => it.label);

  return (
    <div>
      <label htmlFor={id} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
        Budget: {budget.toLocaleString()} {unit}
      </label>
      <input
        id={id}
        className="crs-range"
        type="range"
        min={min}
        max={max}
        step={Math.max(1, Math.round((max - min) / 100))}
        value={budget}
        onChange={(e) => setBudget(Number(e.target.value))}
      />
      <div className="crs-meter" aria-hidden="true" style={{ marginTop: 8 }}>
        <span style={{ width: `${pct}%`, background: over ? "var(--c-danger)" : "var(--c-pri)" }} />
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--c-mu)", marginTop: 4 }}>
        Used {used.toLocaleString()} of {budget.toLocaleString()} {unit}
        {over ? ", required items alone exceed the budget" : ""}
      </div>

      <div style={{ marginTop: 10 }}>
        {items.map((it, i) => {
          const disabled = off.has(i);
          const isIn = included.has(i);
          return (
            <div key={it.label} className="crs-budget-row" data-in={isIn}>
              <input
                type="checkbox"
                aria-label={`Offer ${it.label}`}
                checked={!disabled}
                disabled={it.required}
                onChange={() =>
                  setOff((s) => {
                    const n = new Set(s);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
              />
              <div>
                <span className="crs-budget-name" style={{ fontWeight: 600 }}>
                  {it.label}
                </span>
                {it.required ? <span style={{ fontSize: "0.72rem", color: "var(--c-pri)", marginLeft: 6 }}>always kept</span> : null}
                <div style={{ fontSize: "0.82rem", color: "var(--c-mu)" }}>
                  <Inline text={it.note} />
                </div>
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--c-mu)", whiteSpace: "nowrap" }}>
                {it.cost.toLocaleString()} · p{it.priority}
              </span>
            </div>
          );
        })}
      </div>
      <div className="crs-live" aria-live="polite">
        {dropped.length === 0 ? (
          <>Everything fits. Notice how much budget is spent, every item here is paid for on every call.</>
        ) : (
          <>
            <b>Squeezed out:</b> {dropped.join(", ")}. The model will not see these at all, it cannot use what is not in front of it.
          </>
        )}
      </div>
      <div className="crs-controls">
        <button type="button" className="crs-btn crs-btn-ghost" onClick={() => { setBudget(initial); setOff(new Set()); }}>
          Reset
        </button>
      </div>
    </div>
  );
}
