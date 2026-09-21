import "server-only";
import { prisma } from "@/lib/db";
import { getCandidateProfile } from "@/repositories/candidate";
import { parseExperience, parseProjects, parseSkillGroups } from "@/lib/validations/recruiter";
import type { ResumeContext } from "@/features/interview/types";

/**
 * Resume context for the interviewer. Canonical identity/skills come from
 * CandidateProfile + claimed CandidateSkill. RecruiterReview remains an
 * optional structured overlay. StudentProfile is not a current-state source.
 */
export async function buildResumeContext(
  userId: string,
): Promise<ResumeContext> {
  const [profile, review] = await Promise.all([
    getCandidateProfile(userId),
    prisma.recruiterReview.findUnique({
      where: { userId },
      select: {
        targetRole: true,
        headline: true,
        summary: true,
        skillGroups: true,
        experience: true,
        projects: true,
      },
    }),
  ]);

  const profileSkills = profile?.skills ?? [];
  const resumeUrl = profile?.resumeUrl ?? null;

  if (!review) {
    return {
      hasStructuredResume: false,
      headline: profile?.headline ?? null,
      summary: null,
      targetRole: profile?.role ?? null,
      skills: profileSkills,
      experience: [],
      projects: [],
      resumeUrl,
    };
  }

  const skillGroups = parseSkillGroups(review.skillGroups);
  const experience = parseExperience(review.experience);
  const projects = parseProjects(review.projects);

  const reviewSkills = skillGroups.flatMap((g) => g.skills);
  const skills = [...new Set([...reviewSkills, ...profileSkills])];

  const hasStructuredResume =
    experience.length > 0 || projects.length > 0 || reviewSkills.length > 0;

  return {
    hasStructuredResume,
    headline: review.headline || profile?.headline || null,
    summary: review.summary || null,
    targetRole: review.targetRole || profile?.role || null,
    skills,
    experience: experience.map((e) => ({
      title: e.title,
      company: e.company,
      highlights: e.bullets,
    })),
    projects: projects.map((p) =>
      p.tech ? `${p.title} (${p.tech})` : p.title,
    ),
    resumeUrl,
  };
}
