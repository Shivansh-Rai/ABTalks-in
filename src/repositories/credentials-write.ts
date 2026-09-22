import "server-only";
import { randomInt } from "node:crypto";
import {
  CertificateStatus,
  CertificateType,
  CredentialSourceType,
  CredentialStatus,
  CredentialType,
  Domain,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma, writeClient } from "@/lib/db";
import { isLegacyCertificateMirrorEnabled } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import {
  CERT_ID_ALPHABET,
  CERT_ID_LENGTH,
  CERTIFICATE_TYPES,
  type HackathonCertificateVariant,
} from "@/features/certificate/constants";
import { mapCertificateToCredential } from "@/repositories/dual-write";
import { peIdForEnrollment } from "@/repositories/ids";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient;

const TX_OPTS = { maxWait: 10000, timeout: 20000 } as const;

export type IssueCredentialResult =
  | {
      ok: true;
      data: { certificateId: string; alreadyIssued: boolean };
      mirrorFailed: boolean;
    }
  | { ok: false; message: string };

export type ClaudeIssueInput = {
  kind: "claude";
  userId: string;
  enrollmentId: string;
  recipientName: string;
  issuedAt: Date;
  metadata: Prisma.InputJsonValue;
  domain: Domain;
};

export type HackathonParticipationIssueInput = {
  kind: "hackathon_participation";
  userId: string;
  recipientName: string;
  issuedAt: Date;
  metadata: Prisma.InputJsonValue;
  eventKey: string;
  teamId: string;
};

export type HackathonPlacementIssueInput = {
  kind: "hackathon_placement";
  userId: string;
  recipientName: string;
  issuedAt: Date;
  metadata: Prisma.InputJsonValue;
  eventKey: string;
  teamId: string;
  variant: HackathonCertificateVariant;
};

export type ApplyCredentialIssueInput =
  | ClaudeIssueInput
  | HackathonParticipationIssueInput
  | HackathonPlacementIssueInput;

function randomSuffix(): string {
  let suffix = "";
  for (let i = 0; i < CERT_ID_LENGTH; i += 1) {
    suffix += CERT_ID_ALPHABET[randomInt(0, CERT_ID_ALPHABET.length)];
  }
  return suffix;
}

export function claudeSourceKey(enrollmentId: string): string {
  return peIdForEnrollment(enrollmentId);
}

export function hackathonParticipationSourceKey(
  eventKey: string,
  teamId: string,
  userId: string,
): string {
  return `${eventKey}:${teamId}:${userId}:participation`;
}

export function hackathonPlacementSourceKey(
  eventKey: string,
  teamId: string,
  userId: string,
  variant: HackathonCertificateVariant,
): string {
  return `${eventKey}:${teamId}:${userId}:${variant}`;
}

function identityOf(input: ApplyCredentialIssueInput): {
  certificateType: CertificateType;
  credentialType: CredentialType;
  sourceType: CredentialSourceType;
  sourceKey: string;
  domain: Domain | null;
  enrollmentId: string | null;
} {
  if (input.kind === "claude") {
    return {
      certificateType: CertificateType.CLAUDE_CHALLENGE,
      credentialType: CredentialType.COMPLETION,
      sourceType: CredentialSourceType.PROGRAM_ENROLLMENT,
      sourceKey: claudeSourceKey(input.enrollmentId),
      domain: input.domain,
      enrollmentId: input.enrollmentId,
    };
  }
  if (input.kind === "hackathon_participation") {
    return {
      certificateType: CertificateType.HACKATHON,
      credentialType: CredentialType.PARTICIPATION,
      sourceType: CredentialSourceType.HACKATHON_TEAM,
      sourceKey: hackathonParticipationSourceKey(
        input.eventKey,
        input.teamId,
        input.userId,
      ),
      domain: null,
      enrollmentId: null,
    };
  }
  return {
    certificateType: CertificateType.HACKATHON,
    credentialType: CredentialType.PLACEMENT,
    sourceType: CredentialSourceType.HACKATHON_TEAM,
    sourceKey: hackathonPlacementSourceKey(
      input.eventKey,
      input.teamId,
      input.userId,
      input.variant,
    ),
    domain: null,
    enrollmentId: null,
  };
}

