import "server-only";
import { CertificateStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateIST } from "@/lib/date-utils";
import { certificateIdSchema } from "@/lib/validations/certificate";
import {
  CERTIFICATE_TYPES,
  certificateDomainLabel,
} from "./constants";

export type PublicCertificateView = {
  certificateId: string;
  recipientName: string;
  title: string;
  subtitle: string;
  domainLabel: string;
  issuedOn: string;
  daysCompleted: number | null;
  longestStreak: number | null;
  isRevoked: boolean;
};

export async function getPublicCertificate(
  rawId: string,
): Promise<PublicCertificateView | null> {
  const parsed = certificateIdSchema.safeParse(rawId);
  if (!parsed.success) return null;

  const cert = await prisma.certificate.findUnique({
    where: { certificateId: parsed.data },
    select: {
      certificateId: true,
      recipientName: true,
      type: true,
      status: true,
      domain: true,
      issuedAt: true,
      metadata: true,
    },
  });

  if (!cert) return null;

  const meta =
    cert.metadata !== null &&
    typeof cert.metadata === "object" &&
    !Array.isArray(cert.metadata)
      ? (cert.metadata as Record<string, unknown>)
      : {};
  const daysCompleted =
    typeof meta.daysCompleted === "number" ? meta.daysCompleted : null;
  const longestStreak =
    typeof meta.longestStreak === "number" ? meta.longestStreak : null;
  const typeConfig = CERTIFICATE_TYPES[cert.type];

  return {
    certificateId: cert.certificateId,
    recipientName: cert.recipientName,
    title: typeConfig.title,
    subtitle: typeConfig.subtitle,
    domainLabel: certificateDomainLabel(cert.domain),
    issuedOn: formatDateIST(cert.issuedAt),
    daysCompleted,
    longestStreak,
    isRevoked: cert.status === CertificateStatus.REVOKED,
  };
}
