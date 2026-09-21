/**
 * Controlled W4-A production probe: create/update a dedicated @abtalks.dev
 * candidate identity without touching a real user's profile.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, production direct DATABASE_URL,
 * ENABLE_NEW_CANDIDATE_WRITES=true, ENABLE_LEGACY_STUDENT_PROFILE_MIRROR=true.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { UserType } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import {
  isLegacyStudentProfileMirrorEnabled,
  isNewCandidateWritesEnabled,
} from "../../src/lib/feature-flags";

async function main() {
  process.env.ENABLE_NEW_CANDIDATE = "true";
  process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = "true";
  process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "true";

  assertChildBranch();
  if (!isNewCandidateWritesEnabled()) {
    throw new Error("ENABLE_NEW_CANDIDATE_WRITES must be true for this probe");
  }
  if (!isLegacyStudentProfileMirrorEnabled()) {
    throw new Error("W4-A probe requires ENABLE_LEGACY_STUDENT_PROFILE_MIRROR=true");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { createCandidateIdentity, applyCandidateIdentityChange } = await import(
    "../../src/repositories/candidate-identity"
  );
  const { generateUniqueReferralCode } = await import(
    "../../src/features/registration/generate-referral-code"
  );
  const { findUserIdByReferralCode } = await import(
    "../../src/repositories/candidate"
  );
  const { saveSkillClaims } = await import(
    "../../src/repositories/candidate-detail"
  );

  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `w4a-probe-${stamp}@abtalks.dev`;

  try {
    const user = await prisma.user.create({
      data: { email, name: "W4A Probe" },
      select: { id: true },
    });
    const referralCode = await generateUniqueReferralCode();

    await prisma.$transaction(async (tx) => {
      await createCandidateIdentity(tx, {
        userId: user.id,
        fullName: "W4A Probe",
        userType: UserType.STUDENT,
        referralCode,
        phone: "+919000000001",
        phoneVerified: true,
        college: "Probe College",
        collegeId: null,
        organization: null,
        role: null,
        yearsExperience: null,
        headline: "Probe",
        locationCity: "Bengaluru",
        locationRegion: "KA",
        countryCode: "IN",
        synergyPoints: 0,
      });
    });

    await prisma.$transaction(async (tx) => {
      await applyCandidateIdentityChange(tx, user.id, {
        fullName: "W4A Probe Edited",
        linkedinUrl: "https://linkedin.com/in/w4a-probe",
        githubUsername: "w4a-probe",
      });
    });

    const skills = await prisma.skill.findMany({
      where: { isActive: true },
      take: 3,
      select: { id: true },
    });
    if (skills.length > 0) {
      await saveSkillClaims(
        user.id,
        skills.map((s) => ({ skillId: s.id })),
      );
    }

    const [cp, sp] = await Promise.all([
      prisma.candidateProfile.findUnique({
        where: { userId: user.id },
        select: {
          fullName: true,
          referralCode: true,
          linkedinUrl: true,
          githubUsername: true,
        },
      }),
      prisma.studentProfile.findUnique({
        where: { userId: user.id },
        select: {
          fullName: true,
          referralCode: true,
          linkedinUrl: true,
          githubUsername: true,
          skills: true,
        },
      }),
    ]);
    const lookedUp = await findUserIdByReferralCode(referralCode);

    if (!cp || !sp) throw new Error("probe missing CP or SP");
    if (cp.referralCode !== sp.referralCode || cp.referralCode !== referralCode) {
      throw new Error("probe referral divergence");
    }
    if (cp.fullName !== "W4A Probe Edited" || sp.fullName !== "W4A Probe Edited") {
      throw new Error("probe name not mirrored");
    }
    if (lookedUp !== user.id) throw new Error("probe referral lookup failed");

    console.log(
      JSON.stringify(
        {
          email,
          userId: user.id,
          referralCode,
          canonicalName: cp.fullName,
          mirrorName: sp.fullName,
          sameReferral: true,
          lookupOk: true,
          claimedSkillMirror: sp.skills.length,
        },
        null,
        2,
      ),
    );
    console.log("W4-A production probe passed");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