function isUniqueConflict(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function metadataVariant(metadata: unknown): string | undefined {
  if (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "hackathonVariant" in metadata
  ) {
    const value = (metadata as { hackathonVariant?: unknown }).hackathonVariant;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

function shouldInjectLegacyMirrorFailure(): boolean {
  return process.env.CERTIFICATE_FAIL_LEGACY_MIRROR === "true";
}

/**
 * One public ABT-XX-XXXXX id, unique across Credential and Certificate.
 * Format is unchanged from generateCertificateId.
 */
export async function generatePublicCredentialId(
  type: CertificateType,
  db: Db | Tx = prisma,
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const publicId = `ABT-${CERTIFICATE_TYPES[type].code}-${randomSuffix()}`;
    const [cert, cred] = await Promise.all([
      db.certificate.findUnique({
        where: { certificateId: publicId },
        select: { id: true },
      }),
      db.credential.findUnique({
        where: { credentialId: publicId },
        select: { id: true },
      }),
    ]);
    if (!cert && !cred) return publicId;
  }

  logger.error("Could not allocate a unique credential ID after 6 attempts", {
    type,
  });
  throw new Error("Could not allocate a unique certificate ID");
}

async function findCredentialBySource(
  db: Db | Tx,
  ident: ReturnType<typeof identityOf>,
): Promise<{ credentialId: string } | null> {
  return db.credential.findUnique({
    where: {
      type_sourceType_sourceKey: {
        type: ident.credentialType,
        sourceType: ident.sourceType,
        sourceKey: ident.sourceKey,
      },
    },
    select: { credentialId: true },
  });
}

async function findLegacyCertificate(
  db: Db | Tx,
  input: ApplyCredentialIssueInput,
): Promise<{ certificateId: string } | null> {
  if (input.kind === "claude") {
    return db.certificate.findUnique({
      where: { enrollmentId: input.enrollmentId },
      select: { certificateId: true },
    });
  }

  const rows = await db.certificate.findMany({
    where: { userId: input.userId, type: CertificateType.HACKATHON },
    select: { certificateId: true, metadata: true },
  });

  if (input.kind === "hackathon_placement") {
    const existing = rows.find(
      (row) => metadataVariant(row.metadata) === input.variant,
    );
    return existing ? { certificateId: existing.certificateId } : null;
  }

  const participation = rows.find(
    (row) => metadataVariant(row.metadata) === undefined,
  );
  return participation
    ? { certificateId: participation.certificateId }
    : null;
}

async function mirrorLegacyCertificate(
  db: Db | Tx,
  input: ApplyCredentialIssueInput,
  ident: ReturnType<typeof identityOf>,
  publicId: string,
): Promise<void> {
  if (!isLegacyCertificateMirrorEnabled()) return;
  if (shouldInjectLegacyMirrorFailure()) {
    throw new Error("CERTIFICATE_FAIL_LEGACY_MIRROR");
  }

  const byPublic = await db.certificate.findUnique({
    where: { certificateId: publicId },
    select: { certificateId: true },
  });
  if (byPublic) return;

  if (ident.enrollmentId) {
    const byEnrollment = await db.certificate.findUnique({
      where: { enrollmentId: ident.enrollmentId },
      select: { certificateId: true },
    });
    if (byEnrollment) {
      if (byEnrollment.certificateId !== publicId) {
        logger.error(
          "[credential] legacy certificate public id differs; new credential kept",
          {
            userId: input.userId,
            credentialId: publicId,
            certificateId: byEnrollment.certificateId,
          },
        );
      }
      return;
    }
  }

  await db.certificate.create({
    data: {
      certificateId: publicId,
      userId: input.userId,
      type: ident.certificateType,
      status: CertificateStatus.ISSUED,
      recipientName: input.recipientName,
      domain: ident.domain,
      enrollmentId: ident.enrollmentId,
      issuedAt: input.issuedAt,
      metadata: input.metadata,
    },
    select: { certificateId: true },
  });
}

async function flushCertificateMirror(
  db: Db,
  input: ApplyCredentialIssueInput,
  ident: ReturnType<typeof identityOf>,
  publicId: string,
): Promise<boolean> {
  try {
    await db.$transaction(
      async (tx) => {
        await mirrorLegacyCertificate(tx, input, ident, publicId);
      },
      TX_OPTS,
    );
    return false;
  } catch (err) {
    logger.error(
      "[credential] legacy certificate mirror failed; new credential kept",
      {
        userId: input.userId,
        credentialId: publicId,
        sourceKey: ident.sourceKey,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      },
    );
    return true;
  }
}

async function catchUpCredentialFromCertificate(
  db: Db,
  certificateId: string,
): Promise<void> {
  await db.$transaction(
    async (tx) => {
      const cert = await tx.certificate.findUnique({
        where: { certificateId },
        select: {
          id: true,
          certificateId: true,
          userId: true,
          type: true,
          status: true,
          recipientName: true,
          enrollmentId: true,
          issuedAt: true,
          revokedAt: true,
          revokedReason: true,
          metadata: true,
        },
      });
      if (!cert) {
        throw new Error(`Missing Certificate ${certificateId}`);
      }
      const row = mapCertificateToCredential(cert);
      await tx.credential.upsert({
        where: { credentialId: row.credentialId },
        create: row,
        update: {
          status: row.status,
          recipientName: row.recipientName,
          metadata: row.metadata,
          revokedAt: row.revokedAt,
          revokedReason: row.revokedReason,
        },
      });
    },
    TX_OPTS,
  );
}

async function issueNewAuthoritative(
  db: Db,
  input: ApplyCredentialIssueInput,
  ident: ReturnType<typeof identityOf>,
): Promise<IssueCredentialResult> {
  const existingCred = await findCredentialBySource(db, ident);
  if (existingCred) {
    const mirrorFailed = await flushCertificateMirror(
      db,
      input,
      ident,
      existingCred.credentialId,
    );
    return {
      ok: true,
      data: {
        certificateId: existingCred.credentialId,
        alreadyIssued: true,
      },
      mirrorFailed,
    };
  }

  const existingCert = await findLegacyCertificate(db, input);
  if (existingCert) {
    await catchUpCredentialFromCertificate(db, existingCert.certificateId);
    return {
      ok: true,
      data: { certificateId: existingCert.certificateId, alreadyIssued: true },
      mirrorFailed: false,
    };
  }

  try {
    const publicId = await generatePublicCredentialId(
      ident.certificateType,
      db,
    );
    await db.$transaction(async (tx) => {
      await tx.credential.create({
        data: {
          credentialId: publicId,
          userId: input.userId,
          type: ident.credentialType,
          sourceType: ident.sourceType,
          sourceKey: ident.sourceKey,
          status: CredentialStatus.ISSUED,
          title: ident.certificateType,
          recipientName: input.recipientName,
          metadata: input.metadata,
          issuedAt: input.issuedAt,
        },
        select: { credentialId: true },
      });
    }, TX_OPTS);

    const mirrorFailed = await flushCertificateMirror(
      db,
      input,
      ident,
      publicId,
    );
    return {
      ok: true,
      data: { certificateId: publicId, alreadyIssued: false },
      mirrorFailed,
    };
  } catch (error) {
    if (isUniqueConflict(error)) {
      const raced = await findCredentialBySource(db, ident);
      if (raced) {
        const mirrorFailed = await flushCertificateMirror(
          db,
          input,
          ident,
          raced.credentialId,
        );
        return {
          ok: true,
          data: {
            certificateId: raced.credentialId,
            alreadyIssued: true,
          },
          mirrorFailed,
        };
      }
      const racedCert = await findLegacyCertificate(db, input);
      if (racedCert) {
        await catchUpCredentialFromCertificate(db, racedCert.certificateId);
        return {
          ok: true,
          data: {
            certificateId: racedCert.certificateId,
            alreadyIssued: true,
          },
          mirrorFailed: false,
        };
      }
    }
    logger.error("Could not issue certificate", {
      userId: input.userId,
      kind: input.kind,
      error: String(error),
    });
    return { ok: false, message: "Could not issue certificate" };
  }
}

/**
 * Sole certificate/credential issuance writer.
 *
 * Credential is always canonical (Phase 8-D). ENABLE_NEW_CREDENTIAL_WRITES is
 * ignored: frozen Certificate must not become issuance authority.
 * Certificate remains a compatibility mirror while ENABLE_LEGACY_CERTIFICATE_MIRROR
 * is not `"false"`, plus historical provenance for existing rows.
 */
export async function applyCredentialIssue(
  db: Db,
  input: ApplyCredentialIssueInput,
): Promise<IssueCredentialResult> {
  return issueNewAuthoritative(db, input, identityOf(input));
}

export async function issueClaudeCredential(
  input: Omit<ClaudeIssueInput, "kind">,
): Promise<IssueCredentialResult> {
  return applyCredentialIssue(writeClient(), { kind: "claude", ...input });
}

export async function issueHackathonParticipationCredential(
  input: Omit<HackathonParticipationIssueInput, "kind">,
): Promise<IssueCredentialResult> {
  return applyCredentialIssue(writeClient(), {
    kind: "hackathon_participation",
    ...input,
  });
}

export async function issueHackathonPlacementCredential(
  input: Omit<HackathonPlacementIssueInput, "kind">,
): Promise<IssueCredentialResult> {
  return applyCredentialIssue(writeClient(), {
    kind: "hackathon_placement",
    ...input,
  });
}
