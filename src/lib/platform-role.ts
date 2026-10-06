import "server-only";
import { PlatformRole, RoleScopeType } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Plan 169. Lives apart from `lib/admin-auth.ts` purely to break an import
 * cycle: `admin-auth.ts` imports `@/auth` for `requireAdmin`, and `auth.ts`
 * needs this lookup to stamp `token.isAdmin` at sign-in. This file imports only
 * `@/lib/db` and `@prisma/client`, so either side can take it.
 *
 * NOT edge-safe — it reaches Prisma. `auth.config.ts` and `middleware.ts` must
 * never import it.
 */

/**
 * Does this account hold platform admin right now?
 *
 * A live, global, unrevoked `UserRoleAssignment` and nothing else. This is a
 * pure read: it never writes, and it never consults `ADMIN_EMAILS`.
 *
 * Plan 169 removed the env bootstrap that used to run from here. It granted
 * `GLOBAL`/`ADMIN` to any account whose email was in `ADMIN_EMAILS` and had
 * never held the grant — but "had never held it" was a count of that
 * **userId**'s rows, and `UserRoleAssignment.userId` cascades on user delete.
 * Deleting an admin's `User` row therefore destroyed the only record that env
 * had already been honoured, so the next sign-in minted a new userId with no
 * history and the grant came back. The same count filtered `role = ADMIN`, so
 * a row edited to `CANDIDATE` also read as "never granted" and was re-granted.
 *
 * `ADMIN_EMAILS` is now seed-time only; see `prisma/scripts/seed-admin.ts`.
 * In a deployed environment admins are added at `/admin/platform-admins`.
 */
export async function hasPlatformAdmin(userId: string): Promise<boolean> {
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
