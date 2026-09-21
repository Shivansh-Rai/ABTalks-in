/**
 * Child-only W4-A Candidate identity write-authority rehearsal.
 * Refuses the production Neon host. ENABLE_NEW_CANDIDATE_WRITES=true here only.
 * StudentProfile identity mirror stays on. Does not start W4-B or W5.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { CandidatePersona, EvidenceSourceType, UserType } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";

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

async function identity(userId: string) {
  const [cp, sp] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { userId },
      select: {
        fullName: true,
        referralCode: true,
        phone: true,
        linkedinUrl: true,
        githubUsername: true,
        resumeUrl: true,
        headline: true,
      },
    }),
    prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        fullName: true,
        referralCode: true,
        phone: true,
        linkedinUrl: true,
        githubUsername: true,
        resumeUrl: true,
        college: true,
        organization: true,
        skills: true,
      },
    }),
  ]);
  return { cp, sp };
}

async function main() {
  assertChildBranch();

  process.env.ENABLE_NEW_CANDIDATE = "true";
  process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = process.env.ENABLE_DUAL_WRITE ?? "true";
  if (process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR === undefined) {
    process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "true";
  }
  delete process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR;

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
  const email = `w4a-rehearse-${stamp}@abtalks.dev`;
  const failEmail = `w4a-rehearse-fail-${stamp}@abtalks.dev`;

  const user = await prisma.user.create({
    data: { email, name: "W4A Rehearsal" },
    select: { id: true },
  });
  const referralCode = await generateUniqueReferralCode();

  await prisma.$transaction(async (tx) => {
    await createCandidateIdentity(tx, {
      userId: user.id,
      fullName: "W4A Rehearsal",
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

  const afterCreate = await identity(user.id);
  if (!afterCreate.cp || !afterCreate.sp) {
    throw new Error("registration did not create both profiles");
  }
  if (afterCreate.cp.referralCode !== afterCreate.sp.referralCode) {
    throw new Error("referral codes diverged at registration");
  }
  if (afterCreate.cp.referralCode !== referralCode) {
    throw new Error("registration minted a different code than generated");
  }
  log("registration", {
    sameReferral: true,
    code: referralCode,
    collegeMirror: afterCreate.sp.college,
  });

  const lookedUp = await findUserIdByReferralCode(referralCode);
  if (lookedUp !== user.id) {
    throw new Error("referral lookup missed CandidateProfile");
  }

  await prisma.$transaction(async (tx) => {
    await applyCandidateIdentityChange(tx, user.id, {
      fullName: "W4A Rehearsal Edited",
      phone: "+919876543211",
      linkedinUrl: "https://linkedin.com/in/w4a",
      githubUsername: "w4a-rehearse",
      resumeUrl: "https://example.com/w4a.pdf",
    });
  });
  const afterEdit = await identity(user.id);
  if (afterEdit.cp?.fullName !== "W4A Rehearsal Edited") {
    throw new Error("canonical name not updated");
  }
  if (afterEdit.sp?.fullName !== "W4A Rehearsal Edited") {
    throw new Error("legacy name not mirrored");
  }
  if (afterEdit.cp?.referralCode !== referralCode) {
    throw new Error("profile edit reminted referral");
  }
  log("profile_edit", {
    name: afterEdit.cp?.fullName,
    phone: afterEdit.cp?.phone,
    linkedin: afterEdit.cp?.linkedinUrl,
    github: afterEdit.cp?.githubUsername,
    resume: afterEdit.cp?.resumeUrl,
    referralUnchanged: true,
  });

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
  const eduRows = await prisma.candidateEducation.count({ where: { userId: user.id } });
  const eduMirror = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { college: true },
  });
  if (eduRows !== 2) throw new Error(`expected 2 education rows, got ${eduRows}`);
  if (eduMirror?.college !== "Current Uni") {
    throw new Error(`primary education mirror ${eduMirror?.college}`);
  }
  log("education", { canonicalRows: eduRows, mirror: eduMirror?.college });

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
      startYear: 2024,
      endMonth: null,
      endYear: null,
      isCurrent: true,
      description: null,
    },
  ]);
  const expRows = await prisma.candidateExperience.count({ where: { userId: user.id } });
  const expMirror = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { organization: true },
  });
  if (expRows !== 2) throw new Error(`expected 2 experience rows, got ${expRows}`);
  if (expMirror?.organization !== "Now Co") {
    throw new Error(`primary experience mirror ${expMirror?.organization}`);
  }
  log("experience", { canonicalRows: expRows, mirror: expMirror?.organization });

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
        slug: `w4a-rehearse-${stamp}-${n}`,
        name: `W4A Skill ${n}`,
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
  const claimed = await prisma.candidateSkill.count({
    where: { userId: user.id, claimedByCandidate: true },
  });
  const skillMirror = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { skills: true },
  });
  if (claimed < 12) throw new Error(`expected ≥12 claimed skills, got ${claimed}`);
  if ((skillMirror?.skills.length ?? 0) < 12) {
    throw new Error("legacy skill mirror truncated");
  }
  log("skills_gt10", { claimed, mirrored: skillMirror?.skills.length });

  const evidenced = await prisma.candidateSkill.findFirst({
    where: { userId: user.id, claimedByCandidate: true },
    select: { id: true, skillId: true },
  });
  if (!evidenced) throw new Error("missing claimed skill for evidence");
  await prisma.skillEvidence.create({
    data: {
      candidateSkillId: evidenced.id,
      sourceType: EvidenceSourceType.EXTERNAL,
      sourceId: `w4a-${stamp}`,
      sourceLabel: "W4-A rehearsal",
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
  const withdrawn = await prisma.candidateSkill.findUnique({
    where: { id: evidenced.id },
    select: { claimedByCandidate: true, _count: { select: { evidence: true } } },
  });
  const afterWithdrawMirror = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { skills: true },
  });
  const withdrawnName = skills.find((s) => s.id === evidenced.skillId)?.name;
  if (!withdrawn || withdrawn.claimedByCandidate !== false) {
    throw new Error("evidenced skill was deleted or stayed claimed");
  }
  if (withdrawn._count.evidence < 1) throw new Error("evidence lost");
  if (withdrawnName && afterWithdrawMirror?.skills.includes(withdrawnName)) {
    throw new Error("withdrawn claimed name still in SP mirror");
  }
  log("skill_withdraw_evidence", {
    kept: true,
    claimedByCandidate: withdrawn.claimedByCandidate,
    evidence: withdrawn._count.evidence,
  });

  await saveEducation(user.id, []);
  await saveExperience(user.id, []);
  const emptied = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { college: true, organization: true },
  });
  if (emptied?.college !== null || emptied?.organization !== null) {
    throw new Error("empty section did not clear legacy mirror");
  }
  log("empty_section", { college: emptied.college, organization: emptied.organization });

  await saveEducation(user.id, [
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
  await saveEducation(user.id, [
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
  const retryEdu = await prisma.candidateEducation.count({ where: { userId: user.id } });
  if (retryEdu !== 1) throw new Error(`retry duplicated education: ${retryEdu}`);
  log("retry", { educationRows: retryEdu });

  const failUser = await prisma.user.create({
    data: { email: failEmail, name: "W4A Mirror Fail" },
    select: { id: true },
  });
  const failCode = await generateUniqueReferralCode();
  process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR = "1";
  await prisma.$transaction(async (tx) => {
    await createCandidateIdentity(tx, {
      userId: failUser.id,
      fullName: "W4A Mirror Fail",
      userType: UserType.STUDENT,
      referralCode: failCode,
      phone: null,
      phoneVerified: false,
      college: null,
      collegeId: null,
      organization: null,
      role: null,
      yearsExperience: null,
      headline: null,
      locationCity: null,
      locationRegion: null,
      countryCode: null,
      synergyPoints: 0,
    });
  });
  delete process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR;
  const failState = await identity(failUser.id);
  if (!failState.cp) throw new Error("mirror failure rolled back CandidateProfile");
  if (failState.sp) throw new Error("injected mirror failure still wrote StudentProfile");
  if (failState.cp.referralCode !== failCode) {
    throw new Error("mirror-failure path reminted referral");
  }
  log("mirror_failure", {
    candidateKept: true,
    studentAbsent: true,
    referral: failState.cp.referralCode,
  });

  log("persona_untouched", CandidatePersona.STUDENT);
  console.log("W4-A child rehearsal passed");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
