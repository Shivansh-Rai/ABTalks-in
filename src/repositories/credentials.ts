import "server-only";
import {
  CredentialSourceType,
  CredentialStatus,
  CredentialType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { enrollmentIdFromPe, peIdForEnrollment } from "@/repositories/ids";
import type { CredentialView } from "@/repositories/types";

export async function getByPublicId(
  credentialId: string,
): Promise<CredentialView | null> {
const row = await prisma.credential.findUnique({
  where: { credentialId },
  select: {
    credentialId: true,
    userId: true,
    type: true,
    title: true,
    recipientName: true,
    status: true,
    issuedAt: true,
    metadata: true,
  },
});
if (!row) return null;
return row;
}

export async function listForUser(userId: string): Promise<CredentialView[]> {
const rows = await prisma.credential.findMany({
  where: { userId },
  orderBy: [{ issuedAt: "desc" }, { credentialId: "asc" }],
  select: {
    credentialId: true,
    userId: true,
    type: true,
    title: true,
    recipientName: true,
    status: true,
    issuedAt: true,
    metadata: true,
  },
});
return rows;
}

/**
 * Challenge enrollments that have an ISSUED COMPLETION credential.
 * Source key is pe_enr_{enrollmentId} (Phase 2g / W3 mapping).
 * Used by `/hire` so recruiter scoring does not join Certificate.
 */
export async function issuedChallengeEnrollmentIds(
  enrollmentIds: string[],
): Promise<Set<string>> {
  if (enrollmentIds.length === 0) return new Set();
  const rows = await prisma.credential.findMany({
    where: {
      type: CredentialType.COMPLETION,
      sourceType: CredentialSourceType.PROGRAM_ENROLLMENT,
      sourceKey: { in: enrollmentIds.map(peIdForEnrollment) },
      status: CredentialStatus.ISSUED,
    },
    select: { sourceKey: true },
  });
  const issued = new Set<string>();
  for (const row of rows) {
    const enrollmentId = enrollmentIdFromPe(row.sourceKey);
    if (enrollmentId) issued.add(enrollmentId);
  }
  return issued;
}
