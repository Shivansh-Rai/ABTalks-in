import "server-only";

import { PlatformRole, RoleScopeType, type Prisma } from "@prisma/client";
import { writeAudit } from "@/features/admin/audit";
import { writeClient } from "@/lib/db";

export class AccountOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountOpsError";
  }
}

type Tx = Prisma.TransactionClient;

async function assertMutableTarget(
  tx: Tx,
  input: { targetUserId: string; actorUserId: string },
) {
  if (input.targetUserId === input.actorUserId) {
    throw new AccountOpsError("You cannot change your own account this way");
  }

  const target = await tx.user.findUnique({
    where: { id: input.targetUserId },
    select: {
      id: true,
      deletedAt: true,
      disabledAt: true,
      sessionInvalidatedAt: true,
    },
  });
  if (!target) {
    throw new AccountOpsError("User not found");
  }
  if (target.deletedAt) {
    throw new AccountOpsError("Deleted accounts cannot be changed this way");
  }

  const adminRow = await tx.userRoleAssignment.findFirst({
    where: {
      userId: input.targetUserId,
      role: PlatformRole.ADMIN,
      scopeType: RoleScopeType.GLOBAL,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (adminRow) {
    throw new AccountOpsError("Cannot change a platform admin account");
  }

  return target;
}

export async function disableAccount(input: {
  targetUserId: string;
  actorUserId: string;
  reason: string;
}): Promise<void> {
  await writeClient().$transaction(async (tx) => {
    const target = await assertMutableTarget(tx, input);
    if (target.disabledAt) {
      throw new AccountOpsError("Account is already disabled");
    }

    const now = new Date();
    await tx.user.update({
      where: { id: input.targetUserId },
      data: {
        disabledAt: now,
        disabledReason: input.reason,
        disabledByUserId: input.actorUserId,
        sessionInvalidatedAt: now,
      },
      select: { id: true },
    });

    await writeAudit(tx, {
      actorUserId: input.actorUserId,
      adminUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      entityType: "User",
      entityId: input.targetUserId,
      actionType: "ACCOUNT_DISABLE",
      reason: input.reason,
      previousState: { disabledAt: null },
      newState: { disabledAt: now.toISOString() },
    });
  });
}

export async function restoreAccount(input: {
  targetUserId: string;
  actorUserId: string;
  reason: string;
}): Promise<void> {
  await writeClient().$transaction(async (tx) => {
    const target = await assertMutableTarget(tx, input);
    if (!target.disabledAt) {
      throw new AccountOpsError("Account is not disabled");
    }

    await tx.user.update({
      where: { id: input.targetUserId },
      data: {
        disabledAt: null,
        disabledReason: null,
        disabledByUserId: null,
      },
      select: { id: true },
    });

    await writeAudit(tx, {
      actorUserId: input.actorUserId,
      adminUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      entityType: "User",
      entityId: input.targetUserId,
      actionType: "ACCOUNT_RESTORE",
      reason: input.reason,
      previousState: { disabledAt: target.disabledAt.toISOString() },
      newState: { disabledAt: null },
    });
  });
}

export async function secureAccount(input: {
  targetUserId: string;
  actorUserId: string;
  reason: string;
}): Promise<void> {
  await writeClient().$transaction(async (tx) => {
    const target = await assertMutableTarget(tx, input);
    const now = new Date();
    const previousIso = target.sessionInvalidatedAt
      ? target.sessionInvalidatedAt.toISOString()
      : null;

    await tx.user.update({
      where: { id: input.targetUserId },
      data: { sessionInvalidatedAt: now },
      select: { id: true },
    });

    await writeAudit(tx, {
      actorUserId: input.actorUserId,
      adminUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      entityType: "User",
      entityId: input.targetUserId,
      actionType: "ACCOUNT_SECURE",
      reason: input.reason,
      previousState: { sessionInvalidatedAt: previousIso },
      newState: { sessionInvalidatedAt: now.toISOString() },
    });
  });
}
