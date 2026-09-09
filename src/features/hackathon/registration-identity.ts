import "server-only";
import { prisma } from "@/lib/db";

/**
 * What the register popup still has to ask a signed-in student.
 *
 * Name, email and WhatsApp number are already on the account by the time
 * anyone reaches /hackathon — /register collects and OTP-verifies the phone —
 * so re-typing them in the popup was busywork, and showing the email back was
 * noise. Only `college` and `graduationYear` are genuinely new, and even those
 * are pre-filled when the profile already carries them.
 *
 * `needsPhone` is the one escape hatch: an account that reached /hackathon
 * without going through /register (a straight Google sign-in, say) can have no
 * profile at all, and `HackathonParticipant.phone` is NOT NULL. Rather than
 * write an empty string and lose the only way to reach that participant, the
 * popup asks for the number in that case alone.
 */
export type RegistrationPrefill = {
  college: string;
  graduationYear: number | null;
  needsPhone: boolean;
};

/** What we assume when there is no profile to read. */
export const EMPTY_PREFILL: RegistrationPrefill = {
  college: "",
  graduationYear: null,
  needsPhone: true,
};

export async function getRegistrationPrefill(
  userId: string,
): Promise<RegistrationPrefill> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { college: true, graduationYear: true, phone: true },
  });
  if (!profile) return EMPTY_PREFILL;

  return {
    college: profile.college?.trim() ?? "",
    graduationYear: profile.graduationYear ?? null,
    needsPhone: (profile.phone ?? "").trim().length === 0,
  };
}

/**
 * Name and phone the server writes onto the participant row. The client never
 * sends either: they come from the profile (falling back to the session name),
 * so a tampered payload cannot register someone under a different identity.
 */
export async function getParticipantIdentity(
  userId: string,
  sessionName: string,
): Promise<{ fullName: string; phone: string }> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { fullName: true, phone: true },
  });

  return {
    fullName: (profile?.fullName ?? sessionName ?? "").trim(),
    phone: (profile?.phone ?? "").trim(),
  };
}
