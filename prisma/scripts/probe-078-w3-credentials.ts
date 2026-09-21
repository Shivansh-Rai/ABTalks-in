/**
 * Controlled W3-A production probe: idempotent Claude issuance on a test
 * account. Does not invent achievements. Does not touch Points or Visibility.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, production direct DATABASE_URL,
 * ENABLE_NEW_CREDENTIAL_WRITES=true. Target: W3_PROBE_EMAIL or @abtalks.dev.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { assertChildBranch } from "./migrate-078-shared";
import {
  isLegacyCertificateMirrorEnabled,
  isNewCredentialWritesEnabled,
} from "../../src/lib/feature-flags";

const TARGET_EMAIL =
  process.env.W3_PROBE_EMAIL?.trim() ||
  "078-dw-probe-mt8klx3t@abtalks.dev";

async function main() {
  process.env.ENABLE_NEW_CREDENTIAL = "true";
  process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = "true";
  if (process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR === undefined) {
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
  }

  assertChildBranch();
  if (!isNewCredentialWritesEnabled()) {
    throw new Error("ENABLE_NEW_CREDENTIAL_WRITES must be true for this probe");
  }
  if (!isLegacyCertificateMirrorEnabled()) {
    throw new Error("W3-A probe requires ENABLE_LEGACY_CERTIFICATE_MIRROR on");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { ensureClaudeCertificate } = await import(
    "../../src/features/certificate/issue-certificate"
  );
  const { getByPublicId } = await import("../../src/repositories/credentials");
  const { getPublicCertificate } = await import(
    "../../src/features/certificate/get-certificate"
  );
  const prisma = writeClient();

  let target = await prisma.user.findFirst({
    where: { email: TARGET_EMAIL, deletedAt: null },
    select: { id: true, email: true },
  });
  if (!target) {
    target = await prisma.user.findFirst({
      where: { email: { endsWith: "@abtalks.dev" }, deletedAt: null },
      orderBy: { email: "asc" },
      select: { id: true, email: true },
    });
  }
  if (!target) {
    throw new Error(`Probe refused: no live @abtalks.dev user (tried ${TARGET_EMAIL})`);
  }

  const before = {
    credentials: await prisma.credential.count({ where: { userId: target.id } }),
    certificates: await prisma.certificate.count({ where: { userId: target.id } }),
  };

  const first = await ensureClaudeCertificate(target.id);
  const afterFirst = {
    credentials: await prisma.credential.count({ where: { userId: target.id } }),
    certificates: await prisma.certificate.count({ where: { userId: target.id } }),
  };
  const retry = await ensureClaudeCertificate(target.id);
  const afterRetry = {
    credentials: await prisma.credential.count({ where: { userId: target.id } }),
    certificates: await prisma.certificate.count({ where: { userId: target.id } }),
  };

  const publicId =
    first.ok ? first.data.certificateId : retry.ok ? retry.data.certificateId : null;

  let lookup = null;
  let publicView = null;
  if (publicId) {
    lookup = await getByPublicId(publicId);
    publicView = await getPublicCertificate(publicId);
  }

  const report = {
    email: target.email,
    userId: target.id,
    before,
    first,
    afterFirst,
    retry,
    afterRetry,
    publicId,
    getByPublicId: lookup?.credentialId ?? null,
    verifyView: publicView?.certificateId ?? null,
  };
  console.log(JSON.stringify(report, null, 2));

  if (afterRetry.credentials !== afterFirst.credentials) {
    throw new Error("retry mutated Credential count");
  }
  if (afterRetry.certificates !== afterFirst.certificates) {
    throw new Error("retry mutated Certificate count");
  }
  if (first.ok && retry.ok && first.data.certificateId !== retry.data.certificateId) {
    throw new Error("retry returned a different public id");
  }
  if (publicId && lookup?.credentialId !== publicId) {
    throw new Error("getByPublicId missed the issued credential");
  }
  if (publicId && publicView?.certificateId !== publicId) {
    throw new Error("verify/PDF lookup missed the issued credential");
  }
  console.log("W3-A production credential probe passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
