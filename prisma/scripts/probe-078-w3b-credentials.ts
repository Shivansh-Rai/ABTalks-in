/**
 * Controlled W3-B production probe: mint one Credential on a dedicated
 * @abtalks.dev account without fabricating a real candidate's achievement.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, production direct DATABASE_URL,
 * ENABLE_NEW_CREDENTIAL_WRITES=true, ENABLE_LEGACY_CERTIFICATE_MIRROR=false.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { Domain } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import {
  isLegacyCertificateMirrorEnabled,
  isNewCredentialWritesEnabled,
} from "../../src/lib/feature-flags";

async function main() {
  process.env.ENABLE_NEW_CREDENTIAL = "true";
  process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = "true";
  process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "false";

  assertChildBranch();
  if (!isNewCredentialWritesEnabled()) {
    throw new Error("ENABLE_NEW_CREDENTIAL_WRITES must be true for this probe");
  }
  if (isLegacyCertificateMirrorEnabled()) {
    throw new Error("W3-B probe requires ENABLE_LEGACY_CERTIFICATE_MIRROR=false");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { applyCredentialIssue } = await import(
    "../../src/repositories/credentials-write"
  );
  const { getByPublicId } = await import("../../src/repositories/credentials");
  const { getPublicCertificate } = await import(
    "../../src/features/certificate/get-certificate"
  );
  const prisma = writeClient();

  const stamp = Date.now().toString(36);
  const email = `w3b-probe-${stamp}@abtalks.dev`;
  const certBefore = await prisma.certificate.count();
  const credBefore = await prisma.credential.count();

  const challenge = await prisma.challenge.findFirst({
    where: { domain: Domain.CLAUDE },
    select: { id: true },
  });
  if (!challenge) throw new Error("No CLAUDE challenge");

  const user = await prisma.user.create({
    data: { email, name: "W3B Probe" },
    select: { id: true },
  });
  const enrollment = await prisma.enrollment.create({
    data: {
      userId: user.id,
      challengeId: challenge.id,
      domain: Domain.CLAUDE,
    },
    select: { id: true },
  });

  const first = await applyCredentialIssue(prisma, {
    kind: "claude",
    userId: user.id,
    enrollmentId: enrollment.id,
    recipientName: "W3B Probe",
    issuedAt: new Date(),
    domain: Domain.CLAUDE,
    metadata: { probe: true, daysCompleted: 56 },
  });
  const retry = await applyCredentialIssue(prisma, {
    kind: "claude",
    userId: user.id,
    enrollmentId: enrollment.id,
    recipientName: "W3B Probe",
    issuedAt: new Date(),
    domain: Domain.CLAUDE,
    metadata: { probe: true, daysCompleted: 56 },
  });

  const certAfter = await prisma.certificate.count();
  const credAfter = await prisma.credential.count();
  const publicId = first.ok ? first.data.certificateId : null;
  const lookup = publicId ? await getByPublicId(publicId) : null;
  const view = publicId ? await getPublicCertificate(publicId) : null;

  const report = {
    email,
    userId: user.id,
    certBefore,
    certAfter,
    credBefore,
    credAfter,
    first,
    retry,
    publicId,
    getByPublicId: lookup?.credentialId ?? null,
    verifyView: view?.certificateId ?? null,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!first.ok || first.data.alreadyIssued) {
    throw new Error("expected a new Credential");
  }
  if (!retry.ok || !retry.data.alreadyIssued) {
    throw new Error("retry must be alreadyIssued");
  }
  if (retry.data.certificateId !== first.data.certificateId) {
    throw new Error("retry minted a second public id");
  }
  if (certAfter !== certBefore) {
    throw new Error(`Certificate count changed ${certBefore} → ${certAfter}`);
  }
  if (credAfter !== credBefore + 1) {
    throw new Error(`expected Credential +1, ${credBefore} → ${credAfter}`);
  }
  if (lookup?.credentialId !== publicId || view?.certificateId !== publicId) {
    throw new Error("verify/PDF lookup missed the probe credential");
  }
  console.log("W3-B production probe passed (Certificate frozen).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
