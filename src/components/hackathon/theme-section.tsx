import { Sparkles } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function ThemeSection() {
  return (
    <section id="theme" className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
          <Sparkles className="size-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pure vibe coding
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            You describe what you want. The AI writes the code. Tools like Claude
            Code, Cursor, or any AI coding assistant are allowed — and expected.
          </p>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            The point is prompting skill and product judgment, not typing speed.
            Ship something real in 48 hours by steering the model, not by
            hand-crafting every line.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {HACKATHON.kickoffLabel} → {HACKATHON.deadlineLabel}
          </p>
        </div>
      </div>
    </section>
  );
}
