import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Countdown } from "@/components/hackathon/countdown";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:py-20">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {HACKATHON.name}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {HACKATHON.tagline}
        </p>
        <p className="mt-3 text-sm font-medium text-foreground sm:text-base">
          {HACKATHON.kickoffLabel}
        </p>

        <div className="mt-8 flex justify-center">
          <Countdown targetIso={HACKATHON.kickoffUtc} />
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/hackathon/register"
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            Register free →
          </Link>
          <Link
            href="#how-it-works"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full sm:w-auto",
            )}
          >
            How it works
          </Link>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {HACKATHON.registrationClosesLabel}
        </p>
      </div>
    </section>
  );
}
