"use server";

import { z } from "zod";
import { auth } from "@/auth";
import {
  applyToPublishedJob,
  listMyApplications,
} from "@/features/candidate-jobs/service";
import { prismaApplicationStore } from "@/features/candidate-jobs/prisma-store";
import { prismaJobStore } from "@/features/recruiter-jobs/prisma-store";

const applySchema = z.object({
  jobId: z.string().min(1),
  note: z.string().max(1000).optional().default(""),
  resumeUrl: z.string().url().max(2048).optional(),
  coverLetter: z.string().max(5000).optional(),
});

function deps() {
  return {
    jobs: prismaJobStore(),
    applications: prismaApplicationStore(),
  };
}

export async function applyToJobAction(input: {
  jobId: string;
  note?: string;
  resumeUrl?: string;
  coverLetter?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, message: "Sign in to apply.", status: 401 };
  }

  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid input", status: 400 };
  }

  const res = await applyToPublishedJob(
    deps(),
    { userId: session.user.id },
    parsed.data,
  );

  if (!res.ok) {
    return {
      ok: false as const,
      message: res.message,
      status: res.status ?? 400,
    };
  }
  return { ok: true as const, applicationId: res.data.id, status: res.data.status };
}

export async function listMyApplicationsAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, message: "Sign in to view your applications.", status: 401 };
  }

  const res = await listMyApplications(deps(), { userId: session.user.id });
  if (!res.ok) {
    return { ok: false as const, message: res.message, status: res.status ?? 400 };
  }
  return { ok: true as const, applications: res.data };
}
