import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

type ActionOk<T> = { ok: true; data: T };
type ActionErr = { ok: false; message: string };
type ActionResult<T> = ActionOk<T> | ActionErr;

/**
 * Action-safe recruiter gates. Pages keep `requireRecruiter()` (redirect).
 * Mutations return a result envelope so a candidate calling a recruiter
 * endpoint gets a refusal, not a silent redirect.
 */
export async function requireApprovedRecruiterAction(): Promise<
  ActionResult<{ userId: string }>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Sign in as an approved recruiter." };
  }
  try {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId: session.user.id },
      select: { approved: true },
    });
    if (!profile?.approved) {
      return { ok: false, message: "Recruiter access not approved yet." };
    }
    return { ok: true, data: { userId: session.user.id } };
  } catch (error) {
    logger.error("[recruiter-gate] requireApprovedRecruiterAction", {
      error: String(error),
    });
    return {
      ok: false,
      message: "Could not reach the server. Try again in a moment.",
    };
  }
}

export async function requireRegisteredRecruiterAction(): Promise<
  ActionResult<{ userId: string; approved: boolean }>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Sign in to continue." };
  }
  try {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId: session.user.id },
      select: { approved: true },
    });
    if (!profile) {
      return { ok: false, message: "Register as a recruiter first." };
    }
    return {
      ok: true,
      data: { userId: session.user.id, approved: profile.approved },
    };
  } catch (error) {
    logger.error("[recruiter-gate] requireRegisteredRecruiterAction", {
      error: String(error),
    });
    return {
      ok: false,
      message: "Could not reach the server. Try again in a moment.",
    };
  }
}
