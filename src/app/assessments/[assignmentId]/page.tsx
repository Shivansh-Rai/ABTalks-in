import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { AssessmentAttempt } from "@/components/assessments/assessment-attempt";
import { buttonVariants } from "@/components/ui/button";
import { loadAttempt } from "@/features/assessment-attempts/service";
import { prismaAttemptStore } from "@/features/assessment-attempts/prisma-store";
import { formatDateTimeIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ assignmentId: string }> };

export const metadata: Metadata = { title: "Assessment | ABTalks" };

export default async function AssessmentAttemptPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { assignmentId } = await params;
  const loaded = await loadAttempt(prismaAttemptStore(), session.user.id, assignmentId);
  // Someone else's assignment, an unknown id or an unpublished assessment:
  // 404, never 403 — an id must not reveal that it exists.
  if (!loaded.ok) notFound();

  const shellUser = {
    name: session.user.name ?? session.user.email ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  return (
    <DashboardShell
      user={shellUser}
      isAdmin={session.user.isAdmin ?? false}
      showSectionNav={false}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Link
          href="/assessments"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}
        >
          ← All assessments
        </Link>
        <AssessmentAttempt
          assignmentId={loaded.data.assignmentId}
          status={loaded.data.status}
          submittedAtLabel={
            loaded.data.submittedAt ? formatDateTimeIST(loaded.data.submittedAt) : null
          }
          view={loaded.data.view}
          initialAnswers={loaded.data.answers}
        />
      </main>
    </DashboardShell>
  );
}
