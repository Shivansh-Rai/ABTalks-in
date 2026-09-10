import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PlatformRole, RoleScopeType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/** Env list is bootstrap-only. Live access is UserRoleAssignment. */
export async function isAdminEmail(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export async function hasPlatformAdmin(userId: string): Promise<boolean> {
  await bootstrapAdminsFromEnv();
  const row = await prisma.userRoleAssignment.findFirst({
    where: {
      userId,
      role: PlatformRole.ADMIN,
      scopeType: RoleScopeType.GLOBAL,
      revokedAt: null,
    },
    select: { id: true },
  });
  return row !== null;
}

/**
 * First-admin chicken-and-egg: if nobody has an active GLOBAL ADMIN row,
 * copy ADMIN_EMAILS onto matching User rows. After that, env is ignored.
 * A revoked admin is never re-granted from env.
 */
async function bootstrapAdminsFromEnv(): Promise<void> {
  const emails = getAdminEmails();
  if (emails.length === 0) return;

  const active = await prisma.userRoleAssignment.count({
    where: {
      role: PlatformRole.ADMIN,
      scopeType: RoleScopeType.GLOBAL,
      revokedAt: null,
    },
  });
  if (active > 0) return;

  const users = await prisma.user.findMany({
    where: {
      OR: emails.map((email) => ({
        email: { equals: email, mode: "insensitive" as const },
      })),
    },
    select: { id: true, email: true },
  });
  if (users.length === 0) return;

  try {
    await prisma.userRoleAssignment.createMany({
      data: users.map((u) => ({
        userId: u.id,
        role: PlatformRole.ADMIN,
        scopeType: RoleScopeType.GLOBAL,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    logger.error("[admin-auth] bootstrapAdminsFromEnv", {
      error: String(error),
    });
  }
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");

  const isAdmin = await hasPlatformAdmin(session.user.id);
  if (!isAdmin) redirect("/dashboard");

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

export async function getAdminContext() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;

  const isAdmin = await hasPlatformAdmin(session.user.id);
  if (!isAdmin) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
