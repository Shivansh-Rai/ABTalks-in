"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/db";
import { adminRecruiterActionSchema } from "@/lib/validations/talent";

type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function approveRecruiterAction(
  input: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = adminRecruiterActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid application." };

  const profile = await prisma.recruiterProfile.findUnique({
    where: { id: parsed.data.recruiterProfileId },
    select: {
      id: true,
      approved: true,
      fullName: true,
      user: { select: { id: true, email: true } },
    },
  });

  if (!profile) return { ok: false, message: "Application not found." };
  if (profile.approved) return { ok: false, message: "Already approved." };

  await prisma.$transaction(async (tx) => {
    await tx.recruiterProfile.update({
      where: { id: profile.id },
      data: {
        approved: true,
        approvedAt: new Date(),
        approvedByAdminId: admin.userId,
      },
    });
    await tx.adminAction.create({
      data: {
        adminUserId: admin.userId,
        targetUserId: profile.user.id,
        actionType: "PROGRAM_APPROVE_RECRUITER",
        metadata: { recruiterProfileId: profile.id },
      },
    });
  });

  const talentUrl =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://abtalks.in";
  await sendEmail({
    to: profile.user.email,
    subject: "Your ABTalks recruiter access is approved",
    html: `<p>Hi ${profile.fullName},</p><p>Your recruiter application has been approved. Once cohort results are published, you can browse the talent pool at <a href="${talentUrl}/talent">${talentUrl}/talent</a>.</p><p>— ABTalks</p>`,
    text: `Hi ${profile.fullName},\n\nYour recruiter application has been approved. Browse the talent pool at ${talentUrl}/talent once results are published.\n\n— ABTalks`,
  });

  revalidatePath("/admin/program/recruiters");
  revalidatePath("/talent");
  return { ok: true };
}

export async function rejectRecruiterAction(
  input: unknown,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = adminRecruiterActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid application." };

  const profile = await prisma.recruiterProfile.findUnique({
    where: { id: parsed.data.recruiterProfileId },
    select: {
      id: true,
      approved: true,
      fullName: true,
      user: { select: { id: true, email: true } },
    },
  });

  if (!profile) return { ok: false, message: "Application not found." };
  if (profile.approved) {
    return { ok: false, message: "Cannot reject an approved recruiter." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.recruiterProfile.delete({ where: { id: profile.id } });
    await tx.user.update({
      where: { id: profile.user.id },
      data: { role: "STUDENT" },
    });
  });

  await sendEmail({
    to: profile.user.email,
    subject: "Update on your ABTalks recruiter application",
    html: `<p>Hi ${profile.fullName},</p><p>Thank you for your interest in recruiting through ABTalks. We are unable to approve your application at this time. You are welcome to re-apply later with an updated profile.</p><p>— ABTalks</p>`,
    text: `Hi ${profile.fullName},\n\nThank you for your interest. We are unable to approve your recruiter application at this time.\n\n— ABTalks`,
  });

  revalidatePath("/admin/program/recruiters");
  return { ok: true };
}
