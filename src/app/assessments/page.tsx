import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  listCandidateAttempts,
  type AttemptStatus,
} from "@/features/assessment-attempts/service";
import { prismaAttemptStore } from "@/features/assessment-attempts/prisma-store";
import { formatDateIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assessments | ABTalks" };

// No score or pass/fail anywhere on this page: the candidate sees "Submitted"
// only (plan 129, D-1). The recruiter's monitor shows the result.
const STATUS: Record<AttemptStatus, { label: string; badge: string; action: string }> = {
  ASSIGNED: {
    label: "Not started",
    badge: "bg-[#F4F4F4] text-[#4B4B4B]",
    action: "Start",
  },
  STARTED: {
    label: "In progress",
    badge: "bg-[#E7F2F3] text-[#03535F]",
    action: "Continue",
  },
  SUBMITTED: {
    label: "Submitted",
    badge: "bg-[#D6F7EC] text-[#197E23]",
    action: "View",
  },
};

export default async function AssessmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const listed = await listCandidateAttempts(prismaAttemptStore(), session.user.id);
  const rows = listed.ok ? listed.data : [];

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
        <h1 className="font-display text-3xl font-bold tracking-tight">Assessments</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Assessments recruiters have invited you to. Your answers save as you
          go, so you can pick up where you left off on any device.
        </p>

        {rows.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#E7F2F3] text-[#03535F]">
              <ClipboardCheck className="size-6" aria-hidden="true" />
            </span>
            <p className="font-display text-lg font-semibold">No assessments yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              When a recruiter invites you to one, it appears here and in your
              notifications.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4">
            {rows.map((row) => {
              const s = STATUS[row.status];
              const facts = [
                row.status === "SUBMITTED" && row.submittedAt
                  ? `Submitted ${formatDateIST(row.submittedAt)}`
                  : `Assigned ${formatDateIST(row.assignedAt)}`,
                row.durationMinutes == null ? "Untimed" : `${row.durationMinutes} min`,
                `${row.questionCount} ${row.questionCount === 1 ? "question" : "questions"}`,
              ];
              return (
                <li
                  key={row.assignmentId}
                  className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        s.badge,
                      )}
                    >
                      {s.label}
                    </span>
                    <h2 className="font-display text-lg font-semibold leading-snug">
                      {row.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
                  </div>
                  <Link
                    href={`/assessments/${row.assignmentId}`}
                    className={cn(
                      buttonVariants({
                        variant: row.status === "SUBMITTED" ? "outline" : "default",
                      }),
                      "w-full shrink-0 sm:w-auto",
                    )}
                  >
                    {s.action}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </DashboardShell>
  );
}
