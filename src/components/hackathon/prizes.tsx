import { Trophy } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function Prizes() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Prizes
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        What you&apos;re competing for.
      </p>

      {HACKATHON.prizes.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="size-5 text-primary" aria-hidden />
          </div>
          <p className="mt-4 text-base text-foreground sm:text-lg">
            Prizes announced soon — register now, we&apos;ll email you the moment
            they&apos;re live.
          </p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {HACKATHON.prizes.map((prize) => (
            <li
              key={prize.place}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Trophy className="size-5 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {prize.place}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{prize.reward}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
