import { prisma } from "@/lib/db";

const REFERRAL_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomReferralCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += REFERRAL_CHARS[Math.floor(Math.random() * REFERRAL_CHARS.length)]!;
  }
  return out;
}

export async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomReferralCode();
    const onCandidate = await prisma.candidateProfile.findUnique({
      where: { referralCode: code },
      select: { userId: true },
    });
    if (!onCandidate) return code;
  }
  throw new Error("Could not generate unique referral code");
}
