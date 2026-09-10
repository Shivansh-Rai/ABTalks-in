"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { JobType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { formatDateTimeIST } from "@/lib/date-utils";
import { getJobApplicants } from "@/features/jobs/get-job-applicants";

const jobTypeSchema = z.nativeEnum(JobType);

const optionalUrl = z.union([z.literal(""), z.string().url()]).optional();

const jobFieldsSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().max(200).optional().default(""),
  type: jobTypeSchema,
  description: z.string().min(1).max(20000),
  applyExternalUrl: optionalUrl,
});

function revalidateJobViews(jobId?: string) {
  revalidatePath("/jobs");
  revalidatePath("/admin/jobs");
  if (jobId) {
    revalidatePath(`/admin/jobs/${jobId}`);
    revalidatePath(`/jobs/${jobId}`);
  }
}

export async function createJobAction(input: {
  title: string;
  company: string;
  location?: string;
  type: JobType;
  description: string;
  applyExternalUrl?: string;
}) {
  const admin = await requireAdmin();
  const parsed = jobFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid input" };
  }

  const { title, company, location, type, description, applyExternalUrl } =
    parsed.data;

  try {
    const job = await prisma.job.create({
      data: {
        title,
        company,
        location: location.trim() || null,
        type,
        description,
        applyExternalUrl: applyExternalUrl?.trim() || null,
        createdByAdminId: admin.userId,
        status: "PUBLISHED",
        isOpen: true,
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    revalidateJobViews();
    return { ok: true as const, data: { id: job.id } };
  } catch {
    return { ok: false as const, message: "Failed to create job" };
  }
}

export async function updateJobAction(input: {
  jobId: string;
  title: string;
  company: string;
  location?: string;
  type: JobType;
  description: string;
  applyExternalUrl?: string;
}) {
  await requireAdmin();
  const parsed = jobFieldsSchema
    .extend({ jobId: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid input" };
  }

  const { jobId, title, company, location, type, description, applyExternalUrl } =
    parsed.data;

  try {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        title,
        company,
        location: location.trim() || null,
        type,
        description,
        applyExternalUrl: applyExternalUrl?.trim() || null,
      },
    });
    revalidateJobViews(jobId);
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "Failed to update job" };
  }
}

export async function toggleJobOpenAction(input: {
  jobId: string;
  isOpen: boolean;
}) {
  await requireAdmin();
  const parsed = z
    .object({
      jobId: z.string().min(1),
      isOpen: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid input" };
  }

  try {
    const now = new Date();
    await prisma.job.update({
      where: { id: parsed.data.jobId },
      data: parsed.data.isOpen
        ? { isOpen: true, status: "PUBLISHED", publishedAt: now, closedAt: null }
        : { isOpen: false, status: "CLOSED", closedAt: now },
    });
    revalidateJobViews(parsed.data.jobId);
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "Failed to update status" };
  }
}

export async function deleteJobAction(input: { jobId: string }) {
  await requireAdmin();
  const parsed = z.object({ jobId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid input" };
  }

  try {
    await prisma.job.delete({ where: { id: parsed.data.jobId } });
    revalidateJobViews();
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "Failed to delete job" };
  }
}

export async function getJobApplicantsForExport(jobId: string) {
  await requireAdmin();
  const parsed = z.string().min(1).safeParse(jobId);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid job" };
  }

  const applicants = await getJobApplicants(parsed.data);

  const rows: Record<string, string | number>[] = applicants.map((a) => {
    const p = a.user.studentProfile;
    return {
      "Full Name": p?.fullName?.trim() || a.user.email,
      Email: a.user.email,
      Phone: p?.phone ?? "",
      Domain: p?.domain ?? "",
      College: p?.college ?? "",
      "Graduation Year": p?.graduationYear ?? "",
      LinkedIn: p?.linkedinUrl ?? "",
      GitHub: p?.githubUsername ?? "",
      "Ready For Interview": p?.isReadyForInterview ? "Yes" : "No",
      "Applied At": formatDateTimeIST(a.createdAt),
      Note: a.note ?? "",
    };
  });

  return { ok: true as const, data: rows };
}
