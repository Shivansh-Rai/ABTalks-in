"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type FaqItem = {
  q: string;
  a: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
};

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;

        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card/70"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {item.q}
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-primary transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen ? (
              <div
                id={panelId}
                className="border-t border-border/50 px-4 py-4 text-sm leading-relaxed text-muted-foreground"
              >
                {item.a}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
