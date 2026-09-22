/**
 * W4 candidate identity write boundary.
 *
 * Canonical writers are always CandidateProfile + structured candidate tables.
 * ENABLE_NEW_CANDIDATE_WRITES is ignored (Phase 8-D): frozen StudentProfile
 * identity rows must not become write authority.
 * StudentProfile identity/referral/profile fields are a compatibility mirror
 * only while ENABLE_LEGACY_STUDENT_PROFILE_MIRROR is not `"false"`.
 *
 * W4-B: setting the mirror flag to `"false"` freezes those W4-owned fields
 * on StudentProfile. Ambassador, domain, and other later-family columns
 * are not gated here. Does not touch Points, Visibility, or Credentials.
 */
import "server-only";
import {
  CandidatePersona,
  Prisma,
  UserType,
  type PrismaClient,
} from "@prisma/client";
import { logger } from "@/lib/logger";
import {
  educationIdForStudentProfile,
  experienceIdForStudentProfile,
  personaFromUserType,
} from "@/repositories/dual-write";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export type CandidateIdentityPatch = {
  fullName?: string;
  phone?: string | null;
  phoneVerified?: boolean;
  phoneVerifiedAt?: Date | null;
  linkedinUrl?: string | null;
  githubUsername?: string | null;
  resumeUrl?: string | null;
  userType?: UserType;
  isReadyForInterview?: boolean;
};

export type CreateCandidateIdentityInput = {
  userId: string;
  fullName: string;
  userType: UserType;
  referralCode: string;
  phone: string | null;
  phoneVerified: boolean;
  college: string | null;
  collegeId: string | null;
  organization: string | null;
  role: string | null;
  yearsExperience: number | null;
  headline: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  countryCode: string | null;
  synergyPoints: number;
};

function savepointName(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  return `spmir_${cleaned || "x"}`;
}

function shouldInjectStudentProfileMirrorFailure(): boolean {
  return process.env.STUDENT_PROFILE_FAIL_LEGACY_MIRROR === "1";
}

function studentProfileData(
  patch: CandidateIdentityPatch,
): Prisma.StudentProfileUpdateInput {
  const data: Prisma.StudentProfileUpdateInput = {};
  if (patch.fullName !== undefined) data.fullName = patch.fullName;
  if (patch.phone !== undefined) data.phone = patch.phone;
  if (patch.phoneVerified !== undefined) data.phoneVerified = patch.phoneVerified;
  if (patch.phoneVerifiedAt !== undefined) {
    data.phoneVerifiedAt = patch.phoneVerifiedAt;
  }
  if (patch.linkedinUrl !== undefined) data.linkedinUrl = patch.linkedinUrl;
  if (patch.githubUsername !== undefined) {
    data.githubUsername = patch.githubUsername;
  }
  if (patch.resumeUrl !== undefined) data.resumeUrl = patch.resumeUrl;
  if (patch.userType !== undefined) data.userType = patch.userType;
  if (patch.isReadyForInterview !== undefined) {
    data.isReadyForInterview = patch.isReadyForInterview;
  }
  return data;
}

function candidateProfileData(
  patch: CandidateIdentityPatch,
): Prisma.CandidateProfileUpdateInput {
  const data: Prisma.CandidateProfileUpdateInput = {};
  if (patch.fullName !== undefined) data.fullName = patch.fullName;
  if (patch.phone !== undefined) data.phone = patch.phone;
  if (patch.phoneVerified !== undefined) data.phoneVerified = patch.phoneVerified;
  if (patch.phoneVerifiedAt !== undefined) {
    data.phoneVerifiedAt = patch.phoneVerifiedAt;
  }
  if (patch.linkedinUrl !== undefined) data.linkedinUrl = patch.linkedinUrl;
  if (patch.githubUsername !== undefined) {
    data.githubUsername = patch.githubUsername;
  }
  if (patch.resumeUrl !== undefined) data.resumeUrl = patch.resumeUrl;
  if (patch.userType !== undefined) {
    data.primaryPersona = personaFromUserType(patch.userType);
  }
  if (patch.isReadyForInterview !== undefined) {
    data.isReadyForInterview = patch.isReadyForInterview;
  }
  return data;
}

/**
 * StudentProfile compatibility write for W4 identity/referral/profile fields.
 * When ENABLE_LEGACY_STUDENT_PROFILE_MIRROR is `"false"`, this is a no-op so
 * those columns stay frozen. Later-family writers (ambassador, domain) must
 * not go through this helper.
 */
export async function runStudentProfileMirror(
  tx: Tx,
  label: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  void tx; void label; void fn;
  return false;
}

/**
 * Live identity writes require a CandidateProfile. If only StudentProfile
 * exists (historical dual-write gap), copy identity/referral onto a new
 * CandidateProfile without minting a second referral code. Does not invent
 * profile data and does not bulk-heal idle rows.
 */
