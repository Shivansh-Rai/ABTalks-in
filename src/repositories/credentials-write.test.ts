/**
 * W3-A Credential write-authority tests.
 * Run: npm run test:078-credential-writes
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CertificateStatus,
  CertificateType,
  CredentialSourceType,
  CredentialStatus,
  CredentialType,
  Domain,
  type PrismaClient,
} from "@prisma/client";
import {
  isLegacyCertificateMirrorEnabled,
  isNewCredentialWritesEnabled,
} from "@/lib/feature-flags";
import {
  applyCredentialIssue,
  claudeSourceKey,
  hackathonParticipationSourceKey,
  hackathonPlacementSourceKey,
} from "@/repositories/credentials-write";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void | Promise<void>) {
  const run = Promise.resolve().then(fn);
  return run.then(
    () => {
      passed++;
      console.log(`  ✓ ${name}`);
    },
    (e: unknown) => {
      failed++;
      console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
    },
  );
}

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

type CertRow = {
  id: string;
  certificateId: string;
  userId: string;
  type: CertificateType;
  status: CertificateStatus;
  recipientName: string;
  domain: Domain | null;
  enrollmentId: string | null;
  issuedAt: Date;
  metadata: unknown;
};

type CredRow = {
  id: string;
  credentialId: string;
  userId: string;
  type: CredentialType;
  sourceType: CredentialSourceType;
  sourceKey: string;
  status: CredentialStatus;
  title: string;
  recipientName: string;
  metadata: unknown;
  issuedAt: Date;
};

function p2002(): Error & { code: string } {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

function makeDb() {
  const certificates: CertRow[] = [];
  const credentials: CredRow[] = [];
  const writes: string[] = [];
  let n = 0;
  const nextId = (p: string) => `${p}_${++n}`;

  const client: {
    $executeRawUnsafe: () => Promise<number>;
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    certificate: object;
    credential: object;
  } = {
    $executeRawUnsafe: async () => 0,
    $transaction: async (fn) => fn(client),
    certificate: {
      findUnique: async ({
        where,
      }: {
        where: { certificateId?: string; enrollmentId?: string; id?: string };
      }) => {
        if (where.certificateId) {
          return certificates.find((c) => c.certificateId === where.certificateId) ?? null;
        }
        if (where.enrollmentId) {
          return certificates.find((c) => c.enrollmentId === where.enrollmentId) ?? null;
        }
        if (where.id) {
          return certificates.find((c) => c.id === where.id) ?? null;
        }
        return null;
      },
      findFirst: async ({
        where,
      }: {
        where: { userId?: string; type?: CertificateType };
      }) => {
        return (
          certificates.find(
            (c) =>
              (where.userId === undefined || c.userId === where.userId) &&
              (where.type === undefined || c.type === where.type),
          ) ?? null
        );
      },
      findMany: async ({
        where,
      }: {
        where: { userId?: string; type?: CertificateType };
      }) => {
        return certificates.filter(
          (c) =>
            (where.userId === undefined || c.userId === where.userId) &&
            (where.type === undefined || c.type === where.type),
        );
      },
      create: async ({ data }: { data: Partial<CertRow> & { certificateId: string; userId: string } }) => {
        if (certificates.some((c) => c.certificateId === data.certificateId)) {
          throw p2002();
        }
        if (
          data.enrollmentId &&
          certificates.some((c) => c.enrollmentId === data.enrollmentId)
        ) {
          throw p2002();
        }
        const row: CertRow = {
          id: nextId("cert"),
          certificateId: data.certificateId,
          userId: data.userId,
          type: data.type ?? CertificateType.CLAUDE_CHALLENGE,
          status: data.status ?? CertificateStatus.ISSUED,
          recipientName: data.recipientName ?? "",
          domain: data.domain ?? null,
          enrollmentId: data.enrollmentId ?? null,
          issuedAt: data.issuedAt ?? new Date(),
          metadata: data.metadata ?? null,
        };
        writes.push("certificate");
        certificates.push(row);
        return row;
      },
    },
    credential: {
      findUnique: async ({
        where,
      }: {
        where: {
          credentialId?: string;
          type_sourceType_sourceKey?: {
            type: CredentialType;
            sourceType: CredentialSourceType;
            sourceKey: string;
          };
        };
      }) => {
        if (where.credentialId) {
          return credentials.find((c) => c.credentialId === where.credentialId) ?? null;
        }
        const key = where.type_sourceType_sourceKey;
        if (key) {
          return (
            credentials.find(
              (c) =>
                c.type === key.type &&
                c.sourceType === key.sourceType &&
                c.sourceKey === key.sourceKey,
            ) ?? null
          );
        }
        return null;
      },
      create: async ({
        data,
      }: {
        data: Partial<CredRow> & { credentialId: string; userId: string };
      }) => {
        if (credentials.some((c) => c.credentialId === data.credentialId)) {
          throw p2002();
        }
        if (
          credentials.some(
            (c) =>
              c.type === data.type &&
              c.sourceType === data.sourceType &&
              c.sourceKey === data.sourceKey,
          )
        ) {
          throw p2002();
        }
        const row: CredRow = {
          id: nextId("cred"),
          credentialId: data.credentialId,
          userId: data.userId,
          type: data.type ?? CredentialType.COMPLETION,
          sourceType: data.sourceType ?? CredentialSourceType.PROGRAM_ENROLLMENT,
          sourceKey: data.sourceKey ?? "",
          status: data.status ?? CredentialStatus.ISSUED,
          title: data.title ?? "",
          recipientName: data.recipientName ?? "",
          metadata: data.metadata ?? null,
          issuedAt: data.issuedAt ?? new Date(),
        };
        writes.push("credential");
        credentials.push(row);
        return row;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { credentialId: string };
        create: Partial<CredRow> & { credentialId: string; userId: string };
        update: Partial<CredRow>;
      }) => {
        const existing = credentials.find(
          (c) => c.credentialId === where.credentialId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: CredRow = {
          id: create.id ?? nextId("cred"),
          credentialId: create.credentialId,
          userId: create.userId,
          type: create.type ?? CredentialType.COMPLETION,
          sourceType: create.sourceType ?? CredentialSourceType.PROGRAM_ENROLLMENT,
          sourceKey: create.sourceKey ?? "",
          status: create.status ?? CredentialStatus.ISSUED,
          title: create.title ?? "",
          recipientName: create.recipientName ?? "",
          metadata: create.metadata ?? null,
          issuedAt: create.issuedAt ?? new Date(),
        };
        writes.push("credential");
        credentials.push(row);
        return row;
      },
    },
  };

  return {
    db: client as unknown as PrismaClient,
    certificates,
    credentials,
    writes,
  };
}

const claudeInput = {
  kind: "claude" as const,
  userId: "u1",
  enrollmentId: "enr_1",
  recipientName: "Aradhya",
  issuedAt: new Date("2026-08-24T17:48:15.389Z"),
  domain: Domain.CLAUDE,
  metadata: { daysCompleted: 56, longestStreak: 12 },
};

const participationInput = {
  kind: "hackathon_participation" as const,
  userId: "u2",
  recipientName: "A",
  issuedAt: new Date("2026-08-14T00:00:00.000Z"),
  eventKey: "vicodathon-2026",
  teamId: "team_9",
  metadata: { teamId: "team_9", event: "vicodathon-2026" },
};

const placementInput = {
  kind: "hackathon_placement" as const,
  userId: "u2",
  recipientName: "A",
  issuedAt: new Date("2026-08-13T18:30:00.000Z"),
  eventKey: "vicodathon-2026",
  teamId: "team_9",
  variant: "winner" as const,
  metadata: {
    teamId: "team_9",
    event: "vicodathon-2026",
    hackathonVariant: "winner",
  },
};

function restoreEnv(
  writes: string | undefined,
  mirror: string | undefined,
  dual: string | undefined,
  fail: string | undefined,
) {
  if (writes === undefined) delete process.env.ENABLE_NEW_CREDENTIAL_WRITES;
  else process.env.ENABLE_NEW_CREDENTIAL_WRITES = writes;
  if (mirror === undefined) delete process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR;
  else process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = mirror;
  if (dual === undefined) delete process.env.ENABLE_DUAL_WRITE;
  else process.env.ENABLE_DUAL_WRITE = dual;
  if (fail === undefined) delete process.env.CERTIFICATE_FAIL_LEGACY_MIRROR;
  else process.env.CERTIFICATE_FAIL_LEGACY_MIRROR = fail;
}

async function main() {
  console.log("\nW3-A credential writes");

  const prevWrites = process.env.ENABLE_NEW_CREDENTIAL_WRITES;
  const prevMirror = process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR;
  const prevDual = process.env.ENABLE_DUAL_WRITE;
  const prevFail = process.env.CERTIFICATE_FAIL_LEGACY_MIRROR;

  await suite("ENABLE_NEW_CREDENTIAL_WRITES defaults off", () => {
    delete process.env.ENABLE_NEW_CREDENTIAL_WRITES;
    assert(isNewCredentialWritesEnabled() === false, "unset is false");
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
    assert(isNewCredentialWritesEnabled() === true, "true is true");
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "false";
    assert(isNewCredentialWritesEnabled() === false, "false is false");
  });

  await suite("ENABLE_LEGACY_CERTIFICATE_MIRROR defaults on", () => {
    delete process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR;
    assert(isLegacyCertificateMirrorEnabled() === true, "unset is true");
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "false";
    assert(isLegacyCertificateMirrorEnabled() === false, "false is false");
  });

  await suite("write flag is not overloaded onto ENABLE_NEW_CREDENTIAL", () => {
    const flags = source("src/lib/feature-flags.ts");
    assert(flags.includes("ENABLE_NEW_CREDENTIAL_WRITES"), "write flag");
    assert(flags.includes("ENABLE_NEW_CREDENTIAL === \"true\""), "read flag stays");
    const write = source("src/repositories/credentials-write.ts");
    assert(write.includes("isNewCredentialWritesEnabled"), "write helper");
    assert(write.includes("isLegacyCertificateMirrorEnabled"), "mirror helper");
    assert(
      write.includes("[credential] legacy certificate mirror failed; new credential kept"),
      "mirror failure log",
    );
    assert(write.includes("CERTIFICATE_FAIL_LEGACY_MIRROR"), "rehearsal inject");
  });

  await suite("id generator checks Credential and Certificate", () => {
    const src = source("src/repositories/credentials-write.ts");
    assert(src.includes("db.certificate.findUnique"), "certificate unique");
    assert(src.includes("db.credential.findUnique"), "credential unique");
    assert(src.includes("ABT-${CERTIFICATE_TYPES[type].code}"), "existing format");
    const gen = source("src/features/certificate/generate-certificate-id.ts");
    assert(gen.includes("generatePublicCredentialId"), "extracted into write boundary");
  });

  await suite("flag OFF: Certificate authoritative, Credential mirrors", async () => {
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "false";
    process.env.ENABLE_DUAL_WRITE = "true";
    delete process.env.CERTIFICATE_FAIL_LEGACY_MIRROR;
    const { db, certificates, credentials, writes } = makeDb();
    const r = await applyCredentialIssue(db, claudeInput);
    assert(r.ok === true, "ok");
    if (!r.ok) return;
    assert(r.data.alreadyIssued === false, "new");
    assert(certificates.length === 1, "one certificate");
    assert(credentials.length === 1, "one credential");
    assert(certificates[0]?.certificateId === r.data.certificateId, "public id");
    assert(credentials[0]?.credentialId === r.data.certificateId, "mirrored public id");
    assert(credentials[0]?.type === CredentialType.COMPLETION, "completion");
    assert(credentials[0]?.sourceKey === claudeSourceKey("enr_1"), "pe_enr");
    assert(writes[0] === "certificate", "certificate first");
    assert(writes.includes("credential"), "credential mirrored");
  });

  await suite("flag ON: Credential authoritative, Certificate mirrors", async () => {
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
    process.env.ENABLE_DUAL_WRITE = "true";
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
    delete process.env.CERTIFICATE_FAIL_LEGACY_MIRROR;
    const { db, certificates, credentials, writes } = makeDb();
    const r = await applyCredentialIssue(db, claudeInput);
    assert(r.ok === true, "ok");
    if (!r.ok) return;
    assert(certificates.length === 1, "one certificate");
    assert(credentials.length === 1, "one credential");
    assert(credentials[0]?.credentialId === certificates[0]?.certificateId, "same public id");
    assert(r.data.certificateId.startsWith("ABT-CC-"), "claude public id");
    assert(writes[0] === "credential", "credential first");
    assert(writes[1] === "certificate", "certificate mirrored");
  });

  await suite("lazy repeated issue: one Credential, one Certificate, same public id", async () => {
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
    process.env.ENABLE_DUAL_WRITE = "true";
    const { db, certificates, credentials } = makeDb();
    const first = await applyCredentialIssue(db, claudeInput);
    const second = await applyCredentialIssue(db, claudeInput);
    assert(first.ok && second.ok, "both ok");
    if (!first.ok || !second.ok) return;
    assert(second.data.alreadyIssued === true, "second is existing");
    assert(first.data.certificateId === second.data.certificateId, "same public id");
    assert(credentials.length === 1, "one credential");
    assert(certificates.length === 1, "one certificate");
  });

  await suite("concurrent retry still produces one authoritative credential", async () => {
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
    process.env.ENABLE_DUAL_WRITE = "true";
    const { db, certificates, credentials } = makeDb();
    const [a, b] = await Promise.all([
      applyCredentialIssue(db, claudeInput),
      applyCredentialIssue(db, claudeInput),
    ]);
    assert(a.ok && b.ok, "both ok");
    if (!a.ok || !b.ok) return;
    assert(a.data.certificateId === b.data.certificateId, "same public id");
    assert(credentials.length === 1, "one credential");
    assert(certificates.length === 1, "one certificate");
  });

  await suite("hackathon participation type and metadata", async () => {
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
    const { db, credentials, certificates } = makeDb();
    const r = await applyCredentialIssue(db, participationInput);
    assert(r.ok === true, "ok");
    if (!r.ok) return;
    assert(r.data.certificateId.startsWith("ABT-HK-"), "hk public id");
    assert(credentials[0]?.type === CredentialType.PARTICIPATION, "participation");
    assert(
      credentials[0]?.sourceKey ===
        hackathonParticipationSourceKey("vicodathon-2026", "team_9", "u2"),
      "stable participation key",
    );
    const meta = certificates[0]?.metadata as { hackathonVariant?: unknown };
    assert(meta?.hackathonVariant === undefined, "no placement variant");
  });

  await suite("hackathon placement is distinct from participation", async () => {
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
    const { db, credentials, certificates } = makeDb();
    const part = await applyCredentialIssue(db, participationInput);
    const place = await applyCredentialIssue(db, placementInput);
    assert(part.ok && place.ok, "both ok");
    if (!part.ok || !place.ok) return;
    assert(part.data.certificateId !== place.data.certificateId, "distinct public ids");
    assert(credentials.length === 2, "two credentials");
    assert(certificates.length === 2, "two certificates");
    const placement = credentials.find((c) => c.type === CredentialType.PLACEMENT);
    assert(placement != null, "placement row");
    assert(
      placement?.sourceKey ===
        hackathonPlacementSourceKey("vicodathon-2026", "team_9", "u2", "winner"),
      "stable placement key",
    );
    assert(
      credentials.find((c) => c.type === CredentialType.PARTICIPATION)?.sourceKey !==
        placement?.sourceKey,
      "distinct source keys",
    );
  });

  await suite("legacy mirror failure keeps Credential and succeeds", async () => {
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
    process.env.CERTIFICATE_FAIL_LEGACY_MIRROR = "true";
    const { db, credentials, certificates } = makeDb();
    const r = await applyCredentialIssue(db, claudeInput);
    assert(r.ok === true, "issuance succeeds");
    if (!r.ok) return;
    assert(r.mirrorFailed === true, "mirror flagged");
    assert(credentials.length === 1, "credential committed");
    assert(certificates.length === 0, "certificate not written");
    assert(credentials[0]?.credentialId === r.data.certificateId, "public id on credential");
  });

  await suite("public lookup id is the issued credentialId", async () => {
    process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
    delete process.env.CERTIFICATE_FAIL_LEGACY_MIRROR;
    const { db, credentials } = makeDb();
    const r = await applyCredentialIssue(db, claudeInput);
    assert(r.ok === true, "ok");
    if (!r.ok) return;
    const found = credentials.find((c) => c.credentialId === r.data.certificateId);
    assert(found != null, "getByPublicId key exists");
    const verify = source("src/features/certificate/get-certificate.ts");
    assert(verify.includes("getByPublicId"), "verify uses repo");
    const pdf = source("src/app/verify/[certificateId]/download/route.ts");
    assert(pdf.includes("getPublicCertificate"), "pdf uses same lookup");
  });

  await suite("no live Certificate/Credential revocation writer", () => {
    const write = source("src/repositories/credentials-write.ts");
    assert(!write.includes("CredentialStatus.REVOKED"), "issuance does not revoke");
    assert(!write.includes("CertificateStatus.REVOKED"), "mirror does not revoke");
    const issue = source("src/features/certificate/issue-certificate.ts");
    assert(!issue.includes("revokedAt"), "claude issue does not revoke");
    const hack = source("src/features/certificate/issue-hackathon-certificate.ts");
    assert(!hack.includes("revokedAt"), "hackathon issue does not revoke");
  });

  await suite("hire still consumes the Certificate mirror during W3-A", () => {
    const hire = source("src/repositories/hire.ts");
    assert(hire.includes("certificate: { select: { status: true } }"), "enrollment.certificate");
  });

  restoreEnv(prevWrites, prevMirror, prevDual, prevFail);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
