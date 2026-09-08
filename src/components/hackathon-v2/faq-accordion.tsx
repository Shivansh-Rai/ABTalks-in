"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Item = { q: string; a: string };

export function FaqAccordion({ items }: { items: Item[] }) {
  const [openIndex, setOpenIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [heights, setHeights] = useState<number[]>(() =>
    items.map(() => 0),
  );
  const [reservedMin, setReservedMin] = useState<number | null>(null);

  // Reserve the tallest possible height so opening/closing does not push the
  // Rules section down the page.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = panelRefs.current.map(
      (p) => (p ? p.scrollHeight : 0),
    );
    setHeights(next);
    let tallest = 0;
    for (const h of next) if (h > tallest) tallest = h;
    // rest state = all rows collapsed; we then add the tallest single answer.
    const base = list.getBoundingClientRect().height - (heights[openIndex] ?? 0);
    setReservedMin(Math.ceil(base + tallest));
    // remeasure on resize
    function onResize() {
      const nxt = panelRefs.current.map((p) => (p ? p.scrollHeight : 0));
      setHeights(nxt);
      let t = 0;
      for (const h of nxt) if (h > t) t = h;
      const rest = (list?.getBoundingClientRect().height ?? 0) - (nxt[openIndex] ?? 0);
      setReservedMin(Math.ceil(rest + t));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let target: number | null = null;
    if (e.key === "ArrowDown") target = (i + 1) % items.length;
    else if (e.key === "ArrowUp") target = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = items.length - 1;
    if (target !== null) {
      e.preventDefault();
      btnRefs.current[target]?.focus();
    }
  }

  return (
    <div
      className="hk-faq__list"
      data-accordion
      ref={listRef}
      style={reservedMin ? { minHeight: `${reservedMin}px` } : undefined}
    >
      {items.map((item, i) => {
        const isOpen = i === openIndex;
        const btnId = `faq-b${i + 1}`;
        const panelId = `faq-p${i + 1}`;
        return (
          <div key={item.q} className={`faq${isOpen ? " is-open" : ""}`}>
            <h3 className="faq__h">
              <button
                className="faq__btn"
                type="button"
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                ref={(el) => {
                  btnRefs.current[i] = el;
                }}
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="faq__q">{item.q}</span>
                <span className="faq__icon" aria-hidden>
                  <i />
                  <i />
                </span>
              </button>
            </h3>
            <div
              className="faq__panel"
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              style={{
                height: isOpen ? `${heights[i] ?? 0}px` : "0px",
              }}
            >
              <div
                className="faq__inner"
                ref={(el) => {
                  panelRefs.current[i] = el;
                }}
              >
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
