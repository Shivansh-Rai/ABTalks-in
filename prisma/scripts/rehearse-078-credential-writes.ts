/**
 * Child-only W3-A Credential write-authority rehearsal.
 * Refuses the production Neon host. ENABLE_NEW_CREDENTIAL_WRITES=true here only.
 * Certificate mirror stays on. Does not start W3-B or W4.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Domain } from "@prisma/client";
import {
  assertChildBranch,
} from "./migrate-078-shared";

async function db() {
  const { writeClient } = await import("../../src/lib/db");
  return writeClient();
}

type Db = Awaited<ReturnType<typeof db>>;
let prisma: Db;

function log(label: string, value: unknown): void {
  process.stdout.write(
    `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}\n`,
  );
}

async function publicCounts(publicId: string) {
  const [cred, cert] = await Promise.all([
    prisma.credential.findUnique({
      where: { credentialId: publicId },
      select: {
        credentialId: true,
        userId: true,
        type: true,
        sourceKey: true,
        title: true,
        recipientName: true,
      },
    }),
    prisma.certificate.findUnique({
      where: { certificateId: publicId },
      select: {
        certificateId: true,
        userId: true,
        type: true,
        recipientName: true,
      },
    }),
  ]);
  return { cred, cert };
}

async function main() {
  assertChildBranch();

  process.env.ENABLE_NEW_CREDENTIAL = "true";
  process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = process.env.ENABLE_DUAL_WRITE ?? "true";
  if (process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR === undefined) {
    process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "true";
  }
  delete process.env.CERTIFICATE_FAIL_LEGACY_MIRROR;

  prisma = await db();
  const { applyCredentialIssue } = await import(
    "../../src/repositories/credentials-write"
  );
  const { getByPublicId } = await import("../../src/repositories/credentials");
  const { getPublicCertificate } = await import(
    "../../src/features/certificate/get-certificate"
  );

  const stamp = Date.now().toString(36);
  const email = `w3-rehearse-${stamp}@abtalks.dev`;
  const failEmail = `w3-rehearse-fail-${stamp}@abtalks.dev`;

  const challenge = await prisma.challenge.findFirst({
    where: { domain: Domain.CLAUDE },
    select: { id: true },
  });
  if (!challenge) {
    throw new Error("No CLAUDE challenge row on this branch");
  }

  const user = await prisma.user.create({
    data: { email, name: "W3 Credential Rehearsal" },
    select: { id: true },
  });
  const failUser = await prisma.user.create({
    data: { email: failEmail, name: "W3 Mirror Fail" },
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
  const failEnrollment = await prisma.enrollment.create({
    data: {
      userId: failUser.id,
      challengeId: challenge.id,
      domain: Domain.CLAUDE,
    },
    select: { id: true },
  });

  log("test_user", user.id);
  log("fail_user", failUser.id);

  const issuedAt = new Date("2026-09-21T00:00:00.000Z");

  const claude = await applyCredentialIssue(prisma, {
    kind: "claude",
    userId: user.id,
    enrollmentId: enrollment.id,
    recipientName: "W3 Rehearsal",
    issuedAt,
    domain: Domain.CLAUDE,
    metadata: { daysCompleted: 56, longestStreak: 10 },
  });
  if (!claude.ok || claude.data.alreadyIssued) {
    throw new Error(`claude issue failed: ${JSON.stringify(claude)}`);
  }
  const claudeRows = await publicCounts(claude.data.certificateId);
  if (!claudeRows.cred || !claudeRows.cert) {
    throw new Error("claude missing credential or certificate mirror");
  }
  if (claudeRows.cred.credentialId !== claudeRows.cert.certificateId) {
    throw new Error("claude public id mismatch");
  }
  log("claude", claude.data);

  const claudeRepeat = await applyCredentialIssue(prisma, {
    kind: "claude",
    userId: user.id,
    enrollmentId: enrollment.id,
    recipientName: "W3 Rehearsal",
    issuedAt,
    domain: Domain.CLAUDE,
    metadata: { daysCompleted: 56, longestStreak: 10 },
  });
  if (!claudeRepeat.ok || !claudeRepeat.data.alreadyIssued) {
    throw new Error(`lazy repeat failed: ${JSON.stringify(claudeRepeat)}`);
  }
  if (claudeRepeat.data.certificateId !== claude.data.certificateId) {
    throw new Error("lazy repeat minted a new public id");
  }
  const claudeCount = await prisma.credential.count({
    where: { userId: user.id, title: "CLAUDE_CHALLENGE" },
  });
  if (claudeCount !== 1) throw new Error(`expected 1 claude credential, got ${claudeCount}`);

  const [c1, c2] = await Promise.all([
    applyCredentialIssue(prisma, {
      kind: "claude",
      userId: user.id,
      enrollmentId: enrollment.id,
      recipientName: "W3 Rehearsal",
      issuedAt,
      domain: Domain.CLAUDE,
      metadata: { daysCompleted: 56 },
    }),
    applyCredentialIssue(prisma, {
      kind: "claude",
      userId: user.id,
      enrollmentId: enrollment.id,
      recipientName: "W3 Rehearsal",
      issuedAt,
      domain: Domain.CLAUDE,
      metadata: { daysCompleted: 56 },
    }),
  ]);
  if (!c1.ok || !c2.ok) throw new Error("concurrent issue failed");
  if (c1.data.certificateId !== c2.data.certificateId) {
    throw new Error("concurrent issue produced two public ids");
  }

  const participation = await applyCredentialIssue(prisma, {
    kind: "hackathon_participation",
    userId: user.id,
    recipientName: "W3 Rehearsal",
    issuedAt: new Date(),
    eventKey: "vicodathon-2026",
    teamId: `w3-team-${stamp}`,
    metadata: {
      event: "vicodathon-2026",
      teamId: `w3-team-${stamp}`,
      teamName: "W3",
    },
  });
  if (!participation.ok) {
    throw new Error(`participation failed: ${JSON.stringify(participation)}`);
  }
  const partRows = await publicCounts(participation.data.certificateId);
  if (!partRows.cred || partRows.cred.type !== "PARTICIPATION") {
    throw new Error("participation type mismatch");
  }
  if (partRows.cred.credentialId !== partRows.cert?.certificateId) {
    throw new Error("participation public id mismatch");
  }
  log("participation", participation.data);

  const placement = await applyCredentialIssue(prisma, {
    kind: "hackathon_placement",
    userId: user.id,
    recipientName: "W3 Rehearsal",
    issuedAt: new Date("2026-08-13T18:30:00.000Z"),
    eventKey: "vicodathon-2026",
    teamId: `w3-team-${stamp}`,
    variant: "winner",
    metadata: {
      event: "vicodathon-2026",
      teamId: `w3-team-${stamp}`,
      hackathonVariant: "winner",
    },
  });
  if (!placement.ok) {
    throw new Error(`placement failed: ${JSON.stringify(placement)}`);
  }
  if (placement.data.certificateId === participation.data.certificateId) {
    throw new Error("placement collapsed onto participation");
  }
  const placeRows = await publicCounts(placement.data.certificateId);
  if (!placeRows.cred || placeRows.cred.type !== "PLACEMENT") {
    throw new Error("placement type mismatch");
  }
  log("placement", placement.data);

  const lookedUp = await getByPublicId(claude.data.certificateId);
  if (!lookedUp || lookedUp.credentialId !== claude.data.certificateId) {
    throw new Error("getByPublicId missed the new credential");
  }
  const publicView = await getPublicCertificate(claude.data.certificateId);
  if (!publicView || publicView.certificateId !== claude.data.certificateId) {
    throw new Error("verify/PDF lookup missed the new credential");
  }
  log("public_lookup", publicView.certificateId);

  process.env.CERTIFICATE_FAIL_LEGACY_MIRROR = "true";
  const failed = await applyCredentialIssue(prisma, {
    kind: "claude",
    userId: failUser.id,
    enrollmentId: failEnrollment.id,
    recipientName: "W3 Mirror Fail",
    issuedAt,
    domain: Domain.CLAUDE,
    metadata: { daysCompleted: 50 },
  });
  delete process.env.CERTIFICATE_FAIL_LEGACY_MIRROR;
  if (!failed.ok || !failed.mirrorFailed) {
    throw new Error(`mirror-failure path failed: ${JSON.stringify(failed)}`);
  }
  const failRows = await publicCounts(failed.data.certificateId);
  if (!failRows.cred) throw new Error("mirror failure deleted the credential");
  if (failRows.cert) throw new Error("mirror failure still wrote Certificate");
  log("mirror_failure", failed.data);

  const userCreds = await prisma.credential.count({ where: { userId: user.id } });
  const userCerts = await prisma.certificate.count({ where: { userId: user.id } });
  if (userCreds !== 3 || userCerts !== 3) {
    throw new Error(`expected 3/3 rows for test user, got cred=${userCreds} cert=${userCerts}`);
  }

  console.log("W3-A child rehearsal passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
