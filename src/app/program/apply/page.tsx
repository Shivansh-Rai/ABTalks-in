import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApplyForm } from "@/components/program/apply-form";
import { startEntryAssessmentAction } from "@/app/actions/program-entry-actions";
import {
  ENTRY_DURATION_MIN,
  ENTRY_PASS_TECHNICAL,
  ENTRY_PASS_TOTAL,
  ENTRY_TOTAL,
  getEntryState,
} from "@/features/program/entry";
import { formatDateTimeIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      {children}
    </main>
  );
}

export default async function ProgramApplyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?from=/program/apply");

  const state = await getEntryState(session.user.id);

  if (state.screen === "in_progress") {
    redirect("/program/assessment");
  }

  if (state.screen === "unavailable") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>No open cohort</CardTitle>
            <CardDescription>
              There isn&apos;t a program cohort accepting applications right now.
              Check back soon.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (state.screen === "closed") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Applications closed</CardTitle>
            <CardDescription>
              {state.cohortName} is no longer accepting new applications.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (state.screen === "enrolled") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>You&apos;re enrolled</CardTitle>
            <CardDescription>
              Welcome to AI Cohort. Head to your dashboard to begin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/program/dashboard"
              className={cn(buttonVariants(), "w-full sm:w-auto")}
            >
              Go to dashboard
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.screen === "waitlisted") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>You&apos;re on the waitlist</CardTitle>
            <CardDescription>
              You passed the assessment, but this cohort is full. We&apos;ll reach
              out if a spot opens up.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (state.screen === "cooldown") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Retake locked</CardTitle>
            <CardDescription>
              You didn&apos;t pass your first attempt. You can retake the
              assessment after {formatDateTimeIST(new Date(state.retakeAtIso))}{" "}
              (IST).
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (state.screen === "failed") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Not eligible this cohort</CardTitle>
            <CardDescription>
              You&apos;ve used both assessment attempts for this cohort. You&apos;re
              welcome to apply to a future cohort.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (state.screen === "intro") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Entry assessment</CardTitle>
            <CardDescription>
              {state.attemptNumber === 2
                ? "This is your final attempt."
                : "One quick check before you join the program."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• {ENTRY_TOTAL} questions — aptitude + technical.</li>
              <li>• {ENTRY_DURATION_MIN} minutes, timed. The timer is enforced by the server.</li>
              <li>
                • Pass mark: {ENTRY_PASS_TOTAL}/{ENTRY_TOTAL} overall and at least{" "}
                {ENTRY_PASS_TECHNICAL}/10 on the technical section.
              </li>
              <li>• Attempt {state.attemptNumber} of 2.</li>
            </ul>
            <form action={startEntryAssessmentAction}>
              <button type="submit" className={cn(buttonVariants(), "w-full sm:w-auto")}>
                Start assessment
              </button>
            </form>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // state.screen === "form"
  return (
    <Shell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Apply to {state.cohortName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us about your professional background. After applying you&apos;ll
          take a short entry assessment.
        </p>
      </div>
      <ApplyForm />
    </Shell>
  );
}
