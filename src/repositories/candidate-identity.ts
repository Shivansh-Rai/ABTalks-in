/**
 * W4-A candidate identity write boundary.
 *
 * ENABLE_NEW_CANDIDATE_WRITES off (dark deploy): StudentProfile stays the
 * write that dual-write copies onto CandidateProfile.
 * ENABLE_NEW_CANDIDATE_WRITES on: CandidateProfile (and structured rows)
 * commit first; StudentProfile is a compatibility mirror while
 * ENABLE_LEGACY_STUDENT_PROFILE_MIRROR is not `"false"`.
 *
 * Does not touch Points, Visibility, Credentials, or ambassador fields.
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
  isLegacyStudentProfileMirrorEnabled,
  isNewCandidateWritesEnabled,
} from "@/lib/feature-flags";
import {
  dualWriteCandidateBasicInfo,
  dualWriteCandidateIdentity,
  educationIdForStudentProfile,
  experienceIdForStudentProfile,
  personaFromUserType,
  type CandidateIdentitySubmitted,
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

function submittedFromPatch(
  patch: CandidateIdentityPatch,
): CandidateIdentitySubmitted {
  return {
    fullName: patch.fullName !== undefined,
    phone:
      patch.phone !== undefined ||
      patch.phoneVerified !== undefined ||
      patch.phoneVerifiedAt !== undefined,
    linkedinUrl: patch.linkedinUrl !== undefined,
    githubUsername: patch.githubUsername !== undefined,
    resumeUrl: patch.resumeUrl !== undefined,
    userType: patch.userType !== undefined,
    isReadyForInterview: patch.isReadyForInterview !== undefined,
  };
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
 * StudentProfile compatibility write. W4-A keeps this ON.
 * When candidate writes are authoritative, a mirror failure is logged and
 * does not roll back CandidateProfile (savepoint).
 */
export async function runStudentProfileMirror(
  tx: Tx,
  label: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  if (!isLegacyStudentProfileMirrorEnabled()) return false;
  if (!isNewCandidateWritesEnabled()) {
    await fn();
    return false;
  }
  if (shouldInjectStudentProfileMirrorFailure()) {
    logger.error("[candidate] legacy StudentProfile mirror failed; new candidate kept", {
      label,
      error: "STUDENT_PROFILE_FAIL_LEGACY_MIRROR",
    });
    return true;
  }
  const sp = savepointName(label);
  try {
    await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
    try {
      await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      return false;
    } catch (err) {
      try {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      } catch (rollbackErr) {
        logger.error("[candidate] student profile mirror rollback failed", {
          label,
          error: String(rollbackErr),
        });
      }
      logger.error(
        "[candidate] legacy StudentProfile mirror failed; new candidate kept",
        {
          label,
          error: err instanceof Error ? err.stack ?? err.message : String(err),
        },
      );
      return true;
    }
  } catch (err) {
    logger.error(
      "[candidate] legacy StudentProfile mirror failed; new candidate kept",
      {
        label,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      },
    );
    return true;
  }
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
  if (!isNewCandidateWritesEnabled()) {
    const data = studentProfileData(patch);
    const result = await tx.studentProfile.updateMany({
      where: { userId },
      data,
    });
    if (result.count > 0) {
      await dualWriteCandidateIdentity(tx, userId, submittedFromPatch(patch));
    }
    return { mirrorFailed: false };
  }

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
 * Flag on commits CandidateProfile first; StudentProfile is the compatibility
 * snapshot. Referral code is the one already generated against both namespaces.
 */
export async function createCandidateIdentity(
  tx: Tx,
  input: CreateCandidateIdentityInput,
): Promise<{ profileId: string; mirrorFailed: boolean }> {
  if (!isNewCandidateWritesEnabled()) {
    const profile = await tx.studentProfile.create({
      data: studentProfileCreateData(input),
      select: { id: true },
    });
    await dualWriteCandidateIdentity(tx, input.userId);
    await dualWriteCandidateBasicInfo(tx, input.userId, {
      headline: input.headline,
      locationCity: input.locationCity,
      locationRegion: input.locationRegion,
      countryCode: input.countryCode,
    });
    return { profileId: profile.id, mirrorFailed: false };
  }

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
  return isNewCandidateWritesEnabled();
}

export type { Db };
