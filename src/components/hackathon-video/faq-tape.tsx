"use client";

import { useState } from "react";

type QA = { q: string; a: string };

/**
 * Minimal accordion. One item can be open at a time; clicking an open item
 * closes it. Uses the play-triangle caret from `landing.css`.
 */
export function FaqTape({ items }: { items: QA[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="vt-faq">
      {items.map((qa, i) => {
        const open = openIndex === i;
        return (
          <div
            key={qa.q}
            className="vt-faq__item"
            data-open={open ? "true" : "false"}
          >
            <button
              type="button"
              className="vt-faq__q"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : i)}
            >
              <span>{qa.q}</span>
              <span className="vt-faq__triangle" aria-hidden />
            </button>
            <div className="vt-faq__a">{qa.a}</div>
          </div>
        );
      })}
    </div>
  );
}
