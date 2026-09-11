"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlatformRole, RoleScopeType } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

type ActionResult = { ok: true } | { ok: false; message: string };

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

    const existing = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: user.id,
        role: PlatformRole.ADMIN,
        scopeType: RoleScopeType.GLOBAL,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, message: "That account is already a Platform Admin." };
    }

    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        role: PlatformRole.ADMIN,
        scopeType: RoleScopeType.GLOBAL,
        grantedByUserId: admin.userId,
      },
      select: { id: true },
    });

    revalidatePath("/admin/platform-admins");
    return { ok: true };
  } catch (error) {
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
    const row = await prisma.userRoleAssignment.findFirst({
      where: {
        id: parsed.data.assignmentId,
        role: PlatformRole.ADMIN,
        scopeType: RoleScopeType.GLOBAL,
        revokedAt: null,
      },
      select: { id: true, userId: true },
    });
    if (!row) {
      return { ok: false, message: "Admin assignment not found." };
    }

    const activeCount = await prisma.userRoleAssignment.count({
      where: {
        role: PlatformRole.ADMIN,
        scopeType: RoleScopeType.GLOBAL,
        revokedAt: null,
      },
    });
    if (activeCount <= 1) {
      return {
        ok: false,
        message: "Cannot revoke the last Platform Admin.",
      };
    }

    await prisma.userRoleAssignment.update({
      where: { id: row.id },
      data: {
        revokedAt: new Date(),
        revokedReason: parsed.data.reason,
      },
      select: { id: true },
    });

    logger.info("[admin] revoked platform admin", {
      actorUserId: admin.userId,
      targetUserId: row.userId,
    });

    revalidatePath("/admin/platform-admins");
    return { ok: true };
  } catch (error) {
    logger.error("[admin] revokePlatformAdminAction", { error: String(error) });
    return { ok: false, message: "Could not revoke admin access." };
  }
}
