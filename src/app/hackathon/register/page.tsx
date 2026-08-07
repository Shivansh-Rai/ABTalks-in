import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { HACKATHON, isHackathonRegistrationOpen } from "@/components/hackathon/hackathon-config";
import { RegistrationForm } from "@/components/hackathon/registration-form";
import { buttonVariants } from "@/components/ui/button";
import { getMyRegistration } from "@/features/hackathon/get-my-registration";
import { getLastRemovalForUser } from "@/features/hackathon/remove-participant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Register | ABTalks Vibe Code Hackathon",
  description:
    "Register for the ABTalks Vibe Code Hackathon, solo or as a team of up to 3.",
};

export default async function HackathonRegisterPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/login?from=/hackathon/register");
  }

  const existing = await getMyRegistration(session.user.id);
  if (existing) redirect("/hackathon/dashboard");

  const lastRemoval = await getLastRemovalForUser(session.user.id);

  const initialEmail = session.user.email;
  const initialName = session.user.name ?? "";
  const registrationOpen = isHackathonRegistrationOpen();

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
          {lastRemoval ? (
            <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="font-display text-sm font-semibold text-foreground">
                You&apos;re no longer on{" "}
                {lastRemoval.teamName ?? "your previous team"}.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The team leader removed you from the roster. You can register
                again below — solo, as your own team, or with any team code
                (including{" "}
                <span className="font-mono font-medium text-foreground">
                  {lastRemoval.teamCode}
                </span>{" "}
                if you&apos;re rejoining).
              </p>
            </div>
          ) : null}
          {registrationOpen ? (
            <RegistrationForm
              initialEmail={initialEmail}
              initialName={initialName}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Registration is closed
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks for your interest. Registration for this hackathon has
                closed. Follow ABTalks for the next event.
              </p>
              <a
                href="https://abtalks.in"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants(), "mt-4 inline-flex")}
              >
                Explore ABTalks
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