async function ensureCanonicalProfileForIdentityWrite(
  tx: Tx,
  userId: string,
): Promise<void> {
  const existing = await tx.candidateProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (existing) return;

  const sp = await tx.studentProfile.findUnique({
    where: { userId },
    select: {
      fullName: true,
      userType: true,
      referralCode: true,
      phone: true,
      phoneVerified: true,
      phoneVerifiedAt: true,
      linkedinUrl: true,
      githubUsername: true,
      resumeUrl: true,
      isReadyForInterview: true,
    },
  });
  if (!sp) {
    throw new Error(`Missing CandidateProfile for ${userId}`);
  }

  await tx.candidateProfile.create({
    data: {
      id: `cp_${userId}`,
      userId,
      fullName: sp.fullName,
      primaryPersona: personaFromUserType(sp.userType),
      phone: sp.phone,
      phoneVerified: sp.phoneVerified,
      phoneVerifiedAt: sp.phoneVerifiedAt,
      linkedinUrl: sp.linkedinUrl,
      githubUsername: sp.githubUsername,
      resumeUrl: sp.resumeUrl,
      referralCode: sp.referralCode,
      isReadyForInterview: sp.isReadyForInterview,
    },
  });
  logger.warn(
    "[candidate] hydrated CandidateProfile from StudentProfile on live identity write",
    { userId },
  );
}

/**
 * Overlapping identity scalars. Referral codes are never rewritten here.
 */
export async function applyCandidateIdentityChange(
  tx: Tx,
  userId: string,
  patch: CandidateIdentityPatch,
): Promise<{ mirrorFailed: boolean }> {
  await ensureCanonicalProfileForIdentityWrite(tx, userId);
  await tx.candidateProfile.update({
    where: { userId },
    data: candidateProfileData(patch),
  });
  const mirrorFailed = await runStudentProfileMirror(tx, "identity", async () => {
    await tx.studentProfile.updateMany({
      where: { userId },
      data: studentProfileData(patch),
    });
  });
  return { mirrorFailed };
}

async function createCanonicalIdentity(
  tx: Tx,
  input: CreateCandidateIdentityInput,
): Promise<string> {
  const persona = personaFromUserType(input.userType);
  const created = await tx.candidateProfile.create({
    data: {
      id: `cp_${input.userId}`,
      userId: input.userId,
      fullName: input.fullName,
      primaryPersona: persona,
      phone: input.phone,
      phoneVerified: input.phoneVerified,
      phoneVerifiedAt: input.phoneVerified ? new Date() : null,
      linkedinUrl: null,
      githubUsername: null,
      resumeUrl: null,
      referralCode: input.referralCode,
      headline: input.headline,
      locationCity: input.locationCity,
      locationRegion: input.locationRegion,
      countryCode: input.countryCode,
    },
    select: { id: true },
  });

  if (input.userType === UserType.STUDENT && (input.college || input.collegeId)) {
    await tx.candidateEducation.create({
      data: {
        id: educationIdForStudentProfile(input.userId),
        userId: input.userId,
        institutionName: input.college?.trim() || "Not specified",
        collegeId: input.collegeId,
        graduationYear: null,
        sortOrder: 0,
      },
    });
  }

  if (
    input.userType === UserType.PROFESSIONAL &&
    (input.organization || input.role || input.yearsExperience != null)
  ) {
    const years = input.yearsExperience ?? 0;
    await tx.candidateExperience.create({
      data: {
        id: experienceIdForStudentProfile(input.userId),
        userId: input.userId,
        companyName: input.organization?.trim() || "Not specified",
        title: input.role?.trim() || "Not specified",
        startedOn: new Date(
          Date.UTC(new Date().getUTCFullYear() - Math.max(years, 0), 0, 1),
        ),
        isCurrent: true,
        totalMonths: Math.max(0, years) * 12,
      },
    });
  }

  return created.id;
}

function studentProfileCreateData(
  input: CreateCandidateIdentityInput,
): Prisma.StudentProfileUncheckedCreateInput {
  const base = {
    userId: input.userId,
    fullName: input.fullName,
    userType: input.userType,
    domain: null as null,
    skills: [] as string[],
    linkedinUrl: null as null,
    githubUsername: null as null,
    phone: input.phone,
    phoneVerified: input.phoneVerified,
    referralCode: input.referralCode,
    synergyPoints: input.synergyPoints,
  };
  if (input.userType === UserType.STUDENT) {
    return {
      ...base,
      college: input.college,
      collegeId: input.collegeId,
      graduationYear: null,
      organization: null,
      role: null,
      yearsExperience: null,
    };
  }
  return {
    ...base,
    college: null,
    collegeId: null,
    graduationYear: null,
    organization: input.organization,
    role: input.role,
    yearsExperience: input.yearsExperience,
  };
}

/**
 * Registration identity create. Flag off keeps StudentProfile authoritative.
 * Flag on commits CandidateProfile first. When the W4 mirror is on,
 * StudentProfile is created as the compatibility snapshot. When the mirror
 * is off, registration succeeds with CandidateProfile only — a StudentProfile
 * row is not required for W4 identity. Referral code is the one already
 * generated against both namespaces.
 */
export async function createCandidateIdentity(
  tx: Tx,
  input: CreateCandidateIdentityInput,
): Promise<{ profileId: string; mirrorFailed: boolean }> {
  const profileId = await createCanonicalIdentity(tx, input);
  const mirrorFailed = await runStudentProfileMirror(
    tx,
    "registration",
    async () => {
      await tx.studentProfile.create({
        data: studentProfileCreateData(input),
      });
    },
  );
  return { profileId, mirrorFailed };
}

export function isCandidateWritesAuthoritative(): boolean {
  return true;
}

export type { Db };
