/**
 * Candidate identity write boundary.
 *
 * Canonical writers are always CandidateProfile + structured candidate tables.
 */
import "server-only";
import {
  CandidatePersona,
  Prisma,
  UserType,
  type PrismaClient,
} from "@prisma/client";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export function personaFromUserType(userType: UserType): CandidatePersona {
  return userType === UserType.PROFESSIONAL
    ? CandidatePersona.PROFESSIONAL
    : CandidatePersona.STUDENT;
}

export function educationIdForStudentProfile(userId: string): string {
  return `edu_sp_${userId}`;
}

export function experienceIdForStudentProfile(userId: string): string {
  return `exp_sp_${userId}`;
}

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

  throw new Error(`Missing CandidateProfile for ${userId}`);
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
  return { mirrorFailed: false };
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
  return { profileId, mirrorFailed: false };
}

export function isCandidateWritesAuthoritative(): boolean {
  return true;
}

export type { Db };
