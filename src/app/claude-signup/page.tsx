import { redirect } from "next/navigation";
import { Domain } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isClaudeEnabled } from "@/lib/feature-flags";
import { ClaudeOnboardingClient } from "@/components/claude/claude-onboarding-client";
import { findChallengeEnrollment } from "@/repositories/learning";
import { isCandidateRegistered } from "@/features/registration/registration-gate";

export default async function ClaudeSignupPage() {
  if (!isClaudeEnabled()) {
    redirect("/");
  }

  const session = await auth();

  if (session?.user?.id) {
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    if (!userExists) {
      redirect(
        `/api/auth/signout?callbackUrl=${encodeURIComponent("/claude-signup")}`,
      );
    }

    const registered = await isCandidateRegistered(session.user.id);

    if (registered) {
      const claudeEnrollment = await findChallengeEnrollment(
        session.user.id,
        { domain: Domain.CLAUDE },
      );

      if (claudeEnrollment) {
        redirect("/claude");
      }
      redirect("/dashboard");
    }

    redirect("/register?domain=CLAUDE");
  }

  return <ClaudeOnboardingClient />;
}
