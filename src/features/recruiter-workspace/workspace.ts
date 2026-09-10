import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * The recruiter workspace boundary (T-226).
 *
 * Every recruiter works alone. Their projects, credits, jobs, pipeline,
 * assessments and outreach belong to them and to nobody else, including a
 * colleague on the same email domain. That rule is only as good as the place it
 * is enforced, so there is exactly one place: here.
 *
 * The caller is resolved from the session, on the server. This function takes no
 * user id, no workspace id and no organization id, because anything the client
 * can send it can also change — the whole class of "recruiter A passes
 * recruiter B's id" bugs is closed by the signature rather than by a check
 * somebody has to remember to write.
 *
 * Every recruiter-scoped read and write goes through this. If a query needs a
 * workspace, it gets it from here or it does not run.
 */
export type RecruiterWorkspace = {
  userId: string;
  recruiterProfileId: string;
  organizationId: string;
  company: string;
};

export type WorkspaceResult =
  | { ok: true; data: RecruiterWorkspace }
  | { ok: false; message: string };

export async function requireRecruiterWorkspace(): Promise<WorkspaceResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Please sign in to continue." };

  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      company: true,
      approved: true,
      setupCompletedAt: true,
    },
  });
  if (!profile) {
    return { ok: false, message: "This account is not a recruiter account." };
  }
  if (!profile.setupCompletedAt) {
    return { ok: false, message: "Finish setting up your workspace first." };
  }
  if (!profile.approved) {
    return { ok: false, message: "Your recruiter application is still under review." };
  }

  // The membership row is what names the workspace. It is written by
  // provisionRecruiterIdentity at the end of setup, and its slug carries the
  // recruiter's own id, so this can only ever resolve to their own.
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { organizationId: true },
  });
  if (!membership) {
    return { ok: false, message: "Your workspace is not ready yet." };
  }

  return {
    ok: true,
    data: {
      userId,
      recruiterProfileId: profile.id,
      organizationId: membership.organizationId,
      company: profile.company,
    },
  };
}
