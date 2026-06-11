"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  achievementsSchema,
  certificationsSchema,
  educationListSchema,
  projectsSchema,
} from "@/lib/validations/recruiter";

function revalidateAdminViews(targetUserId: string) {
  revalidatePath(`/admin/students/${targetUserId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/students");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/analytics");
  revalidatePath("/dashboard");
  revalidatePath(`/students/${targetUserId}`);
  revalidatePath("/challenge");
  revalidatePath("/quiz");
  revalidatePath("/register");
}

const ratingSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(5)
  .nullable()
  .optional();
const tagArraySchema = z.array(z.string().trim().min(1).max(60)).max(10);

const upsertSchema = z.object({
  userId: z.string().min(1),
  confidenceRating: ratingSchema,
  codingRating: ratingSchema,
  communicationRating: ratingSchema,
  headline: z.string().max(200).optional(),
  summary: z.string().max(2000).optional(),
  adminNote: z.string().max(2000).optional(),
  strengths: tagArraySchema.optional(),
  recommendedRoles: tagArraySchema.optional(),
  projects: projectsSchema.optional(),
  education: educationListSchema.optional(),
  achievements: achievementsSchema.optional(),
  certifications: certificationsSchema.optional(),
});

const userIdSchema = z.object({ userId: z.string().min(1) });

function generateShareToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function upsertRecruiterReviewAction(
  input: z.infer<typeof upsertSchema>,
) {
  const admin = await requireAdmin();
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { userId, ...data } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.recruiterReview.upsert({
        where: { userId },
        create: {
          userId,
          confidenceRating: data.confidenceRating ?? null,
          codingRating: data.codingRating ?? null,
          communicationRating: data.communicationRating ?? null,
          headline: data.headline ?? null,
          summary: data.summary ?? null,
          adminNote: data.adminNote ?? null,
          strengths: data.strengths ?? [],
          recommendedRoles: data.recommendedRoles ?? [],
          projects: data.projects ?? [],
          education: data.education ?? [],
          achievements: data.achievements ?? [],
          certifications: data.certifications ?? [],
          reviewedByAdminId: admin.userId,
          reviewedAt: new Date(),
        },
        update: {
          confidenceRating: data.confidenceRating ?? null,
          codingRating: data.codingRating ?? null,
          communicationRating: data.communicationRating ?? null,
          headline: data.headline ?? null,
          summary: data.summary ?? null,
          adminNote: data.adminNote ?? null,
          strengths: data.strengths ?? [],
          recommendedRoles: data.recommendedRoles ?? [],
          projects: data.projects ?? [],
          education: data.education ?? [],
          achievements: data.achievements ?? [],
          certifications: data.certifications ?? [],
          reviewedByAdminId: admin.userId,
          reviewedAt: new Date(),
        },
      });

      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          targetUserId: userId,
          actionType: "RECRUITER_REVIEW_UPDATED",
        },
      });
    });

    revalidateAdminViews(userId);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to save review",
    };
  }
}

export async function publishRecruiterProfileAction(input: { userId: string }) {
  const admin = await requireAdmin();
  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { userId } = parsed.data;

  try {
    const shareToken = await prisma.$transaction(async (tx) => {
      const existing = await tx.recruiterReview.findUnique({
        where: { userId },
        select: { shareToken: true },
      });

      const token = existing?.shareToken ?? generateShareToken();

      await tx.recruiterReview.upsert({
        where: { userId },
        create: {
          userId,
          shareToken: token,
          isPublished: true,
          reviewedByAdminId: admin.userId,
          reviewedAt: new Date(),
        },
        update: {
          shareToken: token,
          isPublished: true,
        },
      });

      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          targetUserId: userId,
          actionType: "RECRUITER_PROFILE_PUBLISHED",
        },
      });

      return token;
    });

    revalidateAdminViews(userId);
    return { ok: true as const, data: { shareToken } };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to publish profile",
    };
  }
}

export async function unpublishRecruiterProfileAction(input: { userId: string }) {
  const admin = await requireAdmin();
  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { userId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.recruiterReview.update({
        where: { userId },
        data: { isPublished: false },
      });

      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          targetUserId: userId,
          actionType: "RECRUITER_PROFILE_UNPUBLISHED",
        },
      });
    });

    revalidateAdminViews(userId);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to unpublish profile",
    };
  }
}

export async function regenerateShareTokenAction(input: { userId: string }) {
  const admin = await requireAdmin();
  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { userId } = parsed.data;

  try {
    const shareToken = await prisma.$transaction(async (tx) => {
      const token = generateShareToken();

      await tx.recruiterReview.update({
        where: { userId },
        data: { shareToken: token },
      });

      await tx.adminAction.create({
        data: {
          adminUserId: admin.userId,
          targetUserId: userId,
          actionType: "RECRUITER_LINK_REGENERATED",
        },
      });

      return token;
    });

    revalidateAdminViews(userId);
    return { ok: true as const, data: { shareToken } };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to regenerate link",
    };
  }
}
