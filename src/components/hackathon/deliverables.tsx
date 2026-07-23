import { FileCode2, Globe, NotebookPen } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

const ICONS = [FileCode2, Globe, NotebookPen] as const;

export function Deliverables() {
  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24">
      <h2
        className="bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
      >
        What you submit
      </h2>
      <p className="mt-3 max-w-3xl text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#BCBCBC]">
        Three required deliverables before {HACKATHON.deadlineLabel}.
      </p>

      <ul className="mt-12 grid gap-6 sm:grid-cols-3 sm:gap-8">
        {HACKATHON.deliverables.map((item, index) => {
          const Icon = ICONS[index] ?? FileCode2;
          return (
            <li
              key={item.title}
              className="rounded-[20px] border border-[#403880] bg-[#030712] p-6 transition-colors hover:border-[#7364E6]"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#403880]/40">
                <Icon className="size-6 text-[#968BEC]" aria-hidden />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#BCBCBC]">
                {item.body}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
