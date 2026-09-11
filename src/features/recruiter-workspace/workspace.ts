import "server-only";

import { auth } from "@/auth";
import { ensureRecruiterWorkspace } from "@/features/hire/provision-recruiter";

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

  // Being a recruiter is the whole condition. There is no approval to wait for
  // and no wizard to finish: `ensureRecruiterWorkspace` creates the workspace
  // if registration has not already, and the membership row it resolves is
  // slugged on this recruiter's own id, so it can only ever be their own.
  const workspace = await ensureRecruiterWorkspace(userId);
  if (!workspace) {
    return { ok: false, message: "This account is not a recruiter account." };
  }

  return {
    ok: true,
    data: {
      userId,
      recruiterProfileId: workspace.recruiterProfileId,
      organizationId: workspace.organizationId,
      company: workspace.company,
    },
  };
}
