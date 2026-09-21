/**
 * Controlled W5-A production probe: apply Campus Ambassador candidacy for a
 * dedicated @abtalks.dev user, then wipe it. Never touches a real ambassador.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, production direct DATABASE_URL,
 * ENABLE_NEW_AMBASSADOR_WRITES=true, ENABLE_LEGACY_AMBASSADOR_MIRROR=true.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { Domain, UserType } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";

async function main() {
  process.env.ENABLE_NEW_AMBASSADOR_WRITES = "true";
  process.env.ENABLE_LEGACY_AMBASSADOR_MIRROR = "true";

  assertChildBranch();
  const { isNewAmbassadorWritesEnabled, isLegacyAmbassadorMirrorEnabled } =
    await import("../../src/lib/feature-flags");
  if (!isNewAmbassadorWritesEnabled()) {
    throw new Error("ENABLE_NEW_AMBASSADOR_WRITES must be true for this probe");
  }
  if (!isLegacyAmbassadorMirrorEnabled()) {
    throw new Error("W5-A probe requires ENABLE_LEGACY_AMBASSADOR_MIRROR=true");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { applyAmbassadorChange } = await import("../../src/repositories/ambassador");
  const { generateUniqueReferralCode } = await import(
    "../../src/features/registration/generate-referral-code"
  );

  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w5a-probe-${stamp}@abtalks.dev`;

  try {
    const user = await prisma.user.create({
      data: { email, name: "W5A Probe" },
      select: { id: true },
    });
    const referralCode = await generateUniqueReferralCode();
    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        fullName: "W5A Probe",
        userType: UserType.STUDENT,
        college: "Probe College",
        referralCode,
        skills: ["sql"],
        synergyPoints: 42,
        domain: Domain.SE,
        phone: "+919000000043",
      },
    });
    await prisma.candidateProfile.create({
      data: {
        id: `cp_${user.id}`,
        userId: user.id,
        fullName: "W5A Probe",
        referralCode,
      },
    });

    const before = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: {
        fullName: true,
        phone: true,
        referralCode: true,
        synergyPoints: true,
        domain: true,
        isCampusAmbassadorCandidate: true,
      },
    });
    if (!before) throw new Error("missing SP");

    const at = new Date();
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "apply", at });
    });

    const canonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true },
    });
    const sp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: {
        fullName: true,
        phone: true,
        referralCode: true,
        synergyPoints: true,
        domain: true,
        isCampusAmbassadorCandidate: true,
        ambassadorAppliedAt: true,
      },
    });
    if (!canonical?.isCandidate) throw new Error("canonical not candidate");
    if (!sp?.isCampusAmbassadorCandidate) throw new Error("SP ambassador not mirrored");
    if (sp.fullName !== before.fullName) throw new Error("identity changed");
    if (sp.synergyPoints !== 42) throw new Error("points changed");
    if (sp.domain !== Domain.SE) throw new Error("domain changed");

    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "wipe" });
    });

    console.log(
      JSON.stringify(
        {
          email,
          canonicalCandidate: canonical.isCandidate,
          spMirrored: sp.isCampusAmbassadorCandidate,
          identityUnchanged: true,
          pointsUnchanged: true,
          domainUnchanged: true,
          wiped: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.campusAmbassadorApplication.deleteMany({
      where: { user: { email } },
    });
    await prisma.studentProfile.deleteMany({ where: { user: { email } } });
    await prisma.candidateProfile.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
