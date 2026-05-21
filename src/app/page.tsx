import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isClaudeEnabled } from "@/lib/feature-flags";
import { OnboardingClient } from "@/components/landing/onboarding-client";

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.id) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (profile) {
      redirect("/dashboard");
    } else {
      redirect("/register");
    }
  }

  if (isClaudeEnabled()) {
    redirect("/claude-signup");
  }

  return <OnboardingClient />;
}
