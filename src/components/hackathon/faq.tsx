"use client";

import Image from "next/image";
import { useState } from "react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { cn } from "@/lib/utils";

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:pb-28 sm:pt-24">
      <h2
        className="bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
      >
        FAQ
      </h2>
      <p className="mt-3 text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#BCBCBC]">
        Common questions before you register.
      </p>

      <ul className="mt-12 overflow-hidden rounded-[20px] border border-[#403880]">
        {HACKATHON.faq.map((item, index) => {
          const open = openIndex === index;
          return (
            <li
              key={item.q}
              className={cn(
                index > 0 && "border-t border-[#4B4B4B]",
                !open && "bg-[#030712]",
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex w-full items-start justify-between gap-4 px-5 py-4 text-left sm:px-10 sm:py-5",
                  open &&
                    "bg-[linear-gradient(270deg,rgba(25,27,64,1)_0%,rgba(64,71,166,1)_100%)]",
                )}
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-[18px] font-semibold tracking-[0.02em] sm:text-[20px]",
                      open ? "text-white" : "text-[#D2D2D2]",
                    )}
                  >
                    {item.q}
                  </span>
                  {open ? (
                    <p className="mt-2 text-[16px] tracking-[0.02em] text-white">
                      {item.a}
                    </p>
                  ) : null}
                </div>
                <Image
                  src="/hackathon/faq-chevron.png"
                  alt=""
                  width={28}
                  height={27}
                  className={cn(
                    "mt-1 size-7 shrink-0 transition-transform",
                    // Asset points left; open → down, closed → up
                    open ? "rotate-90" : "-rotate-90",
                  )}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
