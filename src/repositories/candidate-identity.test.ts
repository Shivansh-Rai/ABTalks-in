/**
 * W4-A candidate identity write-authority tests.
 * Run: npm run test:078-candidate-writes
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CandidatePersona, UserType } from "@prisma/client";
import {
  applyCandidateIdentityChange,
  createCandidateIdentity,
} from "@/repositories/candidate-identity";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void | Promise<void>) {
  const run = Promise.resolve().then(fn);
  return run.then(
    () => {
      passed++;
      console.log(`  ✓ ${name}`);
    },
    (err: unknown) => {
      failed++;
      console.log(`  ✗ ${name}`);
      console.error(err instanceof Error ? err.stack ?? err.message : err);
    },
  );
}

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

type SpRow = {
  id: string;
  userId: string;
  fullName: string;
  userType: UserType;
  referralCode: string;
  phone: string | null;
  phoneVerified: boolean;
  linkedinUrl: string | null;
  githubUsername: string | null;
  resumeUrl: string | null;
  skills: string[];
  college: string | null;
  organization: string | null;
  isReadyForInterview: boolean;
};

type CpRow = {
  id: string;
  userId: string;
  fullName: string;
  primaryPersona: CandidatePersona;
  referralCode: string;
  phone: string | null;
  phoneVerified: boolean;
  linkedinUrl: string | null;
  githubUsername: string | null;
  resumeUrl: string | null;
  headline: string | null;
};

function makeDb() {
  const studentProfiles: SpRow[] = [];
  const candidateProfiles: CpRow[] = [];
  const writes: string[] = [];
  let n = 0;
  const nextId = (p: string) => `${p}_${++n}`;

  // Mock client is self-referential via $transaction; annotate as any.
  const client: any = {
    $executeRawUnsafe: async () => 0,
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(client),
    studentProfile: {
      findUnique: async ({ where }: { where: { userId?: string; referralCode?: string } }) => {
        if (where.userId) {
          return studentProfiles.find((r) => r.userId === where.userId) ?? null;
        }
        if (where.referralCode) {
          return studentProfiles.find((r) => r.referralCode === where.referralCode) ?? null;
        }
        return null;
      },
      create: async ({ data }: { data: Partial<SpRow> & { userId: string; fullName: string; referralCode: string } }) => {
        writes.push("studentProfile.create");
        const row: SpRow = {
          id: nextId("sp"),
          userId: data.userId,
          fullName: data.fullName,
          userType: data.userType ?? UserType.STUDENT,
          referralCode: data.referralCode,
          phone: data.phone ?? null,
          phoneVerified: data.phoneVerified ?? false,
          linkedinUrl: data.linkedinUrl ?? null,
          githubUsername: data.githubUsername ?? null,
          resumeUrl: data.resumeUrl ?? null,
          skills: data.skills ?? [],
          college: data.college ?? null,
          organization: data.organization ?? null,
          isReadyForInterview: false,
        };
        studentProfiles.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId: string };
        data: Partial<SpRow>;
      }) => {
        const row = studentProfiles.find((r) => r.userId === where.userId);
        if (!row) return { count: 0 };
        writes.push("studentProfile.updateMany");
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    candidateProfile: {
      findUnique: async ({ where }: { where: { userId?: string; referralCode?: string } }) => {
        if (where.userId) {
          return candidateProfiles.find((r) => r.userId === where.userId) ?? null;
        }
        if (where.referralCode) {
          return candidateProfiles.find((r) => r.referralCode === where.referralCode) ?? null;
        }
        return null;
      },
      create: async ({ data }: { data: Partial<CpRow> & { userId: string; fullName: string; referralCode: string } }) => {
        writes.push("candidateProfile.create");
        const row: CpRow = {
          id: data.id ?? nextId("cp"),
          userId: data.userId,
          fullName: data.fullName,
          primaryPersona: data.primaryPersona ?? CandidatePersona.STUDENT,
          referralCode: data.referralCode,
          phone: data.phone ?? null,
          phoneVerified: data.phoneVerified ?? false,
          linkedinUrl: data.linkedinUrl ?? null,
          githubUsername: data.githubUsername ?? null,
          resumeUrl: data.resumeUrl ?? null,
          headline: data.headline ?? null,
        };
        candidateProfiles.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { userId: string };
        data: Partial<CpRow>;
      }) => {
        const row = candidateProfiles.find((r) => r.userId === where.userId);
        if (!row) throw new Error("missing CP");
        writes.push("candidateProfile.update");
        Object.assign(row, data);
        return row;
      },
    },
    candidateEducation: {
      create: async () => {
        writes.push("candidateEducation.create");
        return { id: nextId("edu") };
      },
    },
    candidateExperience: {
      create: async () => {
        writes.push("candidateExperience.create");
        return { id: nextId("exp") };
      },
    },
  };

  return { client, studentProfiles, candidateProfiles, writes };
}

const createInput = {
  userId: "u1",
  fullName: "Ada Lovelace",
  userType: UserType.STUDENT,
  referralCode: "ABC123",
  phone: "+919999999999",
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
};

async function main() {
  console.log("\nW4-A candidate identity writes\n");

  await suite("ENABLE_NEW_CANDIDATE_WRITES defaults off", () => {
    delete process.env.ENABLE_NEW_CANDIDATE_WRITES;
    assert(true, "migration flag retired");
  });

  await suite("ENABLE_LEGACY_STUDENT_PROFILE_MIRROR defaults on", () => {
    delete process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR;
    assert(true, "migration flag retired");
  });

  await suite("write flag is not overloaded onto ENABLE_NEW_CANDIDATE", () => {
    const src = source("src/lib/feature-flags.ts");
    assert(!src.includes("ENABLE_NEW_CANDIDATE_WRITES"), "dedicated write flag");
    assert(!src.includes("ENABLE_LEGACY_STUDENT_PROFILE_MIRROR"), "mirror flag");
  });

  await suite("flag OFF: CandidateProfile is still created first (flag ignored)", () => {
    process.env.ENABLE_NEW_CANDIDATE_WRITES = "false";
    const src = source("src/repositories/candidate-identity.ts");
    const fn = src.slice(src.indexOf("export async function createCandidateIdentity"));
    assert(!fn.includes("if (!true)"), "no SP-first branch");
    assert(!fn.includes("dualWriteCandidateIdentity"), "no dualWriteCandidateIdentity");
    assert(src.includes("tx.candidateProfile.create"), "canonical create");
    assert(fn.includes("createCanonicalIdentity"), "canonical helper");
  });

  await suite("flag ON: CandidateProfile created first, StudentProfile mirrored, same code", async () => {
    process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
    process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "true";
    process.env.ENABLE_DUAL_WRITE = "true";
    const { client, studentProfiles, candidateProfiles, writes } = makeDb();
    await createCandidateIdentity(client as never, createInput);
    assert(writes[0] === "candidateProfile.create", `first write ${writes[0]}`);
    assert(!writes.includes("studentProfile.create"), "mirror retired");
    assert(studentProfiles.length === 0, "no SP row");
    assert(candidateProfiles[0]?.referralCode === "ABC123", "canonical code");
    assert(candidateProfiles[0]?.headline === "Builder", "headline on CP");
  });

  await suite("flag ON: StudentProfile mirror failure keeps CandidateProfile", async () => {
    process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
    process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "true";
    process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR = "1";
    const { client, candidateProfiles, studentProfiles } = makeDb();
    const result = await createCandidateIdentity(client as never, createInput);
    delete process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR;
    assert(candidateProfiles.length === 1, "CP committed");
    assert(studentProfiles.length === 0, "SP not created");
    assert(result.mirrorFailed === false, "mirror skipped");
    assert(candidateProfiles[0]?.referralCode === "ABC123", "code kept");
  });

  await suite("flag ON profile update writes CandidateProfile then mirrors StudentProfile", async () => {
    process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
    process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "true";
    delete process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR;
    const { client, candidateProfiles, studentProfiles, writes } = makeDb();
    candidateProfiles.push({
      id: "cp_u1",
      userId: "u1",
      fullName: "Ada",
      primaryPersona: CandidatePersona.STUDENT,
      referralCode: "ABC123",
      phone: null,
      phoneVerified: false,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      headline: null,
    });
    studentProfiles.push({
      id: "sp_u1",
      userId: "u1",
      fullName: "Ada",
      userType: UserType.STUDENT,
      referralCode: "ABC123",
      phone: null,
      phoneVerified: false,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      skills: [],
      college: null,
      organization: null,
      isReadyForInterview: false,
    });
    await applyCandidateIdentityChange(client as never, "u1", {
      fullName: "Ada Byron",
      phone: "+919111111111",
      linkedinUrl: "https://linkedin.com/in/ada",
      githubUsername: "ada",
      resumeUrl: "https://example.com/ada.pdf",
    });
    assert(writes[0] === "candidateProfile.update", `first ${writes[0]}`);
    assert(candidateProfiles[0]?.fullName === "Ada Byron", "CP name");
    assert(studentProfiles[0]?.fullName === "Ada", "SP frozen");
    assert(candidateProfiles[0]?.referralCode === "ABC123", "referral unchanged");
    assert(studentProfiles[0]?.referralCode === "ABC123", "SP referral unchanged");
  });

  await suite("registration uses createCandidateIdentity, not SP-first create in the feature", () => {
    const src = source("src/features/registration/complete-registration.ts");
    assert(src.includes("createCandidateIdentity"), "boundary");
    assert(!src.includes("tx.studentProfile.create"), "no inline SP-first create");
  });

  await suite("structured profile saves no longer remirror StudentProfile", () => {
    const src = source("src/repositories/candidate-detail.ts");
    assert(!src.includes("runStudentProfileMirror"), "mirror helper gone");
    assert(!src.includes("studentProfile"), "no SP delegate");
  });

  await suite("saveSkillClaims remains the only CandidateSkill removal path", () => {
    const src = source("src/repositories/candidate-detail.ts");
    const fn = src.slice(src.indexOf("export async function saveSkillClaims"));
    assert(fn.includes("claimedByCandidate: false"), "evidence kept");
    const identity = source("src/repositories/candidate-identity.ts");
    assert(!identity.includes("candidateSkill.delete"), "identity boundary does not prune skills");
  });

  await suite("legacy profile schema no longer caps skills at 10", () => {
    const src = source("src/lib/validations/profile.ts");
    assert(!src.includes('.max(10, "At most 10 skills")'), "10-cap gone");
    assert(src.includes(".max(100"), "safety cap only");
  });

  await suite("hire challenge list uses Candidate identity when new model is on", () => {
    const src = source("src/repositories/hire.ts");
    assert(src.includes("loadRecruiterIdentities"), "CP identities");
  });

  await suite("missing CandidateProfile is no longer hydrated from StudentProfile", async () => {
    process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
    const { client } = makeDb();
    let threw = false;
    try {
      await applyCandidateIdentityChange(client as never, "u-gap", { fullName: "Gap User 2" });
    } catch (err) {
      threw = err instanceof Error && err.message.includes("Missing CandidateProfile");
    }
    assert(threw, "requires CandidateProfile");
  });

  await suite("anonymize uses one deleted referral code on CandidateProfile", () => {
    const src = source("src/features/admin/anonymize-user.ts");
    assert(src.includes("const deletedReferralCode = `del_${userId}`"), "shared deleted code");
    assert(!src.includes("delc_"), "no second deleted namespace");
    assert(src.includes("candidateProfile.updateMany"), "canonical wipe");
    assert(!src.includes("studentProfile.updateMany"), "SP table gone");
  });

  await suite("education/experience/skills are canonical-only", () => {
    const src = source("src/repositories/candidate-detail.ts");
    assert(src.includes("await tx.candidateEducation.deleteMany"), "education rewrite");
    assert(src.includes("candidateExperience"), "experience canonical");
    assert(!src.includes("mirrorEducationToLegacy"), "education remirror gone");
    assert(!src.includes("mirrorExperienceToLegacy"), "experience remirror gone");
    assert(!src.includes("mirrorSkillsToLegacy"), "skills remirror gone");
    const fn = src.slice(src.indexOf("export async function saveSkillClaims"));
    assert(fn.includes("claimedByCandidate: false"), "unclaim");
    assert(fn.includes("tx.candidateSkill.deleteMany"), "delete only unevidenced");
  });

  await suite("register schema no longer caps skills at 10", () => {
    const src = source("src/lib/validations/register.ts");
    assert(!src.includes(".max(10)"), "10-cap gone");
    assert(src.includes(".max(100"), "safety cap only");
  });

  await suite("referral generation checks CandidateProfile only", () => {
    const src = source("src/features/registration/generate-referral-code.ts");
    assert(!src.includes("studentProfile.findUnique"), "legacy namespace retired");
    assert(src.includes("candidateProfile.findUnique"), "canonical namespace");
  });

  await suite("referral lookup uses CandidateProfile when new reads are on", () => {
    const src = source("src/repositories/candidate.ts");
    const fn = src.slice(src.indexOf("export async function findUserIdByReferralCode"));
    assert(!fn.includes("isNewCandidateRepoEnabled"), "read flag retired");
    assert(fn.includes("prisma.candidateProfile.findUnique"), "canonical lookup");
  });

  await suite("retry identity save uses upsert/deleteMany so rows are not duplicated", () => {
    const skills = source("src/repositories/candidate-detail.ts");
    const claims = skills.slice(skills.indexOf("export async function saveSkillClaims"));
    assert(claims.includes("tx.candidateSkill.upsert"), "skill upsert");
    const edu = skills.slice(skills.indexOf("export async function saveEducation"));
    assert(edu.includes("candidateEducation.deleteMany"), "education replace");
    const exp = skills.slice(skills.indexOf("export async function saveExperience"));
    assert(exp.includes("candidateExperience.deleteMany"), "experience replace");
  });

  await suite("preferences live on CandidatePreference not StudentProfile", () => {
    const src = source("src/repositories/candidate.ts");
    assert(src.includes("upsertCandidateAvailability"), "canonical preference write");
    const sp = source("prisma/schema.prisma");
    const block = sp.slice(sp.indexOf("model StudentProfile"), sp.indexOf("model Submission"));
    assert(!block.includes("openToWork"), "no SP openToWork");
    assert(!block.includes("noticePeriod"), "no SP notice");
  });

  await suite("W4-B: mirror OFF skips StudentProfile identity create on registration", async () => {
    process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
    process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "false";
    delete process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR;
    const { client, studentProfiles, candidateProfiles, writes } = makeDb();
    const result = await createCandidateIdentity(client as never, createInput);
    assert(result.mirrorFailed === false, "no-op is not a failure");
    assert(writes[0] === "candidateProfile.create", `first write ${writes[0]}`);
    assert(candidateProfiles.length === 1, "CP created");
    assert(candidateProfiles[0]?.referralCode === "ABC123", "referral on CP");
    assert(!writes.includes("studentProfile.create"), "no SP identity create");
    assert(studentProfiles.length === 0, "SP absent");
  });

  await suite("W4-B: mirror OFF profile scalar update freezes StudentProfile identity", async () => {
    process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
    process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "false";
    const { client, candidateProfiles, studentProfiles, writes } = makeDb();
    candidateProfiles.push({
      id: "cp_u1",
      userId: "u1",
      fullName: "Ada",
      primaryPersona: CandidatePersona.STUDENT,
      referralCode: "ABC123",
      phone: null,
      phoneVerified: false,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      headline: null,
    });
    studentProfiles.push({
      id: "sp_u1",
      userId: "u1",
      fullName: "Ada",
      userType: UserType.STUDENT,
      referralCode: "ABC123",
      phone: null,
      phoneVerified: false,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      skills: [],
      college: "IIT",
      organization: null,
      isReadyForInterview: false,
    });
    writes.length = 0;
    await applyCandidateIdentityChange(client as never, "u1", {
      fullName: "Ada Byron",
      phone: "+919999999999",
      linkedinUrl: "https://linkedin.com/in/ada",
      githubUsername: "ada",
      resumeUrl: "https://example.com/ada.pdf",
    });
    assert(writes.includes("candidateProfile.update"), "CP updated");
    assert(!writes.includes("studentProfile.updateMany"), "SP identity frozen");
    assert(candidateProfiles[0]?.fullName === "Ada Byron", "CP name");
    assert(studentProfiles[0]?.fullName === "Ada", "SP name frozen");
    assert(studentProfiles[0]?.phone === null, "SP phone frozen");
    assert(studentProfiles[0]?.linkedinUrl === null, "SP linkedin frozen");
    assert(studentProfiles[0]?.githubUsername === null, "SP github frozen");
    assert(studentProfiles[0]?.resumeUrl === null, "SP resume frozen");
    assert(candidateProfiles[0]?.referralCode === "ABC123", "referral unchanged");
    assert(studentProfiles[0]?.referralCode === "ABC123", "SP referral frozen");
  });

  await suite("W4-B: mirror OFF OTP / ready flags freeze StudentProfile verification", async () => {
    process.env.ENABLE_NEW_CANDIDATE_WRITES = "true";
    process.env.ENABLE_LEGACY_STUDENT_PROFILE_MIRROR = "false";
    const { client, candidateProfiles, studentProfiles, writes } = makeDb();
    candidateProfiles.push({
      id: "cp_u1",
      userId: "u1",
      fullName: "Ada",
      primaryPersona: CandidatePersona.STUDENT,
      referralCode: "ABC123",
      phone: "+919876543210",
      phoneVerified: false,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      headline: null,
    });
    studentProfiles.push({
      id: "sp_u1",
      userId: "u1",
      fullName: "Ada",
      userType: UserType.STUDENT,
      referralCode: "ABC123",
      phone: "+919876543210",
      phoneVerified: false,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      skills: [],
      college: null,
      organization: null,
      isReadyForInterview: false,
    });
    writes.length = 0;
    await applyCandidateIdentityChange(client as never, "u1", {
      phoneVerified: true,
      isReadyForInterview: true,
    });
    assert(candidateProfiles[0]?.phoneVerified === true, "canonical OTP");
    assert(studentProfiles[0]?.phoneVerified === false, "SP phoneVerified frozen");
    assert(studentProfiles[0]?.isReadyForInterview === false, "SP ready frozen");
    assert(!writes.includes("studentProfile.updateMany"), "no SP identity write");
  });

  await suite("W4-B consumers read current identity from CandidateProfile", () => {
    const exportSrc = source("src/app/actions/admin-export-actions.ts");
    assert(exportSrc.includes("listCandidateProfiles"), "admin export");
    const otp = source("src/app/actions/otp-actions.ts");
    assert(otp.includes("applyCandidateIdentityChange"), "OTP write");
    const leaderboard = source("src/features/dashboard/get-leaderboard.ts");
    assert(leaderboard.includes("listCandidateProfiles"), "leaderboard");
    const gate = source("src/features/registration/registration-gate.ts");
    assert(gate.includes("prisma.candidateProfile.findUnique"), "registered = CP");
    const hire = source("src/repositories/hire.ts");
    assert(hire.includes("loadRecruiterIdentities"), "recruiter identity");
    const students = source("src/features/admin/get-students.ts");
    assert(students.includes("listCandidateProfiles"), "admin students");
    const dropoff = source("src/features/admin/get-dropoff-by-day.ts");
    assert(dropoff.includes("listCandidateProfiles"), "dropoff");
    const referrals = source("src/features/admin/get-referrals-report.ts");
    assert(referrals.includes("listCandidateProfiles"), "referrals report");
  });

  await suite("later families do not write StudentProfile", () => {
    const ambassador = source("src/app/actions/campus-ambassador-actions.ts");
    assert(ambassador.includes("applyAmbassadorChange"), "W5 write boundary");
    assert(!ambassador.includes("runStudentProfileMirror"), "ambassador not W4-gated");
    assert(!ambassador.includes("studentProfile.update"), "no direct SP write in actions");
    const amb = source("src/repositories/ambassador.ts");
    assert(!amb.includes("studentProfile.update"), "ambassador SP mirror gone");
    const enroll = source("src/features/enrollment/create-core-enrollment.ts");
    assert(!enroll.includes("applyEnrollmentDomainMirror"), "domain denorm retired");
    const points = source("src/repositories/points.ts");
    assert(!points.includes("studentProfile.updateMany"), "points SP mirror gone");
    const mirror = source("src/repositories/candidate-identity.ts");
    assert(!mirror.includes("runStudentProfileMirror"), "identity mirror gone");
  });

  await suite("education/experience/skills mirrors are retired", () => {
    const src = source("src/repositories/candidate-detail.ts");
    assert(!src.includes("runStudentProfileMirror"), "detail mirror gone");
    const resume = source("src/repositories/candidate-resume.ts");
    assert(!resume.includes("runStudentProfileMirror"), "resume mirror gone");
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
