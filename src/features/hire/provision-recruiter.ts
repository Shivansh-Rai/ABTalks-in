import "server-only";
import type { Prisma } from "@prisma/client";
import { grantOnboardingCredits } from "@/repositories/credits";

/**
 * Give a verified recruiter their 078 identity.
 *
 * `RecruiterProfile` + `User.role` is how the legacy `/talent` portal decides
 * recruiter access, and it stays authoritative — `ENABLE_NEW_*` is off and
 * legacy still serves every read. But 078 models recruiters as
 * `UserRoleAssignment(RECRUITER)` + `Organization` + `OrganizationMember`, and
 * the recruiter product is being built against that. Writing both now means the
 * rows are already correct when authorization moves, instead of needing a
 * backfill for a population that is still small enough to get right for free.
 *
 * **One organization per recruiter (T-226).** This used to slug the org on the
 * company name so that colleagues landed in the same `Organization` and could
 * share talent lists. That is no longer the product: every recruiter works
 * alone, two recruiters on one email domain get separate workspaces, and
 * multi-user company hiring is Phase 2 / Contact Sales. The slug now carries the
 * recruiter's own id, so an `Organization` row means one workspace belonging to
 * one person. The table stays because `TalentList.organizationId` is a required
 * FK and Plan 078 Phase 7 is frozen for September — what changed is what a row
 * means, not the shape of the model. Do not "fix" this back to a company slug.
 *
 * `VerifiedRecruiterSeat` stays, narrowed to what 078 genuinely cannot express:
 * an invite for an email address that has **no `User` row yet**.
 * `OrganizationMember` already models invitations — it has `status: INVITED` and
 * `invitedByUserId` — but its `userId` is a required FK, so it can only invite
 * somebody who has already signed up. The seat covers the step before that, and
 * is spent here.
 *
 * Called inside the caller's transaction. Idempotent: re-provisioning an
 * existing recruiter updates rather than duplicating.
 *
 * **T-228:** creating the workspace also funds it with its starting credits.
 * That is here, and not on a credit read, because this is the one place a
 * recruiter workspace comes into existence.
 */
export async function provisionRecruiterIdentity(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    company: string;
    grantedByUserId?: string | null;
  },
): Promise<{ organizationId: string }> {
  const company = input.company.trim();
  const slug = recruiterWorkspaceSlug(input.userId, company);

  // Find-or-create by slug. The slug is per recruiter, so this only ever
  // matches this recruiter's own workspace — re-provisioning is idempotent and
  // no second person can be routed into it.
  const organization = await tx.organization.upsert({
    where: { slug },
    create: { slug, name: company },
    update: {},
    select: { id: true },
  });

  await tx.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: input.userId,
      },
    },
    create: {
      organizationId: organization.id,
      userId: input.userId,
      role: "RECRUITER",
      status: "ACTIVE",
      invitedByUserId: input.grantedByUserId ?? null,
      joinedAt: new Date(),
    },
    update: { status: "ACTIVE", joinedAt: new Date() },
  });

  // The partial unique index on this table is `(userId, role, scopeType,
  // COALESCE(scopeId,'')) WHERE revokedAt IS NULL`, which Prisma cannot express,
  // so this checks for a live grant rather than upserting on it.
  const live = await tx.userRoleAssignment.findFirst({
    where: {
      userId: input.userId,
      role: "RECRUITER",
      scopeType: "ORGANIZATION",
      scopeId: organization.id,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!live) {
    await tx.userRoleAssignment.create({
      data: {
        userId: input.userId,
        role: "RECRUITER",
        scopeType: "ORGANIZATION",
        scopeId: organization.id,
        grantedByUserId: input.grantedByUserId ?? null,
      },
    });
  }

  // T-228: a workspace is created here, so this is where it is funded.
  //
  // Putting the grant at the point of creation rather than at the point of
  // first read is what keeps credits out of the read path: every recruiter
  // Organization in this codebase comes from this function, so every workspace
  // is funded exactly once, deterministically, by the same act that made it.
  // Exactly-once is the unique index on `idempotencyKey`, not this call site,
  // so re-provisioning an existing recruiter grants nothing a second time.
  await grantOnboardingCredits(tx, {
    organizationId: organization.id,
    recruiterUserId: input.userId,
    createdByUserId: input.grantedByUserId ?? null,
  });

  return { organizationId: organization.id };
}

/**
 * The same identity writes, as a batch.
 *
 * `provisionRecruiterIdentity` above is sequential because it has to be: it
 * resolves the organization before it can reference it. That costs a network
 * round trip per statement, which is fine for an admin approving one
 * application and is not fine for the recruiter sitting in front of the setup
 * wizard — the interactive form took ~8.6s against Neon.
 *
 * This returns the same writes as an array for `prisma.$transaction([…])`: one
 * round trip, one transaction, same atomicity. It can only do that because the
 * caller has already resolved the two things the sequential version discovers
 * as it goes — the organization's id, and whether a live role assignment
 * exists. See `completeRecruiterSetupAction`, which is the only caller.
 *
 * The onboarding grant is deliberately **not** in here. A batched transaction
 * cannot contain a statement whose parameters depend on reading a row in the
 * same batch, and the grant's ledger row needs the balance it produced. The
 * caller funds the workspace separately; see that action for how.
 */
export function recruiterIdentityWrites(
  client: Pick<
    Prisma.TransactionClient,
    "organization" | "organizationMember" | "userRoleAssignment"
  >,
  input: {
    userId: string;
    company: string;
    /** Resolved by the caller: the existing row's id, or one to create with. */
    organizationId: string;
    /** False when the caller already found a live RECRUITER assignment. */
    needsRoleAssignment: boolean;
    grantedByUserId?: string | null;
  },
): Prisma.PrismaPromise<unknown>[] {
  const company = input.company.trim();
  const slug = recruiterWorkspaceSlug(input.userId, company);
  const now = new Date();

  return [
    client.organization.upsert({
      where: { slug },
      create: { id: input.organizationId, slug, name: company },
      update: {},
      select: { id: true },
    }),
    client.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
      create: {
        organizationId: input.organizationId,
        userId: input.userId,
        role: "RECRUITER",
        status: "ACTIVE",
        invitedByUserId: input.grantedByUserId ?? null,
        joinedAt: now,
      },
      update: { status: "ACTIVE", joinedAt: now },
      select: { id: true },
    }),
    ...(input.needsRoleAssignment
      ? [
          client.userRoleAssignment.create({
            data: {
              userId: input.userId,
              role: "RECRUITER",
              scopeType: "ORGANIZATION",
              scopeId: input.organizationId,
              grantedByUserId: input.grantedByUserId ?? null,
            },
            select: { id: true },
          }),
        ]
      : []),
  ];
}

/**
 * Stable slug for one recruiter's own workspace.
 *
 * Readable half from the company so the row is recognisable in the database,
 * unique half from the recruiter's user id so two people at the same company
 * can never collide into one workspace. Stable for a given user: re-running
 * provisioning resolves the same row rather than creating a second one.
 */
export function recruiterWorkspaceSlug(userId: string, company: string): string {
  const base =
    company
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org";
  return `${base}-${userId.slice(-8).toLowerCase()}`;
}
