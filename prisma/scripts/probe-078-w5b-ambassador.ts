/**
 * Controlled W5-B production probe: apply then dismiss Campus Ambassador
 * candidacy for a dedicated @abtalks.dev user. StudentProfile ambassador
 * fields must stay frozen. Never touches a real ambassador.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, production direct DATABASE_URL,
 * ENABLE_NEW_AMBASSADOR_WRITES=true, ENABLE_LEGACY_AMBASSADOR_MIRROR=false.
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
  process.env.ENABLE_LEGACY_AMBASSADOR_MIRROR = "false";

  assertChildBranch();
  const { isNewAmbassadorWritesEnabled, isLegacyAmbassadorMirrorEnabled } =
    await import("../../src/lib/feature-flags");
  if (!isNewAmbassadorWritesEnabled()) {
    throw new Error("ENABLE_NEW_AMBASSADOR_WRITES must be true for this probe");
  }
  if (isLegacyAmbassadorMirrorEnabled()) {
    throw new Error("W5-B probe requires ENABLE_LEGACY_AMBASSADOR_MIRROR=false");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { applyAmbassadorChange, getAmbassadorState } = await import(
    "../../src/repositories/ambassador"
  );
  const { generateUniqueReferralCode } = await import(
    "../../src/features/registration/generate-referral-code"
  );

  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w5b-probe-${stamp}@abtalks.dev`;

  try {
    const user = await prisma.user.create({
      data: { email, name: "W5B Probe" },
      select: { id: true },
    });
    const referralCode = await generateUniqueReferralCode();
    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        fullName: "W5B Probe",
        userType: UserType.STUDENT,
        college: "Probe College",
        referralCode,
        skills: ["sql"],
        synergyPoints: 42,
        domain: Domain.SE,
        phone: "+919000000053",
      },
    });
    await prisma.candidateProfile.create({
      data: {
        id: `cp_${user.id}`,
        userId: user.id,
        fullName: "W5B Probe",
        referralCode,
      },
    });

    const before = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: {
        fullName: true,
        synergyPoints: true,
        domain: true,
        isCampusAmbassadorCandidate: true,
        ambassadorAppliedAt: true,
        ambassadorDismissedAt: true,
      },
    });
    if (!before) throw new Error("missing SP");

    const appliedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "apply", at: appliedAt });
    });
    const dismissedAt = new Date(appliedAt.getTime() + 1000);
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "dismiss", at: dismissedAt });
    });

    const canonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    const sp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: {
        fullName: true,
        synergyPoints: true,
        domain: true,
        isCampusAmbassadorCandidate: true,
        ambassadorAppliedAt: true,
        ambassadorDismissedAt: true,
      },
    });
    const read = await getAmbassadorState(user.id);
    if (!canonical?.isCandidate) throw new Error("canonical not candidate");
    if (!canonical.appliedAt) throw new Error("canonical appliedAt missing");
    if (!canonical.dismissedAt) throw new Error("canonical dismissedAt missing");
    if (!sp) throw new Error("missing SP after");
    if (sp.isCampusAmbassadorCandidate !== before.isCampusAmbassadorCandidate) {
      throw new Error("SP candidate flag changed");
    }
    if (sp.ambassadorAppliedAt !== before.ambassadorAppliedAt) {
      throw new Error("SP appliedAt changed");
    }
    if (sp.ambassadorDismissedAt !== before.ambassadorDismissedAt) {
      throw new Error("SP dismissedAt changed");
    }
    if (sp.fullName !== before.fullName) throw new Error("identity changed");
    if (sp.synergyPoints !== 42) throw new Error("points changed");
    if (sp.domain !== Domain.SE) throw new Error("domain changed");
    if (!read.isCandidate || !read.appliedAt || !read.dismissedAt) {
      throw new Error("current-state read did not return canonical");
    }

    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "wipe" });
    });

    console.log(
      JSON.stringify(
        {
          email,
          canonical: {
            isCandidate: canonical.isCandidate,
            appliedAt: canonical.appliedAt,
            dismissedAt: canonical.dismissedAt,
          },
          read,
          spFrozen: true,
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
