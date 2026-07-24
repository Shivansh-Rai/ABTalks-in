import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RegistrationForm } from "@/components/hackathon/registration-form";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Register | ABTalks Vibe Code Hackathon",
  description:
    "Register for the ABTalks Vibe Code Hackathon, solo or as a team of up to 3.",
};

export default function HackathonRegisterPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-xl px-4 py-12 sm:py-16">
        <Link
          href="/hackathon"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-6 -ml-2 gap-1.5",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to hackathon
        </Link>

        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Register
        </h1>
        <p className="mt-2 text-muted-foreground">
          {HACKATHON.name}, free entry, solo or teams of {HACKATHON.maxTeamSize}.
        </p>

        <div className="mt-8">
          {HACKATHON.registrationOpen ? (
            <RegistrationForm />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Registration is closed
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks for your interest. Registration for this hackathon has
                closed. Follow ABTalks for the next event.
              </p>
              <Link
                href="/hackathon"
                className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}
              >
                Back to landing
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
