import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { PreviewSide } from "@/lib/feature-flags";
import { ensureRecruiterWorkspace } from "@/features/hire/provision-recruiter";

/**
 * Plan 193, TEMPORARY — the two accounts a preview link signs you in as.
 *
 * Dedicated addresses, never a real person's: a link that authenticates must
 * not hand its holder somebody's actual account. A work domain on purpose —
 * `registerRecruiter` refuses personal domains, and the preview recruiter
 * should not be the one exception to a rule the product enforces on everyone
 * else.
 *
 * Both are provisioned on first use and reused after, so nothing has to be
 * seeded by hand against production.
 */
export const PREVIEW_EMAIL: Record<PreviewSide, string> = {
  candidate: "preview-candidate@klymb.ai",
  recruiter: "preview-recruiter@klymb.ai",
};

const PREVIEW_NAME: Record<PreviewSide, string> = {
  candidate: "Preview Candidate",
  recruiter: "Preview Recruiter",
};

/** Reserved, so it can never collide with a real candidate's code. */
const PREVIEW_REFERRAL_CODE = "PREVIEWCAND";

const PREVIEW_COMPANY = "Klymb AI (preview)";

export type PreviewUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

/**
 * The preview account for a side, created if this is the first use.
 *
 * Idempotent in every step: the User is found by email, each profile is
 * created only when missing, `ensureRecruiterWorkspace` is itself idempotent,
 * and the credit grant carries an `idempotencyKey` per organization — so
 * repeat sign-ins never mint a second account and never top the balance up
 * again.
 *
 * NO admin is granted here, and none should ever be: platform admin is a
 * `UserRoleAssignment` row and the preview link is not an authority that may
 * create one.
 */
export async function ensurePreviewUser(side: PreviewSide): Promise<PreviewUser> {
  const email = PREVIEW_EMAIL[side];
  const name = PREVIEW_NAME[side];

  const user = await prisma.user.upsert({
    where: { email },
    // An existing preview account is left alone — including one an operator
    // has since renamed or adjusted.
    update: {},
    create: {
      email,
      name,
      // The address is ours and never receives mail; marking it verified keeps
      // the account out of the "unverified" paths that would otherwise ask a
      // preview visitor to prove an address they do not own.
      emailVerified: new Date(),
      role: side === "recruiter" ? "RECRUITER" : "STUDENT",
    },
    select: { id: true, email: true, name: true, role: true },
  });

  if (side === "candidate") {
    await ensureCandidateProfile(user.id, name);
  } else {
    await ensureRecruiterAccess(user.id, name);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? name,
    role: user.role,
  };
}

/**
 * Without a CandidateProfile `isCandidateRegistered` is false and /dashboard
 * forwards to /register — so the preview link would open a registration form
 * rather than the product it is meant to show.
 */
async function ensureCandidateProfile(userId: string, fullName: string) {
  const existing = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return;

  await prisma.candidateProfile.create({
    data: { userId, fullName, referralCode: PREVIEW_REFERRAL_CODE },
    select: { id: true },
  });
  logger.info("[preview] provisioned the candidate preview profile", { userId });
}

/**
 * The recruiter side is the one with moving parts: `getRecruiterState` needs a
 * RecruiterProfile to report "active", the desk needs an Organization, and a
 * desk with no balance misrepresents the product — so the account is set up
 * the way a real recruiter's is, through the product's own functions.
 */
async function ensureRecruiterAccess(userId: string, fullName: string) {
  const existing = await prisma.recruiterProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!existing) {
    const now = new Date();
    await prisma.recruiterProfile.create({
      data: {
        userId,
        fullName,
        company: PREVIEW_COMPANY,
        approved: true,
        approvedAt: now,
        setupStep: "COMPLETE",
        setupCompletedAt: now,
      },
      select: { id: true },
    });
    logger.info("[preview] provisioned the recruiter preview profile", { userId });
  }

  // This is also what funds the desk: provisionRecruiterIdentity, inside
  // ensureRecruiterWorkspace's transaction, makes the onboarding credit grant
  // — verified at $200.00 on /hire/credits for a freshly provisioned preview
  // recruiter. No second grant is made here: it would be a no-op reporting
  // `duplicate` on every sign-in, and a log line claiming credit it never
  // granted. Both calls are idempotent, so repeat sign-ins change nothing.
  const workspace = await ensureRecruiterWorkspace(userId);
  if (!workspace) {
    logger.error("[preview] recruiter workspace could not be provisioned", { userId });
  }
}
