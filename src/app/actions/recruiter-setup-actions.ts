"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isRecruiterAuthEnabled } from "@/lib/feature-flags";
import { provisionRecruiterIdentity } from "@/features/hire/provision-recruiter";
import { optionalPhoneSchema } from "@/lib/validations/phone";

type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

const profileStepSchema = z.object({
  step: z.literal("PROFILE"),
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: optionalPhoneSchema,
});

const companyStepSchema = z.object({
  step: z.literal("COMPANY"),
  company: z.string().trim().min(2, "Enter your company.").max(200),
});

const setupStepSchema = z.discriminatedUnion("step", [
  profileStepSchema,
  companyStepSchema,
]);

/**
 * Resolve the recruiter whose setup this is.
 *
 * Deliberately NOT `requireRecruiterWorkspace`: that one refuses anyone whose
 * setup is unfinished, which is everybody who legitimately reaches these
 * actions. The rule it shares is the one that matters — the recruiter comes
 * from the session, never from the payload.
 */
async function resolveSetupSubject(): Promise<
  { ok: true; userId: string; profileId: string } | { ok: false; message: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Please sign in to continue." };

  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    select: { id: true, setupCompletedAt: true },
  });
  if (!profile) {
    return { ok: false, message: "Register as a recruiter first." };
  }
  if (profile.setupCompletedAt) {
    return { ok: false, message: "Your setup is already complete." };
  }
  return { ok: true, userId, profileId: profile.id };
}

/**
 * Save one step and move to the next.
 *
 * Idempotent: saving the same step twice writes the same row and is not an
 * error. That is what makes the wizard resumable — a recruiter who closed the
 * tab mid-step returns, re-submits, and nothing objects.
 *
 * Nothing here revalidates /talent/setup. The wizard advances client-side, and
 * marking this route stale makes the router re-fetch it — which, once setup is
 * complete, lands on the page's own pending guard and redirects the recruiter
 * away from the success panel. The next full load reads the state fresh anyway.
 */
export async function saveRecruiterSetupStepAction(
  input: unknown,
): Promise<ActionResult<{ nextStep: "COMPANY" | "COMPLETE" }>> {
  if (!isRecruiterAuthEnabled()) {
    return {
      ok: false,
      message: "Recruiter sign-in and registration aren't open yet.",
    };
  }

  const parsed = setupStepSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  const subject = await resolveSetupSubject();
  if (!subject.ok) return { ok: false, message: subject.message };

  try {
    if (parsed.data.step === "PROFILE") {
      await prisma.recruiterProfile.update({
        where: { id: subject.profileId },
        data: {
          fullName: parsed.data.fullName,
          phone: parsed.data.phone || null,
          setupStep: "COMPANY",
        },
      });
      return { ok: true, data: { nextStep: "COMPANY" } };
    }

    await prisma.recruiterProfile.update({
      where: { id: subject.profileId },
      data: { company: parsed.data.company, setupStep: "COMPLETE" },
    });
    return { ok: true, data: { nextStep: "COMPLETE" } };
  } catch (error) {
    logger.error("[recruiter-setup] saveRecruiterSetupStepAction", {
      error: String(error),
    });
    return { ok: false, message: "Could not save. Try again." };
  }
}

/**
 * Finish setup and provision the workspace.
 *
 * The workspace is created here and nowhere else in this flow, so a recruiter
 * who abandoned the wizard never leaves an empty Organization behind. One
 * transaction: the profile is only marked complete if the workspace was
 * actually written.
 */
export async function completeRecruiterSetupAction(): Promise<ActionResult> {
  if (!isRecruiterAuthEnabled()) {
    return {
      ok: false,
      message: "Recruiter sign-in and registration aren't open yet.",
    };
  }

  const subject = await resolveSetupSubject();
  if (!subject.ok) return { ok: false, message: subject.message };

  try {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { id: subject.profileId },
      select: { fullName: true, company: true },
    });
    // Belt and braces: the steps above enforce these, but completing on a row
    // that somehow lacks them would provision a workspace named "org".
    if (!profile?.fullName?.trim() || !profile.company.trim()) {
      return { ok: false, message: "Finish the earlier steps first." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.recruiterProfile.update({
        where: { id: subject.profileId },
        data: { setupStep: "COMPLETE", setupCompletedAt: new Date() },
      });
      await provisionRecruiterIdentity(tx, {
        userId: subject.userId,
        company: profile.company,
      });
    });

    // No revalidatePath here, for any path. In the App Router a revalidate
    // issued from a Server Action refreshes the route the caller is standing
    // on — not only the path named — and re-rendering /talent/setup once setup
    // is complete hits this page's own pending guard, which redirected the
    // recruiter off the success panel a second after it appeared. Nothing
    // needs it: /talent/pending and /hire both read the session per request
    // and are never statically cached.
    return { ok: true };
  } catch (error) {
    logger.error("[recruiter-setup] completeRecruiterSetupAction", {
      error: String(error),
    });
    return { ok: false, message: "Could not finish setup. Try again." };
  }
}
