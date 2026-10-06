"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlatformRole, Prisma, RoleScopeType } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

type ActionResult = { ok: true } | { ok: false; message: string };

/** Rolls the grant transaction back without logging it as a failure. */
class AlreadyAdminError extends Error {}

/** Same, for the two refusals inside the revoke transaction. */
class RevokeRefused extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
  }
}

const grantSchema = z.object({
  email: z.string().trim().email().max(200),
});

const revokeSchema = z.object({
  assignmentId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

export async function grantPlatformAdminAction(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email." };
  }
  const email = parsed.data.email.toLowerCase();

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!user) {
      return { ok: false, message: "No account with that email." };
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.userRoleAssignment.findFirst({
        where: {
          userId: user.id,
          role: PlatformRole.ADMIN,
          scopeType: RoleScopeType.GLOBAL,
          revokedAt: null,
        },
        select: { id: true },
      });
      if (existing) throw new AlreadyAdminError();

      const created = await tx.userRoleAssignment.create({
        data: {
          userId: user.id,
          role: PlatformRole.ADMIN,
          scopeType: RoleScopeType.GLOBAL,
          grantedByUserId: admin.userId,
        },
        select: { id: true },
      });

      await tx.adminAction.create({
        data: {
          actorUserId: admin.userId,
          adminUserId: admin.userId,
          targetUserId: user.id,
          actionType: "PLATFORM_ADMIN_GRANTED",
          entityType: "UserRoleAssignment",
          entityId: created.id,
          newState: { role: "ADMIN", scopeType: "GLOBAL" },
          reason: "Platform admin granted",
        },
        select: { id: true },
      });
    });

    revalidatePath("/admin/platform-admins");
    return { ok: true };
  } catch (error) {
    // The read-then-create above is not the only guard: the partial unique
    // index `role_assignment_active_unique` is, so a concurrent grant loses
    // here rather than producing a second live row. Both arrive as the same
    // answer for the caller.
    if (
      error instanceof AlreadyAdminError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002")
    ) {
      return { ok: false, message: "That account is already a Platform Admin." };
    }
    logger.error("[admin] grantPlatformAdminAction", { error: String(error) });
    return { ok: false, message: "Could not grant admin access." };
  }
}

export async function revokePlatformAdminAction(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "A reason is required." };
  }

  try {
    const targetUserId = await prisma.$transaction(async (tx) => {
      const row = await tx.userRoleAssignment.findFirst({
        where: {
          id: parsed.data.assignmentId,
          role: PlatformRole.ADMIN,
          scopeType: RoleScopeType.GLOBAL,
          revokedAt: null,
        },
        select: { id: true, userId: true },
      });
      if (!row) throw new RevokeRefused("Admin assignment not found.");

      const activeCount = await tx.userRoleAssignment.count({
        where: {
          role: PlatformRole.ADMIN,
          scopeType: RoleScopeType.GLOBAL,
          revokedAt: null,
        },
      });
      if (activeCount <= 1) {
        throw new RevokeRefused("Cannot revoke the last Platform Admin.");
      }

      const revokedAt = new Date();
      await tx.userRoleAssignment.update({
        where: { id: row.id },
        data: { revokedAt, revokedReason: parsed.data.reason },
        select: { id: true },
      });

      // Plan 169. Without this the revoke only lands in the database: the
      // target's existing JWT still carries `isAdmin: true`, so their chrome
      // keeps the Admin button and `/login` keeps bouncing them at `/admin`.
      // `isJwtInvalidated` in `auth.ts`'s session callback turns this into a
      // dead session on their next request, and the token minted after they
      // re-authenticate recomputes `isAdmin` from the grant that is now gone.
      await tx.user.update({
        where: { id: row.userId },
        data: { sessionInvalidatedAt: revokedAt },
        select: { id: true },
      });

      await tx.adminAction.create({
        data: {
          actorUserId: admin.userId,
          adminUserId: admin.userId,
          targetUserId: row.userId,
          actionType: "PLATFORM_ADMIN_REVOKED",
          entityType: "UserRoleAssignment",
          entityId: row.id,
          previousState: { role: "ADMIN", scopeType: "GLOBAL", revokedAt: null },
          newState: { revokedAt: revokedAt.toISOString() },
          metadata: { sessionsInvalidated: true },
          reason: parsed.data.reason,
        },
        select: { id: true },
      });

      return row.userId;
    });

    logger.info("[admin] revoked platform admin", {
      actorUserId: admin.userId,
      targetUserId,
    });

    revalidatePath("/admin/platform-admins");
    return { ok: true };
  } catch (error) {
    if (error instanceof RevokeRefused) {
      return { ok: false, message: error.userMessage };
    }
    logger.error("[admin] revokePlatformAdminAction", { error: String(error) });
    return { ok: false, message: "Could not revoke admin access." };
  }
}
