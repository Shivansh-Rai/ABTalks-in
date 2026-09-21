/**
 * Child-only W3-B Certificate mirror-off rehearsal.
 * Refuses the production Neon host.
 * ENABLE_NEW_CREDENTIAL_WRITES=true, ENABLE_LEGACY_CERTIFICATE_MIRROR=false.
 * Does not start W4.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Domain } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";

async function main() {
  assertChildBranch();

  process.env.ENABLE_NEW_CREDENTIAL = "true";
  process.env.ENABLE_NEW_CREDENTIAL_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = process.env.ENABLE_DUAL_WRITE ?? "true";
  process.env.ENABLE_LEGACY_CERTIFICATE_MIRROR = "false";
  delete process.env.CERTIFICATE_FAIL_LEGACY_MIRROR;

  const { writeClient } = await import("../../src/lib/db");
  const prisma = writeClient();
  const { applyCredentialIssue } = await import(
    "../../src/repositories/credentials-write"
  );
  const { getByPublicId, issuedChallengeEnrollmentIds } = await import(
    "../../src/repositories/credentials"
  );
  const { getPublicCertificate } = await import(
    "../../src/features/certificate/get-certificate"
  );
  const { buildEvidenceProvenance } = await import(
    "../../src/features/admin/evidence-provenance"
  );

  const certBefore = await prisma.certificate.count();
  const credBefore = await prisma.credential.count();

  const stamp = Date.now().toString(36);
  const challenge = await prisma.challenge.findFirst({
    where: { domain: Domain.CLAUDE },
    select: { id: true },
  });
  if (!challenge) throw new Error("No CLAUDE challenge row on this branch");

  const user = await prisma.user.create({
    data: { email: `w3b-rehearse-${stamp}@abtalks.dev`, name: "W3B Rehearsal" },
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

  const issuedAt = new Date("2026-09-21T00:00:00.000Z");
  const claude = await applyCredentialIssue(prisma, {
    kind: "claude",
    userId: user.id,
    enrollmentId: enrollment.id,
    recipientName: "W3B Rehearsal",
    issuedAt,
    domain: Domain.CLAUDE,
    metadata: { daysCompleted: 56 },
  });
  if (!claude.ok || claude.data.alreadyIssued) {
    throw new Error(`claude issue failed: ${JSON.stringify(claude)}`);
  }

  const claudeRepeat = await applyCredentialIssue(prisma, {
    kind: "claude",
    userId: user.id,
    enrollmentId: enrollment.id,
    recipientName: "W3B Rehearsal",
    issuedAt,
    domain: Domain.CLAUDE,
    metadata: { daysCompleted: 56 },
  });
  if (!claudeRepeat.ok || !claudeRepeat.data.alreadyIssued) {
    throw new Error("lazy repeat did not return alreadyIssued");
  }
  if (claudeRepeat.data.certificateId !== claude.data.certificateId) {
    throw new Error("lazy repeat minted a new public id");
  }

  const [c1, c2] = await Promise.all([
    applyCredentialIssue(prisma, {
      kind: "claude",
      userId: user.id,
      enrollmentId: enrollment.id,
      recipientName: "W3B Rehearsal",
      issuedAt,
      domain: Domain.CLAUDE,
      metadata: { daysCompleted: 56 },
    }),
    applyCredentialIssue(prisma, {
      kind: "claude",
      userId: user.id,
      enrollmentId: enrollment.id,
      recipientName: "W3B Rehearsal",
      issuedAt,
      domain: Domain.CLAUDE,
      metadata: { daysCompleted: 56 },
    }),
  ]);
  if (!c1.ok || !c2.ok || c1.data.certificateId !== c2.data.certificateId) {
    throw new Error("concurrent retry produced two credentials");
  }

  const teamId = `w3b-team-${stamp}`;
  const participation = await applyCredentialIssue(prisma, {
    kind: "hackathon_participation",
    userId: user.id,
    recipientName: "W3B Rehearsal",
    issuedAt: new Date(),
    eventKey: "vicodathon-2026",
    teamId,
    metadata: { event: "vicodathon-2026", teamId, teamName: "W3B" },
  });
  const placement = await applyCredentialIssue(prisma, {
    kind: "hackathon_placement",
    userId: user.id,
    recipientName: "W3B Rehearsal",
    issuedAt: new Date("2026-08-13T18:30:00.000Z"),
    eventKey: "vicodathon-2026",
    teamId,
    variant: "winner",
    metadata: {
      event: "vicodathon-2026",
      teamId,
      hackathonVariant: "winner",
    },
  });
  if (!participation.ok || !placement.ok) {
    throw new Error("hackathon issue failed");
  }
  if (participation.data.certificateId === placement.data.certificateId) {
    throw new Error("placement collapsed onto participation");
  }

  const lookedUp = await getByPublicId(claude.data.certificateId);
  const publicView = await getPublicCertificate(claude.data.certificateId);
  if (!lookedUp || !publicView) throw new Error("verify/PDF lookup missed Credential");

  const hireIssued = await issuedChallengeEnrollmentIds([enrollment.id]);
  if (!hireIssued.has(enrollment.id)) {
    throw new Error("hire Credential lookup missed the new completion");
  }

  const partCred = await prisma.credential.findUnique({
    where: { credentialId: participation.data.certificateId },
    select: { id: true, credentialId: true, type: true, sourceType: true, sourceKey: true, title: true, metadata: true, issuedAt: true },
  });
  if (!partCred) throw new Error("missing participation credential");
  const provenance = buildEvidenceProvenance(user.id, {
    evidence: [],
    credentials: [partCred],
    achievements: [],
    programmeSkills: [],
    scores: [],
    evaluations: [],
    linkedCredentials: [],
    enrollments: [],
    participants: [],
    teams: [],
    workshops: [],
    certificates: [],
    reports: [],
  });
  if (provenance.credentials.length !== 1) {
    throw new Error("admin provenance dropped the Credential-only row");
  }

  const certAfter = await prisma.certificate.count();
  const credAfter = await prisma.credential.count();
  const userCerts = await prisma.certificate.count({ where: { userId: user.id } });
  const userCreds = await prisma.credential.count({ where: { userId: user.id } });

  const report = {
    userId: user.id,
    claude: claude.data.certificateId,
    participation: participation.data.certificateId,
    placement: placement.data.certificateId,
    certificateCountBefore: certBefore,
    certificateCountAfter: certAfter,
    credentialCountBefore: credBefore,
    credentialCountAfter: credAfter,
    userCertificates: userCerts,
    userCredentials: userCreds,
  };
  console.log(JSON.stringify(report, null, 2));

  if (certAfter !== certBefore) {
    throw new Error(`Certificate table changed: ${certBefore} → ${certAfter}`);
  }
  if (userCerts !== 0) throw new Error("user received a Certificate mirror");
  if (userCreds !== 3) throw new Error(`expected 3 credentials, got ${userCreds}`);
  if (credAfter !== credBefore + 3) {
    throw new Error(`expected +3 credentials, ${credBefore} → ${credAfter}`);
  }
  console.log("W3-B child rehearsal passed (Certificate frozen).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
