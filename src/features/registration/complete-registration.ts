import { UserType } from "@prisma/client";
import { clearRefCookie } from "@/lib/cookies";
import { isOtpVerificationRequired } from "@/lib/feature-flags";
import type { RegisterPayloadInput } from "@/lib/validations/register";
import { INDIA_DIALING_CODE, toE164 } from "@/lib/validations/phone";
import { prisma, writeClient } from "@/lib/db";
import { awardReferralSynergy } from "@/features/synergy/award-referral-synergy";
import { recordLegalConsents } from "@/features/legal/record-consent";
import { recordNewsletterOptIn } from "@/features/legal/record-newsletter-optin";
import { generateUniqueReferralCode } from "./generate-referral-code";
import { studentProfile } from "@/repositories/legacy/student-profile";
import { findUserIdByReferralCode } from "@/repositories/candidate";
import {
  dualWriteCandidateBasicInfo,
  dualWriteCandidateIdentity,
} from "@/repositories/dual-write";
import { lockWalletBalance, withLegacyPointsMirrorFlush } from "@/repositories/points";

export type CompleteRegistrationResult =
  | { ok: true; profileId: string }
  | { ok: false; reason: "already_registered"; message: string }
  | { ok: false; reason: "internal_error"; message: string };

export async function completeRegistration(
  userId: string,
  input: RegisterPayloadInput,
  opts?: { email?: string | null },
): Promise<CompleteRegistrationResult> {
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!userExists) {
    return {
      ok: false,
      reason: "internal_error",
      message: "Your session has expired. Please sign out and sign in again.",
    };
  }

  const existingProfile = await studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (existingProfile) {
    return {
      ok: false,
      reason: "already_registered",
      message: "You are already registered.",
    };
  }

  let referrerId: string | null = null;
  if (input.referralCode) {
    const matchingUserId = await findUserIdByReferralCode(input.referralCode);
    if (matchingUserId && matchingUserId !== userId) {
      referrerId = matchingUserId;
    } else if (!matchingUserId) {
      console.warn(
        "[registration] invalid referral code skipped:",
        input.referralCode,
      );
    }
  }

  let newReferralCode: string;
  try {
    newReferralCode = await generateUniqueReferralCode();
  } catch {
    return {
      ok: false,
      reason: "internal_error",
      message: "Could not assign a referral code. Try again.",
    };
  }

  const phone =
    input.phoneNumber && input.phoneNumber.trim() !== ""
      ? toE164(input.phoneCountryCode, input.phoneNumber)
      : null;

  // India (+91) requires a phone that has been OTP-verified (production).
  // Under next dev, OTP is skipped — persist the phone as unverified.
  // Re-check the verification server-side — never trust the client.
  let phoneVerified = false;
  if (input.phoneCountryCode === INDIA_DIALING_CODE) {
    if (!phone) {
      return {
        ok: false,
        reason: "internal_error",
        message: "Phone number is required.",
      };
    }
    if (isOtpVerificationRequired()) {
      const verification = await prisma.phoneVerification.findUnique({
        where: { userId },
        select: { phone: true, verified: true },
      });
      if (!verification || !verification.verified || verification.phone !== phone) {
        return {
          ok: false,
          reason: "internal_error",
          message: "Please verify your phone number to continue.",
        };
      }
      phoneVerified = true;
    }
  }

  try {
    const profileId = await writeClient().$transaction(async (tx) => {
      // Lock the authoritative wallet before copying it onto the SP mirror
      // so a simultaneous grant cannot leave the two balances out of sync.
      const synergyPoints = await lockWalletBalance(tx, userId);

      // `graduationYear`, `skills`, `linkedinUrl` and `githubUsername` are left
      // empty on purpose: the form no longer asks for them and the résumé merge
      // fills them in straight after this, through the candidate tables. Writing
      // a placeholder here would make the merge think the candidate had already
      // answered — the merge only ever fills what is empty.
      const profile = await tx.studentProfile.create({
        data:
          input.userType === UserType.STUDENT
            ? {
                userId,
                fullName: input.fullName,
                userType: UserType.STUDENT,
                college: input.college,
                collegeId: input.collegeId || null,
                graduationYear: null,
                organization: null,
                role: null,
                yearsExperience: null,
                domain: null,
                skills: [],
                linkedinUrl: null,
                phone,
                phoneVerified,
                githubUsername: null,
                referralCode: newReferralCode,
                synergyPoints,
              }
            : {
                userId,
                fullName: input.fullName,
                userType: UserType.PROFESSIONAL,
                college: null,
                collegeId: null,
                graduationYear: null,
                organization: input.organization,
                role: input.role,
                yearsExperience: input.yearsExperience,
                domain: null,
                skills: [],
                linkedinUrl: null,
                phone,
                phoneVerified,
                githubUsername: null,
                referralCode: newReferralCode,
                synergyPoints,
              },
      });

      await dualWriteCandidateIdentity(tx, userId);
      // Runs second: the identity dual-write is what creates the
      // CandidateProfile row these four columns live on.
      await dualWriteCandidateBasicInfo(tx, userId, {
        headline: input.headline,
        locationCity: input.locationCity,
        locationRegion: input.locationRegion,
        countryCode: input.countryCode,
      });

      return profile.id;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    if (referrerId) {
      try {
        await withLegacyPointsMirrorFlush(() =>
          writeClient().$transaction(async (tx) => {
          const referral = await tx.referral.create({
            data: {
              referrerId,
              referredId: userId,
              rewardGiven: false,
            },
            select: { id: true },
          });
          await awardReferralSynergy(tx, {
            referrerId,
            referralId: referral.id,
            referredUserId: userId,
          });
        }),
        );
      } catch (error) {
        console.error("[registration] referral creation failed:", error);
      }
    }

    await recordLegalConsents({
      userId,
      email: opts?.email,
      source: "register",
    });

    await recordNewsletterOptIn({
      userId: userId,
      email: opts?.email,
      source: "register",
      optIn: input.newsletterOptIn === true,
    });

    await clearRefCookie();

    return { ok: true, profileId };
  } catch (e) {
    console.error("[registration] transaction failed:", e);
    return {
      ok: false,
      reason: "internal_error",
      message: "Something went wrong. Please try again.",
    };
  }
}
