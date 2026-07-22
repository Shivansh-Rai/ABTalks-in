import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { cn } from "@/lib/utils";

export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-6 py-12 text-center shadow-sm sm:px-10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Ready to vibe code?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {HACKATHON.tagline} Free to enter. Solo or teams of {HACKATHON.maxTeamSize}.
        </p>
        <Link
          href="/hackathon/register"
          className={cn(buttonVariants({ size: "lg" }), "mt-8 inline-flex")}
        >
          Register free →
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          {HACKATHON.registrationClosesLabel}
        </p>
      </div>
    </section>
  );
}
