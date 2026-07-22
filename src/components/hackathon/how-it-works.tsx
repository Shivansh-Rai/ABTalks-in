import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20"
    >
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        How it works
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Four steps from signup to submit.
      </p>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2">
        {HACKATHON.steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="font-display text-sm font-semibold text-primary">
              Step {index + 1}
            </span>
            <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
