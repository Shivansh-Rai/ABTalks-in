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
import { getEntryState } from "@/features/program/entry";
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

  // Assessment quiz removed — any in-progress attempt resumes at apply/enroll.
  if (state.screen === "in_progress") {
    redirect("/program/apply");
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
              This cohort is full. We&apos;ll reach out if a spot opens up.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  // Legacy assessment failure screens (quiz removed; rare for old attempts).
  if (state.screen === "cooldown" || state.screen === "failed") {
    return (
      <Shell>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Application status</CardTitle>
            <CardDescription>
              Please contact your program organizer if you need help joining
              this cohort.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  // Bypass enrolls on apply — "intro" should not appear; treat as form if it does.
  if (state.screen === "intro") {
    redirect(code ? `/program/apply?code=${encodeURIComponent(code)}` : "/program/apply");
  }

  // state.screen === "form"
  return (
    <Shell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Apply to {state.cohortName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us about your professional background to join the program.
        </p>
      </div>
      <ApplyForm joinCode={state.joinCode} />
    </Shell>
  );
}
