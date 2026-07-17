import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Newest cohort that is enrolling, running, or completed. Null if none. */
export async function getActiveCohort() {
  return prisma.programCohort.findFirst({
    where: { status: { in: ["ENROLLING", "ACTIVE", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      resultsPublishedAt: true,
    },
  });
}

/**
 * Require an enrolled/completed program member for the active cohort.
 * DB-checked (the JWT can be stale). Redirects to the public landing otherwise.
 */
export async function requireProgramMember() {
  const session = await auth();
  if (!session?.user?.id) redirect("/program");

  const cohort = await getActiveCohort();
  if (!cohort) redirect("/program");

  const member = await prisma.programMember.findUnique({
    where: { userId_cohortId: { userId: session.user.id, cohortId: cohort.id } },
    select: {
      id: true,
      status: true,
      fullName: true,
      highestUnlockedDay: true,
      cohortId: true,
    },
  });

  if (!member || (member.status !== "ENROLLED" && member.status !== "COMPLETED")) {
    redirect("/program");
  }

  return { member, cohort, userId: session.user.id };
}

/**
 * Require an approved recruiter. DB-checked (approval flips aren't in the JWT).
 * Redirects to the pending page otherwise.
 */
export async function requireRecruiter() {
  const session = await auth();
  if (!session?.user?.id) redirect("/talent/pending");

  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, approved: true, company: true, fullName: true },
  });

  if (!profile || !profile.approved) redirect("/talent/pending");

  return { profile, userId: session.user.id };
}
