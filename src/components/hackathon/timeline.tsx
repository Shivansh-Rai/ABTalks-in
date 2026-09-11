import { HACKATHON } from "@/components/hackathon/hackathon-config";

function TimelineNode({ index, size }: { index: number; size: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <span
      className={
        isLg
          ? "relative z-10 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#02434D] shadow-[0_4px_10px_rgba(0,0,0,0.1),4px_0_10px_rgba(0,0,0,0.1),-4px_0_10px_rgba(0,0,0,0.1)]"
          : "relative z-10 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#02434D] shadow-[0_4px_10px_rgba(0,0,0,0.1)]"
      }
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(3, 83, 95, 1) 0%, rgba(3, 83, 95, 1) 50%, rgba(0, 0, 0, 1) 100%)",
      }}
      aria-hidden
    >
      <span
        className={
          isLg
            ? "block text-[22px] font-semibold leading-none text-white"
            : "block text-[13px] font-semibold leading-none text-white"
        }
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        {index + 1}
      </span>
    </span>
  );
}

export function Timeline() {
  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24">
      <h2
        className="bg-gradient-to-r from-white from-[75%] to-[#A5A5A5] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        Timeline
      </h2>
      <p className="mt-3 max-w-3xl text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#D2D2D2]">
        {HACKATHON.kickoffLabel} through {HACKATHON.resultsLabel}.
      </p>

      {/* Mobile: vertical rail — continuous dashed line through numbered nodes */}
      <ol className="relative mt-10 space-y-8 origin-top max-md:[zoom:0.9] md:hidden">
        {/* Line centered on the node column (w-9 = 36px → center at 18px) */}
        <span
          className="absolute left-[17px] top-4 bottom-4 w-0 border-l-2 border-dashed border-[#076573]"
          aria-hidden
        />
        {HACKATHON.timeline.map((item, index) => (
          <li key={item.title} className="relative flex gap-3">
            <div className="relative z-10 flex w-9 shrink-0 flex-col items-center">
              <TimelineNode index={index} size="sm" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[16px] font-semibold leading-snug text-[#A6D2D5] underline">
                {item.title}
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[#E9E9E9]">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Desktop: horizontal */}
      <div className="relative mt-16 hidden md:block">
        <div
          className="absolute left-[12%] right-[12%] top-8 border-t border-dashed border-[#076573]"
          aria-hidden
        />
        <ol className="relative grid grid-cols-4 gap-4">
          {HACKATHON.timeline.map((item, index) => (
            <li
              key={item.title}
              className="flex flex-col items-center text-center"
            >
              <TimelineNode index={index} size="lg" />
              <h3 className="mt-5 text-[clamp(1rem,1.5vw,1.75rem)] font-semibold text-[#A6D2D5] underline">
                {item.title}
              </h3>
              <p className="mt-3 max-w-[289px] text-[16px] text-[#E9E9E9]">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
