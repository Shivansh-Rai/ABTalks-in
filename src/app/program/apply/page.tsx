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
import { JoinCodeGate } from "@/components/program/join-code-gate";
import { startEntryAssessmentAction } from "@/app/actions/program-entry-actions";
import {
  ENTRY_DURATION_MIN,
  ENTRY_PASS_TECHNICAL,
  ENTRY_PASS_TOTAL,
  ENTRY_TOTAL,
  getEntryState,
} from "@/features/program/entry";
import { formatDateTimeIST } from "@/lib/date-utils";
import { isProgramEntryBypassEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      {children}
    </main>
  );
}

type Props = {
  searchParams: Promise<{ code?: string }>;
};

export default async function ProgramApplyPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const code = params.code ?? null;

  if (!session?.user?.id) {
    const from = code
      ? `/program/apply?code=${encodeURIComponent(code)}`
      : "/program/apply";
    redirect(`/login?from=${encodeURIComponent(from)}`);
  }

  const state = await getEntryState(session.user.id, code);

  if (state.screen === "in_progress") {
    redirect("/program/assessment");
  }

  if (state.screen === "need_code" || state.screen === "invalid_code") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Enter your cohort join code</CardTitle>
            <CardDescription>
              You need a join code from your program organizer to apply to a
              specific cohort.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JoinCodeGate
              initialCode={code ?? ""}
              invalid={state.screen === "invalid_code"}
            />
          </CardContent>
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
  const skipAssessment = isProgramEntryBypassEnabled();
  return (
    <Shell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Apply to {state.cohortName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {skipAssessment
            ? "Tell us about your professional background to join the program."
            : "Tell us about your professional background. After applying you'll take a short entry assessment."}
        </p>
      </div>
      <ApplyForm joinCode={state.joinCode} />
    </Shell>
  );
}
