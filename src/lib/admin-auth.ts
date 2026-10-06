import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPlatformAdmin } from "@/lib/platform-role";

/**
 * Platform admin access is a database role: a live, global, unrevoked
 * `UserRoleAssignment`. There is exactly one authority, and this is it.
 *
 * `ADMIN_EMAILS` is **seed-time only** — consumed by
 * `prisma/scripts/seed-admin.ts` to create the first grant in a fresh
 * environment. Nothing at runtime grants from it. Adding an admin to a deployed
 * environment is `/admin/platform-admins`, not an env change; revoking is the
 * same page, which sets `revokedAt` and invalidates their sessions.
 *
 * Plan 169 removed the runtime bootstrap that used to live here. See
 * `lib/platform-role.ts` for why it was a privilege-escalation path.
 */

export { hasPlatformAdmin };

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/**
 * Is this address in the seed list? Does NOT mean "is an admin" — it answers a
 * question about configuration, not about access. Authorization is
 * `hasPlatformAdmin`.
 */
export async function isAdminEmail(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
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
