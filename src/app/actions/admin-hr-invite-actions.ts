"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { createHrInvite } from "@/features/hire/hr-invite";
import { sendHrInviteEmail } from "@/features/email/hr-invite-email";

/**
 * Plan 194 — invite one HR to trial the recruiter desk.
 *
 * Admin only. Issuing a sign-in link is a deliberate act by a person: there is
 * no self-serve path to this and no bulk import, because every invite creates
 * a real recruiter account that can see real candidates.
 */
const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
  name: z.string().trim().min(1, "Enter the recruiter's name.").max(120),
  company: z.string().trim().min(1, "Enter their company.").max(120),
});

export type InviteHrResult =
  | { ok: true; data: { email: string; expiresAt: string } }
  | { ok: false; message: string };

export async function inviteHrAction(
  input: z.input<typeof InviteSchema>,
): Promise<InviteHrResult> {
  await requireAdmin();

  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the details.",
    };
  }

  const invite = await createHrInvite(parsed.data);
  if (!invite.ok) return invite;

  const sent = await sendHrInviteEmail({
    to: invite.data.email,
    name: parsed.data.name,
    token: invite.data.token,
    expiresAt: invite.data.expiresAt,
  });

  if (!sent.ok) {
    // The account and the link both exist; only delivery failed. Say so
    // plainly rather than reporting success — an admin who thinks the mail
    // went out will wait for a reply that cannot come.
    logger.error("[hr-invite] the invite email could not be delivered", {
      deliveryId: sent.deliveryId,
      reason: sent.reason,
    });
    return {
      ok: false,
      message:
        "The workspace was created but the email could not be sent. Try again to issue a fresh link.",
    };
  }

  return {
    ok: true,
    data: {
      email: invite.data.email,
      expiresAt: invite.data.expiresAt.toISOString(),
    },
  };
}
