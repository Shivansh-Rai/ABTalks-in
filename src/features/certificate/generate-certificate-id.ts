import "server-only";
import type { CertificateType } from "@prisma/client";
import { generatePublicCredentialId } from "@/repositories/credentials-write";

/** Public ABT-XX-XXXXX id. Uniqueness covers Credential and Certificate. */
export async function generateCertificateId(
  type: CertificateType,
): Promise<string> {
  return generatePublicCredentialId(type);
}
