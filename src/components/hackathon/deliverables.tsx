import { FileCode2, Globe, NotebookPen } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

const ICONS = [FileCode2, Globe, NotebookPen] as const;

export function Deliverables() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        What you submit
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Three required deliverables before {HACKATHON.deadlineLabel}.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {HACKATHON.deliverables.map((item, index) => {
          const Icon = ICONS[index] ?? FileCode2;
          return (
            <li
              key={item.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-5 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
