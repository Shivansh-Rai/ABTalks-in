import "server-only";

import { PlatformRole, RoleScopeType, type Prisma } from "@prisma/client";
import { writeAudit } from "@/features/admin/audit";

type Tx = Prisma.TransactionClient;

export class DeleteOwnAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeleteOwnAccountError";
  }
}

export async function deleteOwnCandidateAccount(
  tx: Tx,
  input: { userId: string },
): Promise<void> {
  const { userId } = input;

  const adminRow = await tx.userRoleAssignment.findFirst({
    where: {
      userId,
      role: PlatformRole.ADMIN,
      scopeType: RoleScopeType.GLOBAL,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (adminRow) {
    throw new DeleteOwnAccountError("Platform admin accounts cannot be deleted here.");
  }

  const recruiter = await tx.recruiterProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (recruiter) {
    throw new DeleteOwnAccountError(
      "Recruiter accounts cannot be deleted from this screen.",
    );
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      deletedAt: true,
      password: true,
    },
  });
  if (!user) {
    throw new DeleteOwnAccountError("User not found");
  }
  if (user.deletedAt) {
    throw new DeleteOwnAccountError("This account is already deleted.");
  }

  const emailDomain = user.email.includes("@")
    ? (user.email.split("@")[1] ?? null)
    : null;

  await writeAudit(tx, {
    actorUserId: userId,
    adminUserId: null,
    targetUserId: userId,
    entityType: "User",
    entityId: userId,
    actionType: "ACCOUNT_SELF_DELETE",
    reason: "Candidate requested account deletion",
    previousState: {
      emailDomain,
      role: user.role,
      hadPassword: Boolean(user.password),
    },
    newState: { deleted: true },
  });

  await tx.creditTransaction.updateMany({
    where: { candidateUserId: userId },
    data: { candidateUserId: null },
  });
  await tx.talentEngagementRequest.updateMany({
    where: { candidateUserId: userId },
    data: { candidateUserId: null },
  });

  await tx.user.delete({ where: { id: userId } });
}
