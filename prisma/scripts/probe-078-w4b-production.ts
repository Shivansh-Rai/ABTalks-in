/**
 * Controlled W4-B production probe on an @abtalks.dev account only.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, production direct DATABASE_URL,
 * ENABLE_NEW_CANDIDATE_WRITES=true, ENABLE_LEGACY_STUDENT_PROFILE_MIRROR=false.
 *
 * Proves canonical identity updates while W4-owned StudentProfile fields stay
 * frozen. Does not mutate a real user's identity.
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

const W4_SELECT = {
  fullName: true,
  phone: true,
  linkedinUrl: true,
  githubUsername: true,
  referralCode: true,
  skills: true,
} as const;

async function main() {
  process.env.ENABLE_NEW_CANDIDATE = "true";
  process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = "true";
  process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "false";

  assertChildBranch();
  if (!isNewCandidateWritesEnabled()) {
    throw new Error("ENABLE_NEW_CANDIDATE_WRITES must be true for this probe");
  }
  if (isLegacyStudentProfileMirrorEnabled()) {
    throw new Error("W4-B probe requires ENABLE_LEGACY_STUDENT_PROFILE_MIRROR=false");
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
  const email = `w4b-probe-${stamp}@abtalks.dev`;

  try {
    const user = await prisma.user.create({
      data: { email, name: "W4B Probe" },
      select: { id: true },
    });
    const referralCode = await generateUniqueReferralCode();

    await prisma.$transaction(async (tx) => {
      await createCandidateIdentity(tx, {
        userId: user.id,
        fullName: "W4B Probe",
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

    const beforeSp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: W4_SELECT,
    });

    await prisma.$transaction(async (tx) => {
      await applyCandidateIdentityChange(tx, user.id, {
        fullName: "W4B Probe Edited",
        linkedinUrl: "https://linkedin.com/in/w4b-probe",
        githubUsername: "w4b-probe",
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

    const [cp, afterSp] = await Promise.all([
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
        select: W4_SELECT,
      }),
    ]);
    const lookedUp = await findUserIdByReferralCode(referralCode);

    if (!cp) throw new Error("probe missing CandidateProfile");
    if (cp.fullName !== "W4B Probe Edited") throw new Error("canonical name not updated");
    if (cp.referralCode !== referralCode) throw new Error("probe referral changed");
    if (lookedUp !== user.id) throw new Error("probe referral lookup failed");
    if (JSON.stringify(beforeSp) !== JSON.stringify(afterSp)) {
      throw new Error("W4-owned StudentProfile fields changed during probe");
    }
    if (afterSp) {
      throw new Error("mirror-off probe unexpectedly created StudentProfile identity");
    }

    console.log(
      JSON.stringify(
        {
          email,
          userId: user.id,
          referralCode,
          candidateBefore: { fullName: "W4B Probe" },
          candidateAfter: {
            fullName: cp.fullName,
            linkedinUrl: cp.linkedinUrl,
            githubUsername: cp.githubUsername,
          },
          studentProfileBefore: beforeSp,
          studentProfileAfter: afterSp,
          lookupOk: true,
        },
        null,
        2,
      ),
    );
    console.log("W4-B production probe passed");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
