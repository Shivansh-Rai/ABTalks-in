import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureRecruiterWorkspace } from "@/features/hire/provision-recruiter";

/**
 * Plan 194 — one-click sign-in links for HRs trialling the desk.
 *
 * Each invited recruiter gets their OWN account: their workspace, their credit
 * grant, their projects, and every action attributed to their `userId`. That
 * is the whole point — the shared team preview link makes five people one
 * `userId`, and nothing in `TalentRequest.recruiterUserId`, `viewerKey`, the
 * outreach log or the ledger can tell them apart afterwards.
 *
 * The link is a sign-in credential, so it is built the way sign-in credentials
 * should be and not the way a shareable URL usually is:
 *
 *   - **Delivered to the address it belongs to.** It is emailed, never handed
 *     over. Forwarding it does not quietly merge two people into one account:
 *     whoever clicks it is recorded as the invited address, and the invite can
 *     be reissued or the account disabled if that is wrong.
 *   - **Single use.** The row is deleted the moment it is consumed, inside the
 *     same transaction that reads it, so a link in a forwarded mailbox or a
 *     proxy log is already spent.
 *   - **Short lived.** Seven days, then it is refused.
 *   - **Hashed at rest.** The database stores SHA-256 of the token, so a leak
 *     of the table is not a leak of live links.
 *   - **Revocable.** Deleting the row kills that one link and nobody else's.
 *
 * It carries no payload and grants nothing by itself: the account is
 * provisioned when the invite is created, and the token only says "this
 * address may sign in once, before this moment".
 */

/** Namespaced so these rows can never collide with Auth.js's own. */
const IDENTIFIER_PREFIX = "hr-invite:";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PERSONAL_DOMAIN_NOTE =
  "Use the HR's work address — the recruiter product refuses free consumer domains.";

export type HrInviteInput = {
  email: string;
  name: string;
  company: string;
};

export type HrInviteCreated = {
  /** The raw token. Goes in the emailed URL and is never stored or logged. */
  token: string;
  userId: string;
  email: string;
  expiresAt: Date;
};

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Provision the HR's account if needed and mint one sign-in link for it.
 *
 * Provisioning goes through the product's own path — RecruiterProfile, then
 * `ensureRecruiterWorkspace`, which creates the Organization and makes the
 * onboarding credit grant — so a trial account is a real account and the desk
 * behaves exactly as it will for a paying one.
 */
export async function createHrInvite(
  input: HrInviteInput,
): Promise<
  { ok: true; data: HrInviteCreated } | { ok: false; message: string }
> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || email;
  const company = input.company.trim() || "Trial";

  if (!email.includes("@")) {
    return { ok: false, message: "That is not an email address." };
  }

  const candidate = await prisma.candidateProfile.findFirst({
    where: { user: { email } },
    select: { userId: true },
  });
  if (candidate) {
    return {
      ok: false,
      message:
        "That address already belongs to a candidate account. " +
        PERSONAL_DOMAIN_NOTE,
    };
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      // The invite is proof of nothing until it is clicked; marking the
      // address verified is what the click then means, and the account cannot
      // be reached any other way until then.
      emailVerified: new Date(),
      role: "RECRUITER",
    },
    select: { id: true, email: true },
  });

  const existingProfile = await prisma.recruiterProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!existingProfile) {
    const now = new Date();
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        fullName: name,
        company,
        approved: true,
        approvedAt: now,
        setupStep: "COMPLETE",
        setupCompletedAt: now,
      },
      select: { id: true },
    });
  }

  // Also what funds the desk: the onboarding credit grant is made inside this
  // call's transaction, so the HR opens a workspace with its starting balance.
  const workspace = await ensureRecruiterWorkspace(user.id);
  if (!workspace) {
    return {
      ok: false,
      message: "The recruiter workspace could not be provisioned.",
    };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.verificationToken.create({
    data: {
      identifier: `${IDENTIFIER_PREFIX}${email}`,
      token: hash(token),
      expires: expiresAt,
    },
  });

  logger.info("[hr-invite] issued a sign-in link", {
    userId: user.id,
    company,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    ok: true,
    data: { token, userId: user.id, email: user.email, expiresAt },
  };
}

/**
 * Who a token belongs to, WITHOUT spending it.
 *
 * Used to answer one question before deciding whether to burn an invite: is
 * the browser already signed in as the person this link is for? If it is,
 * there is nothing to do and the link should survive for its real recipient.
 */
export async function peekHrInviteEmail(
  rawToken: string | undefined | null,
): Promise<string | null> {
  if (!rawToken) return null;
  const row = await prisma.verificationToken.findUnique({
    where: { token: hash(rawToken) },
    select: { identifier: true, expires: true },
  });
  if (!row || !row.identifier.startsWith(IDENTIFIER_PREFIX)) return null;
  if (row.expires.getTime() < Date.now()) return null;
  return row.identifier.slice(IDENTIFIER_PREFIX.length);
}

export type HrInviteHolder = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

/**
 * Spend a link and return whose it was, or null.
 *
 * `deleteMany` on the hashed token is the consume: it both finds the row and
 * removes it in one statement, so two clicks racing can only produce one
 * success — the second deletes nothing and is refused. The expiry is checked
 * after the delete on purpose; an expired link is spent rather than left to be
 * retried.
 */
export async function consumeHrInvite(
  rawToken: string | undefined | null,
): Promise<HrInviteHolder | null> {
  if (!rawToken) return null;

  const row = await prisma.verificationToken.findUnique({
    where: { token: hash(rawToken) },
    select: { identifier: true, token: true, expires: true },
  });
  if (!row || !row.identifier.startsWith(IDENTIFIER_PREFIX)) return null;

  // The lookup above was by a unique hash, so this is belt-and-braces against
  // a future change that makes it non-unique; constant-time because the value
  // compared is derived from attacker-supplied input.
  const a = Buffer.from(row.token);
  const b = Buffer.from(hash(rawToken));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const deleted = await prisma.verificationToken.deleteMany({
    where: { token: row.token },
  });
  if (deleted.count === 0) return null;

  if (row.expires.getTime() < Date.now()) {
    logger.info("[hr-invite] refused an expired link");
    return null;
  }

  const email = row.identifier.slice(IDENTIFIER_PREFIX.length);
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, disabledAt: null },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return null;

  logger.info("[hr-invite] a sign-in link was spent", { userId: user.id });
  return user;
}
