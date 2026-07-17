import { cn } from "@/lib/utils";

export function DaySectionCard({
  title,
  iconPlaceholder,
  className,
  children,
}: {
  title: string;
  iconPlaceholder?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[20px] border border-[rgba(46,57,75,0.69)] bg-[rgba(5,12,33,0.89)] p-6 md:p-8",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        {iconPlaceholder !== false && (
          <span
            className="size-9 shrink-0 rounded-md bg-[#D9D9D9]/80"
            aria-hidden
          />
        )}
        <h2 className="text-xl font-semibold text-[#968BEC] md:text-2xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

const TOOL_CHIP_STYLES: Record<string, { border: string; text: string; bg: string }> = {
  python: {
    border: "#C92883",
    text: "#C92883",
    bg: "rgba(108, 52, 82, 0.69)",
  },
  "python 3": {
    border: "#C92883",
    text: "#C92883",
    bg: "rgba(108, 52, 82, 0.69)",
  },
  "vs code": {
    border: "#C96628",
    text: "#DE5701",
    bg: "rgba(108, 80, 52, 0.69)",
  },
  pip: {
    border: "#3592E8",
    text: "#3592E8",
    bg: "rgba(26, 98, 125, 0.69)",
  },
  "ollama (pip)": {
    border: "#C96628",
    text: "#DE5701",
    bg: "rgba(108, 80, 52, 0.69)",
  },
  ollama: {
    border: "#C96628",
    text: "#DE5701",
    bg: "rgba(108, 80, 52, 0.69)",
  },
  fastapi: {
    border: "#3592E8",
    text: "#3592E8",
    bg: "rgba(26, 98, 125, 0.69)",
  },
  uvicorn: {
    border: "#6AE276",
    text: "#62CF6F",
    bg: "rgba(52, 108, 70, 0.69)",
  },
  "git & github": {
    border: "#FFCC00",
    text: "#FFCC00",
    bg: "rgba(113, 99, 7, 0.69)",
  },
};

const DEFAULT_CHIP = {
  border: "#3592E8",
  text: "#3592E8",
  bg: "rgba(26, 98, 125, 0.69)",
};

export function ToolChip({ label }: { label: string }) {
  const style = TOOL_CHIP_STYLES[label.toLowerCase()] ?? DEFAULT_CHIP;
  return (
    <span
      className="inline-flex items-center rounded-[5px] border px-2.5 py-0.5 text-xs"
      style={{
        borderColor: style.border,
        color: style.text,
        backgroundColor: style.bg,
      }}
    >
      {label}
    </span>
  );
}

export const dayMdClassName =
  "text-base leading-[30px] text-white [&_a]:text-[#968BEC] [&_a]:underline [&_code]:rounded [&_code]:bg-[#110528] [&_code]:px-1.5 [&_code]:text-[#968BEC] [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_p]:last:mb-0 [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[#8365E3]/40 [&_pre]:bg-[#110528] [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-[#A5A5A5] [&_strong]:font-semibold [&_strong]:text-[#7528C9]";
