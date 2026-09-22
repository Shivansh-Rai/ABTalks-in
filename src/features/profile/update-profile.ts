import { UserType } from "@prisma/client";
import { prisma, writeClient } from "@/lib/db";
import { applyCandidateIdentityChange } from "@/repositories/candidate-identity";
import {
  updateProfessionalProfileSchema,
  updateStudentProfileSchema,
} from "@/lib/validations/profile";

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateProfile(
  userId: string,
  input: {
    userType: UserType;
    fullName: string;
    college?: string;
    collegeId?: string;
    graduationYear?: unknown;
    organization?: string;
    role?: string;
    yearsExperience?: unknown;
    skills: unknown;
    linkedinUrl?: string;
    resumeUrl?: string;
    githubUsername?: string;
    phone?: string;
  },
): Promise<UpdateProfileResult> {
  const skillsArr = Array.isArray(input.skills)
    ? input.skills.filter((x): x is string => typeof x === "string")
    : [];

  let savedType: UserType;
  const existing = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { primaryPersona: true },
  });
  if (!existing) {
    return { ok: false, message: "Profile not found" };
  }
  savedType =
    existing.primaryPersona === "PROFESSIONAL"
      ? UserType.PROFESSIONAL
      : UserType.STUDENT;

  if (savedType === UserType.STUDENT) {
    const parsed = updateStudentProfileSchema.safeParse({
      userType: "STUDENT",
      fullName: input.fullName,
      college: input.college ?? "",
      collegeId: input.collegeId ?? "",
      graduationYear: input.graduationYear,
      skills: skillsArr,
      linkedinUrl: input.linkedinUrl ?? "",
      resumeUrl: input.resumeUrl ?? "",
      githubUsername: input.githubUsername ?? "",
      phone: input.phone ?? "",
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.[0];
      const message = issue?.message ?? "Invalid input";
      return {
        ok: false,
        message: field ? `${String(field)}: ${message}` : message,
      };
    }

    const data = parsed.data;

    await writeClient().$transaction(
      async (tx) => {
        await applyCandidateIdentityChange(tx, userId, {
          fullName: data.fullName,
          phone: data.phone === "" ? null : data.phone,
          linkedinUrl: data.linkedinUrl ?? null,
          resumeUrl: data.resumeUrl === "" ? null : data.resumeUrl,
          githubUsername: data.githubUsername ?? null,
        });
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return { ok: true };
  }

  const parsed = updateProfessionalProfileSchema.safeParse({
    userType: "PROFESSIONAL",
    fullName: input.fullName,
    organization: input.organization ?? "",
    role: input.role ?? "",
    yearsExperience: input.yearsExperience,
    skills: skillsArr,
    linkedinUrl: input.linkedinUrl ?? "",
    resumeUrl: input.resumeUrl ?? "",
    githubUsername: input.githubUsername ?? "",
    phone: input.phone ?? "",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    const message = issue?.message ?? "Invalid input";
    return {
      ok: false,
      message: field ? `${String(field)}: ${message}` : message,
    };
  }

  const data = parsed.data;

  await writeClient().$transaction(
    async (tx) => {
      await applyCandidateIdentityChange(tx, userId, {
        fullName: data.fullName,
        phone: data.phone === "" ? null : data.phone,
        linkedinUrl: data.linkedinUrl ?? null,
        resumeUrl: data.resumeUrl === "" ? null : data.resumeUrl,
        githubUsername: data.githubUsername ?? null,
      });
    },
    { maxWait: 10000, timeout: 20000 },
  );

  return { ok: true };
}
