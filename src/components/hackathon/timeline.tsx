import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function Timeline() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Timeline
      </h2>
      <p className="mt-2 text-muted-foreground">
        {HACKATHON.kickoffLabel} through {HACKATHON.resultsLabel}.
      </p>

      <div className="mt-10">
        {/* Mobile: vertical rail */}
        <ol className="relative space-y-8 border-l border-border pl-6 md:hidden">
          {HACKATHON.timeline.map((item) => (
            <li key={item.title} className="relative">
              <span
                className="absolute -left-[1.625rem] top-1 size-3 rounded-full border-2 border-primary bg-background"
                aria-hidden
              />
              <h3 className="font-display text-base font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>

        {/* Desktop: horizontal */}
        <ol className="hidden gap-4 md:grid md:grid-cols-4">
          {HACKATHON.timeline.map((item, index) => (
            <li key={item.title} className="relative">
              {index < HACKATHON.timeline.length - 1 ? (
                <span
                  className="absolute left-[calc(50%+12px)] right-[-50%] top-3 h-px bg-border"
                  aria-hidden
                />
              ) : null}
              <div className="relative z-10 mx-auto mb-3 flex size-6 items-center justify-center rounded-full border-2 border-primary bg-background">
                <span className="size-2 rounded-full bg-primary" aria-hidden />
              </div>
              <h3 className="text-center font-display text-base font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
