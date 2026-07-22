import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function Rules() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Rules
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Eligibility, team size, and fair play.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {HACKATHON.rules.map((rule) => (
          <li
            key={rule.title}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <h3 className="font-display text-lg font-semibold text-foreground">
              {rule.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{rule.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
