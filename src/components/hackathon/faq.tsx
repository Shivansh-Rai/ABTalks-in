"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { cn } from "@/lib/utils";

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        FAQ
      </h2>
      <p className="mt-2 text-muted-foreground">Common questions before you register.</p>

      <ul className="mt-10 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {HACKATHON.faq.map((item, index) => {
          const open = openIndex === index;
          return (
            <li key={item.q}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span className="font-display text-base font-semibold text-foreground">
                  {item.q}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              {open ? (
                <p className="px-5 pb-4 text-sm text-muted-foreground">{item.a}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
