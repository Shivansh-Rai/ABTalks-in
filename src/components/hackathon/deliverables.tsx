import { FileCode2, Globe, NotebookPen } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

const ICONS = [FileCode2, Globe, NotebookPen] as const;

export function Deliverables() {
  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24">
      <h2
        className="bg-gradient-to-r from-white from-[75%] to-[#A5A5A5] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        What you submit
      </h2>
      <p className="mt-3 max-w-3xl text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#D2D2D2]">
        Three required deliverables before {HACKATHON.deadlineLabel}.
      </p>

      <ul className="mt-12 grid gap-6 sm:grid-cols-3 sm:gap-8">
        {HACKATHON.deliverables.map((item, index) => {
          const Icon = ICONS[index] ?? FileCode2;
          return (
            <li
              key={item.title}
              className="rounded-[20px] border border-[#03535F] bg-[#000000] p-6 transition-colors hover:border-[#076573]"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#03535F]/40">
                <Icon className="size-6 text-[#A6D2D5]" aria-hidden />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#D2D2D2]">
                {item.body}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
