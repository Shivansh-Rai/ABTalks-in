import { prisma } from "@/lib/db";
import { parseEducation, parseProjects } from "@/lib/validations/recruiter";

export async function getRecruiterReview(userId: string) {
  const r = await prisma.recruiterReview.findUnique({
    where: { userId },
    select: {
      confidenceRating: true,
      codingRating: true,
      communicationRating: true,
      headline: true,
      summary: true,
      strengths: true,
      recommendedRoles: true,
      projects: true,
      education: true,
      achievements: true,
      certifications: true,
      adminNote: true,
      isPublished: true,
      shareToken: true,
    },
  });

  return {
    confidenceRating: r?.confidenceRating ?? null,
    codingRating: r?.codingRating ?? null,
    communicationRating: r?.communicationRating ?? null,
    headline: r?.headline ?? "",
    summary: r?.summary ?? "",
    strengths: r?.strengths ?? [],
    recommendedRoles: r?.recommendedRoles ?? [],
    projects: parseProjects(r?.projects),
    education: parseEducation(r?.education),
    achievements: r?.achievements ?? [],
    certifications: r?.certifications ?? [],
    adminNote: r?.adminNote ?? "",
    isPublished: r?.isPublished ?? false,
    shareToken: r?.shareToken ?? null,
  };
}
