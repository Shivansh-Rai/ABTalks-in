/**
 * Child-only W4-B StudentProfile identity/referral freeze rehearsal.
 * Refuses the production Neon host.
 *
 * ENABLE_NEW_CANDIDATE=true
 * ENABLE_NEW_CANDIDATE_WRITES=true
 * ENABLE_LEGACY_STUDENT_PROFILE_MIRROR=false
 *
 * Canonical identity must change. W4-owned StudentProfile fields must not.
 * Does not start W5. Does not drop StudentProfile.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { EvidenceSourceType, UserType } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";

async function db() {
  const { writeClient } = await import("../../src/lib/db");
  return writeClient();
}

type Db = Awaited<ReturnType<typeof db>>;
let prisma: Db;

const W4_SELECT = {
  fullName: true,
  phone: true,
  phoneVerified: true,
  phoneVerifiedAt: true,
  linkedinUrl: true,
  githubUsername: true,
  resumeUrl: true,
  referralCode: true,
  isReadyForInterview: true,
  userType: true,
  college: true,
  collegeId: true,
  graduationYear: true,
  organization: true,
  role: true,
  yearsExperience: true,
  skills: true,
} as const;

type W4Snapshot = {
  fullName: string;
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  linkedinUrl: string | null;
  githubUsername: string | null;
  resumeUrl: string | null;
  referralCode: string;
  isReadyForInterview: boolean;
  userType: UserType;
  college: string | null;
  collegeId: string | null;
  graduationYear: number | null;
  organization: string | null;
  role: string | null;
  yearsExperience: number | null;
  skills: string[];
} | null;

function log(label: string, value: unknown): void {
  process.stdout.write(
    `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}\n`,
  );
}

function sameW4(before: W4Snapshot, after: W4Snapshot, label: string): void {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`${label}: W4-owned StudentProfile fields changed`);
  }
}

async function snapshotSp(userId: string): Promise<W4Snapshot> {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: W4_SELECT,
  });
}

async function main() {
  assertChildBranch();

  process.env.ENABLE_NEW_CANDIDATE = "true";
  process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = process.env.ENABLE_DUAL_WRITE ?? "true";
  process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "false";
  delete process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR;

  const dbHost = (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0];
  log("rehearsal_host", dbHost);
  log("mirror", process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR);

  prisma = await db();
  const { createCandidateIdentity, applyCandidateIdentityChange } = await import(
    "../../src/repositories/candidate-identity"
  );
  const { generateUniqueReferralCode } = await import(
    "../../src/features/registration/generate-referral-code"
  );
  const { findUserIdByReferralCode } = await import(
    "../../src/repositories/candidate"
  );
  const {
    saveEducation,
    saveExperience,
    saveSkillClaims,
  } = await import("../../src/repositories/candidate-detail");

  const stamp = Date.now().toString(36);
  const email = `w4b-rehearse-${stamp}@abtalks.dev`;

  const user = await prisma.user.create({
    data: { email, name: "W4B Rehearsal" },
    select: { id: true },
  });
  const referralCode = await generateUniqueReferralCode();

  await prisma.$transaction(async (tx) => {
    await createCandidateIdentity(tx, {
      userId: user.id,
      fullName: "W4B Rehearsal",
      userType: UserType.STUDENT,
      referralCode,
      phone: "+919876543210",
      phoneVerified: true,
      college: "IIT Bombay",
      collegeId: null,
      organization: null,
      role: null,
      yearsExperience: null,
      headline: "Builder",
      locationCity: "Mumbai",
      locationRegion: "MH",
      countryCode: "IN",
      synergyPoints: 0,
    });
  });

  const cpAfterCreate = await prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { fullName: true, referralCode: true, phoneVerified: true },
  });
  if (!cpAfterCreate) throw new Error("registration did not create CandidateProfile");
  if (cpAfterCreate.referralCode !== referralCode) {
    throw new Error("registration minted a different code");
  }
  const spAfterCreate = await snapshotSp(user.id);
  if (spAfterCreate) {
    throw new Error("mirror-off registration must not create W4 StudentProfile identity");
  }
  const lookedUp = await findUserIdByReferralCode(referralCode);
  if (lookedUp !== user.id) throw new Error("referral lookup missed CandidateProfile");
  log("registration", { canonical: true, studentProfile: null, lookupOk: true });

  let frozen = await snapshotSp(user.id);

  await prisma.$transaction(async (tx) => {
    await applyCandidateIdentityChange(tx, user.id, {
      fullName: "W4B Rehearsal Edited",
      phone: "+919876543211",
      linkedinUrl: "https://linkedin.com/in/w4b",
      githubUsername: "w4b-rehearse",
      resumeUrl: "https://example.com/w4b.pdf",
    });
  });
  sameW4(frozen, await snapshotSp(user.id), "profile scalar");
  frozen = await snapshotSp(user.id);
  const cpEdited = await prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { fullName: true, referralCode: true, linkedinUrl: true },
  });
  if (cpEdited?.fullName !== "W4B Rehearsal Edited") {
    throw new Error("canonical name not updated");
  }
  if (cpEdited.referralCode !== referralCode) {
    throw new Error("profile edit reminted referral");
  }
  log("profile_scalar", { canonicalName: cpEdited.fullName, spFrozen: true });

  await prisma.$transaction(async (tx) => {
    await applyCandidateIdentityChange(tx, user.id, {
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
      isReadyForInterview: true,
    });
  });
  sameW4(frozen, await snapshotSp(user.id), "otp/ready");
  frozen = await snapshotSp(user.id);
  log("otp_ready", { frozen: true });

  await saveEducation(user.id, [
    {
      institutionName: "Old College",
      collegeId: null,
      degree: "BSc",
      fieldOfStudy: "Math",
      startMonth: 8,
      startYear: 2018,
      endMonth: 5,
      graduationYear: 2022,
      isCurrent: false,
      gradeType: null,
      grade: null,
      description: null,
    },
    {
      institutionName: "Current Uni",
      collegeId: null,
      degree: "MSc",
      fieldOfStudy: "CS",
      startMonth: 8,
      startYear: 2024,
      endMonth: null,
      graduationYear: null,
      isCurrent: true,
      gradeType: null,
      grade: null,
      description: null,
    },
  ]);
  sameW4(frozen, await snapshotSp(user.id), "education");
  frozen = await snapshotSp(user.id);
  const eduCount = await prisma.candidateEducation.count({ where: { userId: user.id } });
  if (eduCount !== 2) throw new Error(`expected 2 education rows, got ${eduCount}`);
  log("education", { canonicalRows: eduCount, spFrozen: true });

  await saveExperience(user.id, [
    {
      companyName: "Past Co",
      title: "Intern",
      employmentType: null,
      locationCity: null,
      startMonth: 6,
      startYear: 2021,
      endMonth: 8,
      endYear: 2021,
      isCurrent: false,
      description: null,
    },
    {
      companyName: "Now Co",
      title: "Engineer",
      employmentType: null,
      locationCity: null,
      startMonth: 1,
      startYear: 2023,
      endMonth: null,
      endYear: null,
      isCurrent: true,
      description: null,
    },
  ]);
  sameW4(frozen, await snapshotSp(user.id), "experience");
  frozen = await snapshotSp(user.id);
  const expCount = await prisma.candidateExperience.count({ where: { userId: user.id } });
  if (expCount !== 2) throw new Error(`expected 2 experience rows, got ${expCount}`);
  log("experience", { canonicalRows: expCount, spFrozen: true });

  let skills = await prisma.skill.findMany({
    where: { isActive: true },
    orderBy: { slug: "asc" },
    take: 12,
    select: { id: true, name: true },
  });
  while (skills.length < 12) {
    const n = skills.length + 1;
    const created = await prisma.skill.create({
      data: {
        slug: `w4b-rehearse-${stamp}-${n}`,
        name: `W4B Skill ${n}`,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    skills = [...skills, created];
  }
  await saveSkillClaims(
    user.id,
    skills.map((s) => ({ skillId: s.id })),
  );
  sameW4(frozen, await snapshotSp(user.id), "skills add");
  frozen = await snapshotSp(user.id);
  const claimed = await prisma.candidateSkill.count({
    where: { userId: user.id, claimedByCandidate: true },
  });
  if (claimed !== skills.length) throw new Error("claimed skill count mismatch");
  log("skills_add", { claimed, spFrozen: true });

  const evidenced = await prisma.candidateSkill.findFirst({
    where: { userId: user.id, claimedByCandidate: true },
    select: { id: true, skillId: true },
  });
  if (!evidenced) throw new Error("missing claimed skill for evidence");
  await prisma.skillEvidence.create({
    data: {
      candidateSkillId: evidenced.id,
      sourceType: EvidenceSourceType.EXTERNAL,
      sourceId: `w4b-${stamp}`,
      sourceLabel: "W4-B rehearsal",
      occurredAt: new Date(),
    },
  });
  await prisma.candidateSkill.update({
    where: { id: evidenced.id },
    data: { evidenceCount: 1 },
  });
  const remaining = skills.filter((s) => s.id !== evidenced.skillId).map((s) => ({
    skillId: s.id,
  }));
  await saveSkillClaims(user.id, remaining);
  sameW4(frozen, await snapshotSp(user.id), "skills withdraw");
  const withdrawn = await prisma.candidateSkill.findUnique({
    where: { id: evidenced.id },
    select: { claimedByCandidate: true, _count: { select: { evidence: true } } },
  });
  if (!withdrawn || withdrawn.claimedByCandidate !== false) {
    throw new Error("evidenced skill was deleted or stayed claimed");
  }
  if (withdrawn._count.evidence < 1) throw new Error("evidence lost");
  log("skills_withdraw", { unclaimedKept: true, evidenceKept: true, spFrozen: true });

  await prisma.$transaction(async (tx) => {
    await applyCandidateIdentityChange(tx, user.id, {
      fullName: "W4B Rehearsal Edited",
      linkedinUrl: "https://linkedin.com/in/w4b",
    });
  });
  sameW4(frozen, await snapshotSp(user.id), "retry");
  if ((await findUserIdByReferralCode(referralCode)) !== user.id) {
    throw new Error("referral lookup failed after freeze");
  }

  log("w4b_rehearsal", "passed");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
