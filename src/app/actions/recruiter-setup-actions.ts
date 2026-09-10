"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isRecruiterAuthEnabled } from "@/lib/feature-flags";
import {
  recruiterIdentityWrites,
  recruiterWorkspaceSlug,
} from "@/features/hire/provision-recruiter";
import {
  grantOnboardingCreditsAtomic,
  onboardingGrantKey,
} from "@/repositories/credits";
import { getIntConfig, STARTING_GRANT_KEY } from "@/lib/platform-config";
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
 * who abandoned the wizard never leaves an empty Organization behind. The
 * profile is only marked complete if the workspace was actually written.
 *
 * ## Why this is not one interactive transaction (T-228)
 *
 * It was, and it took ~8.6s against Neon. `prisma.$transaction(async tx => …)`
 * holds a connection open and pays a network round trip per statement, and the
 * body was five of them — profile update, organization upsert, member upsert, a
 * role-assignment lookup and its conditional create — plus BEGIN and COMMIT.
 * From wherever the recruiter happens to be, that is seven trips spent on
 * writes that take microseconds. `approveRecruiterAction` already carries the
 * same warning; this is the same fix.
 *
 * The writes are not independent as they stand — the member and the role
 * assignment both need the organization's id, and the role-assignment check is
 * a read. So the two reads are hoisted in front, batched into one round trip,
 * and the organization's id is decided here rather than discovered inside the
 * transaction. What remains is five statements with no read between them, which
 * `prisma.$transaction([…])` sends as a single round trip and still commits
 * atomically.
 *
 * If a concurrent request creates the organization between the read and the
 * write, the member upsert's foreign key fails and the whole batch rolls back.
 * The recruiter sees "Could not finish setup. Try again." and a retry succeeds.
 * It errors rather than corrupting, which is the right trade for a step one
 * person runs once.
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

    const slug = recruiterWorkspaceSlug(subject.userId, profile.company);

    // Both reads, one round trip. Everything the batch below needs to know
    // before it can be a batch.
    const [existingOrg, liveRoleAssignments] = await prisma.$transaction([
      prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      }),
      // Scoped in JavaScript rather than in the query, because the scope id is
      // the organization's and that is what the first read is still resolving.
      // Same predicate as provisionRecruiterIdentity, one round trip earlier.
      prisma.userRoleAssignment.findMany({
        where: {
          userId: subject.userId,
          role: "RECRUITER",
          scopeType: "ORGANIZATION",
          revokedAt: null,
        },
        select: { scopeId: true },
      }),
    ]);

    // A workspace this recruiter does not have yet is created with an id chosen
    // here, so the member and role rows in the same batch can reference it. The
    // prefix convention matches src/repositories/ids.ts; the upsert still keys
    // on the slug, so this id is only ever used when creating.
    const organizationId = existingOrg?.id ?? `org_${subject.userId}`;
    const isNewWorkspace = existingOrg === null;
    const startingGrant = isNewWorkspace
      ? await getIntConfig(STARTING_GRANT_KEY)
      : 0;

    await prisma.$transaction([
      prisma.recruiterProfile.update({
        where: { id: subject.profileId },
        data: { setupStep: "COMPLETE", setupCompletedAt: new Date() },
        select: { id: true },
      }),
      ...recruiterIdentityWrites(prisma, {
        userId: subject.userId,
        company: profile.company,
        organizationId,
        needsRoleAssignment: !liveRoleAssignments.some(
          (row) => row.scopeId === organizationId,
        ),
      }),
      // Funding a brand-new workspace, in the same commit that creates it.
      //
      // The general grant primitive reads a balance before it writes, which a
      // batched transaction cannot do. It does not have to here: a workspace
      // that did not exist a moment ago has no account and no ledger, so the
      // movement is known in full before the batch is sent — from zero, to the
      // configured starting grant. The account row is *created*, never updated,
      // so a re-run finds it present, changes nothing, and the ledger insert is
      // skipped as a duplicate. Cache and ledger cannot disagree.
      //
      // A grant configured to zero writes nothing at all, matching the general
      // primitive — an append-only ledger should not carry rows that say
      // nothing happened.
      //
      // Any workspace that already existed takes the general path below.
      ...(isNewWorkspace && startingGrant > 0
        ? [
            prisma.creditAccount.create({
              data: {
                organizationId,
                balance: startingGrant,
                lifetimeEarned: startingGrant,
                version: 1,
                reconciledAt: new Date(),
              },
              select: { id: true },
            }),
            prisma.creditTransaction.createMany({
              data: [
                {
                  organizationId,
                  recruiterUserId: subject.userId,
                  amount: startingGrant,
                  type: "GRANT_ONBOARDING",
                  balanceBefore: 0,
                  balanceAfter: startingGrant,
                  sourceType: "ORGANIZATION",
                  sourceId: organizationId,
                  idempotencyKey: onboardingGrantKey(organizationId),
                  reason: "Starting credits for a new recruiter workspace",
                  metadata: {
                    configKey: STARTING_GRANT_KEY,
                    configValue: startingGrant,
                  },
                },
              ],
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    if (!isNewWorkspace) {
      // The workspace predates this completion — an admin-approved recruiter
      // finishing the wizard, or a re-run. The balance is not knowable ahead of
      // time, so this takes the general primitive, which is idempotent and owns
      // its own transaction. Setup has already committed; a failure here leaves
      // a working workspace that the backfill script grants.
      try {
        await grantOnboardingCreditsAtomic({
          organizationId,
          recruiterUserId: subject.userId,
        });
      } catch (error) {
        logger.error("[recruiter-setup] starting credits not granted", {
          organizationId,
          error: String(error),
        });
      }
    }

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
