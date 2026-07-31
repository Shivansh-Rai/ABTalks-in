import "server-only";
import { randomInt } from "node:crypto";
import type { CertificateType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CERTIFICATE_TYPES, CERT_ID_ALPHABET, CERT_ID_LENGTH } from "./constants";

function randomSuffix(): string {
  let suffix = "";
  for (let i = 0; i < CERT_ID_LENGTH; i += 1) {
    suffix += CERT_ID_ALPHABET[randomInt(0, CERT_ID_ALPHABET.length)];
  }
  return suffix;
}

export async function generateCertificateId(type: CertificateType): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const certificateId = `ABT-${CERTIFICATE_TYPES[type].code}-${randomSuffix()}`;
    const existing = await prisma.certificate.findUnique({
      where: { certificateId },
      select: { id: true },
    });
    if (!existing) return certificateId;
  }

  logger.error("Could not allocate a unique certificate ID after 6 attempts", {
    type,
  });
  throw new Error("Could not allocate a unique certificate ID");
}
