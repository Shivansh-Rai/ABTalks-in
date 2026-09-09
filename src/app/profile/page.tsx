import Link from "next/link";
import { redirect } from "next/navigation";
import { CandidatePersona } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { getCandidateDetail } from "@/repositories/candidate-detail";
import { getProfileEvidence } from "@/features/profile/get-evidence";
import { getResumeView } from "@/features/resume/service";
import { computeCompleteness } from "@/features/profile/completeness";
import { getVerifiedAccomplishments } from "@/features/profile/get-verified-accomplishments";
import { getVerifiedSkills } from "@/features/profile/get-verified-skills";
import { buildProfileReview } from "@/features/profile/build-review";
import { getSkillsByNames } from "@/features/skill/search-skills";
import { PROFILE_QUICK_SKILLS } from "@/lib/candidate-vocab";
import { getActiveAttempt, getHistory } from "@/features/interview/platform/service";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { ProfileWizard, type WizardStep } from "@/components/profile/profile-wizard";
import { BasicInfoSection } from "@/components/profile/basic-info-section";
import { ExperienceSection } from "@/components/profile/experience-section";
import { EducationSection } from "@/components/profile/education-section";
import { ProjectsSection } from "@/components/profile/projects-section";
import { MockInterviewsSection } from "@/components/profile/mock-interviews-section";
import { SkillsSection } from "@/components/profile/skills-section";
import { AccomplishmentsSection } from "@/components/profile/accomplishments-section";
import { LinksSection } from "@/components/profile/links-section";
import { ResumeSection } from "@/components/profile/resume-section";
import { PreferencesSection } from "@/components/profile/preferences-section";
import { buttonVariants } from "@/components/ui/button";
import { PERSONA_LABELS } from "@/lib/candidate-vocab";
import { isOtpVerificationRequired } from "@/lib/feature-flags";
import { isAvatarStorageConfigured } from "@/features/profile/avatar-storage";

/**
 * Résumé parsing runs inline in a Server Action invoked from this route, and one
 * Gemini document call takes longer than the platform's 10s default. Everything
 * else on the page is unaffected — this is a ceiling, not a reservation.
 */
export const maxDuration = 60;

/** Nulls become "" so every input stays controlled from first render. */
const s = (v: string | null | undefined) => v ?? "";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, image: true },
  });

  if (!user) {
    redirect("/api/auth/signout?callbackUrl=/login");
  }

  const shellUser = {
    name: session.user.name ?? user.email ?? "",
    email: user.email ?? "",
    image: user.image ?? null,
  };

  // Canonical: the 078 candidate tables, read directly. These sections have no
  // legacy equivalent, so nothing here branches on ENABLE_NEW_CANDIDATE.
  const detail = await getCandidateDetail(userId);

  if (!detail) {
    return (
      <DashboardShell
        user={shellUser}
        isAdmin={session.user.isAdmin ?? false}
        showSectionNav={false}
      >
        <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <h1 className="font-display text-lg font-semibold">
            Complete your registration first
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your candidate profile is not set up yet. Once you have registered
            for a track you can build out your full profile here.
          </p>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "default" }), "mt-6")}
          >
            Back to dashboard
          </Link>
        </main>
      </DashboardShell>
    );
  }

  const [
    evidence,
    catalogSkills,
    mockInterviewHistory,
    activeMockInterview,
    resume,
    verifiedAccomplishments,
    verifiedSkills,
  ] = await Promise.all([
    getProfileEvidence(userId),
    getSkillsByNames(PROFILE_QUICK_SKILLS),
    // The MockInterview tables exist on demo but the migration has not been
    // applied to production, so this query throws there until it is. The
    // profile must not 500 over it — it degrades to an empty list, which
    // renders the section's "none taken yet" copy.
    getHistory(userId).catch((e: unknown) => {
      logger.warn("[profile] mock interview history unavailable", {
        message: e instanceof Error ? e.message : String(e),
      });
      return { ok: false as const, message: "unavailable" };
    }),
    getActiveAttempt(userId).catch((e: unknown) => {
      logger.warn("[profile] active mock interview unavailable", {
        message: e instanceof Error ? e.message : String(e),
      });
      return { ok: false as const, message: "unavailable" };
    }),
    // A single indexed row read. The parser is NEVER invoked on page load —
    // see the note in features/resume/service.ts.
    //
    // Same degradation as the mock interview history above: `CandidateResume`
    // is a new table, and until its migration has been applied to a given
    // environment this query throws there. The profile must not 500 over a
    // section that is additive — it renders the empty state instead.
    getResumeView(userId).catch((e: unknown) => {
      logger.warn("[profile] résumé unavailable", {
        message: e instanceof Error ? e.message : String(e),
      });
      return null;
    }),
    // Read-only derivation across Credential / Enrollment / ProgramEnrollment /
    // HackathonParticipant. Never issues a certificate — unlike /achievements,
    // opening the profile must not have write side effects. Degrades to an
    // empty list on any environment where one of those tables is not migrated.
    getVerifiedAccomplishments(userId).catch((e: unknown) => {
      logger.warn("[profile] verified accomplishments unavailable", {
        message: e instanceof Error ? e.message : String(e),
      });
      return [];
    }),
    // Curriculum (ProgramSkill) × completion. Read-only and unstored, so a new
    // cohort's skills reach everyone already past the bar with no backfill.
    getVerifiedSkills(userId).catch((e: unknown) => {
      logger.warn("[profile] verified skills unavailable", {
        message: e instanceof Error ? e.message : String(e),
      });
      return [];
    }),
  ]);

  const mockInterviews = mockInterviewHistory.ok
    ? mockInterviewHistory.data
    : [];
  const activeAttempt = activeMockInterview.ok
    ? activeMockInterview.data
    : null;

  const completeness = computeCompleteness(detail, { hasAny: evidence.hasAny });
  const status = new Map(completeness.sections.map((x) => [x.key, x]));
  const sectionOf = (key: string) => status.get(key as never);

  const claimedSkills = detail.skills.filter((x) => x.claimedByCandidate);
  const mockComplete = mockInterviews.length > 0;
  const resumeComplete = resume?.status === "READY";

  const steps: WizardStep[] = [
    {
      key: "basic",
      title: "Basic Information",
      description: "This is how you are introduced on the platform.",
      checklist: "basic",
      complete: sectionOf("basic")?.complete ?? false,
      attention: false,
      savable: true,
      node: (
        <BasicInfoSection
          phoneVerified={detail.phoneVerified}
          otpRequired={isOtpVerificationRequired()}
          initial={{
            fullName: detail.fullName,
            phone: s(detail.phone),
            headline: s(detail.headline),
            summary: s(detail.summary),
            locationCity: s(detail.locationCity),
            locationRegion: s(detail.locationRegion),
            countryCode: s(detail.countryCode),
            primaryPersona: detail.primaryPersona ?? CandidatePersona.STUDENT,
          }}
        />
      ),
    },
    {
      key: "experience",
      title: "Experience",
      description: "Roles, Internships and freelance work.",
      checklist: "experience",
      complete: sectionOf("experience")?.complete ?? false,
      attention: false,
      savable: true,
      node: (
        <ExperienceSection
          initial={detail.experience.map((e) => ({
            companyName: e.companyName,
            title: e.title,
            employmentType: s(e.employmentType),
            locationCity: s(e.locationCity),
            startMonth: e.startMonth,
            startYear: e.startYear,
            endMonth: e.endMonth,
            endYear: e.endYear,
            isCurrent: e.isCurrent,
            description: s(e.description),
          }))}
        />
      ),
    },
    {
      key: "education",
      title: "Education",
      description: "College, school, and any additional qualifications.",
      checklist: "education",
      complete: sectionOf("education")?.complete ?? false,
      attention: false,
      savable: true,
      node: (
        <EducationSection
          initial={detail.education.map((e) => ({
            institutionName: e.institutionName,
            collegeId: s(e.collegeId),
            degree: s(e.degree),
            fieldOfStudy: s(e.fieldOfStudy),
            startMonth: e.startMonth,
            startYear: e.startYear,
            endMonth: e.endMonth,
            graduationYear: e.graduationYear,
            isCurrent: e.isCurrent,
            gradeType: e.gradeType ?? "",
            grade: s(e.grade),
            description: s(e.description),
          }))}
        />
      ),
    },
    {
      key: "projects",
      title: "Projects",
      description: "Things you have built, with links a recruiter can open.",
      checklist: "projects",
      complete: sectionOf("projects")?.complete ?? false,
      attention: false,
      savable: true,
      node: (
        <ProjectsSection
          initial={detail.projects.map((p) => ({
            title: p.title,
            description: s(p.description),
            techStack: p.techStack,
            repoUrl: s(p.repoUrl),
            liveUrl: s(p.liveUrl),
          }))}
        />
      ),
    },
    {
      key: "mock",
      title: "Mock Interview",
      description: "Live AI interviews you have taken. Earned, not entered.",
      checklist: "mock",
      complete: mockComplete,
      attention: !mockComplete && !activeAttempt,
      savable: false,
      node: (
        <MockInterviewsSection
          attempts={mockInterviews}
          activeAttempt={activeAttempt}
        />
      ),
    },
    {
      key: "skills",
      title: "Skills",
      description:
        "What you claim, kept separate from what the platform can verify.",
      checklist: "skills",
      complete: sectionOf("skills")?.complete ?? false,
      attention: false,
      savable: true,
      node: (
        <SkillsSection
          catalog={catalogSkills}
          initial={claimedSkills.map((sk) => ({
            skillId: sk.skillId,
            name: sk.name,
            categoryName: sk.categoryName,
          }))}
          verified={verifiedSkills}
        />
      ),
    },
    {
      key: "accomplishments",
      title: "Accomplishments",
      description:
        "What you have earned here, the certifications you hold, and your awards.",
      checklist: "accomplishments",
      // Scoring still keys off "certifications" — completeness weights are a
      // separate concern from what the tab is called.
      complete:
        (sectionOf("certifications")?.complete ?? false) ||
        verifiedAccomplishments.length > 0,
      attention: false,
      savable: true,
      node: (
        <AccomplishmentsSection
          verified={verifiedAccomplishments.map((v) => ({
            key: v.key,
            title: v.title,
            detail: v.detail,
            outcomeLabel: v.outcomeLabel,
          }))}
          initial={{
            rows: detail.certifications.map((c) => ({
              name: c.name,
              issuer: c.issuer,
              issuedMonth: c.issuedMonth,
              issuedYear: c.issuedYear,
              expiresMonth: c.expiresMonth,
              expiresYear: c.expiresYear,
              credentialUrl: s(c.credentialUrl),
            })),
            awards: s(detail.awards),
          }}
        />
      ),
    },
    {
      key: "resume",
      title: "Resume",
      description:
        "Upload your resume to see how strong it is and what to improve.",
      checklist: "resume",
      complete: resumeComplete,
      attention: !resumeComplete,
      savable: false,
      node: <ResumeSection resume={resume} />,
    },
    {
      key: "links",
      title: "Links",
      description: "Where your work lives.",
      checklist: "links",
      complete: sectionOf("links")?.complete ?? false,
      attention: false,
      savable: true,
      node: (
        <LinksSection
          initial={{
            linkedinUrl: s(detail.linkedinUrl),
            githubUsername: s(detail.githubUsername),
            portfolioUrl: s(detail.portfolioUrl),
            extra: detail.links.map((l) => ({
              type: l.type,
              label: s(l.label),
              url: l.url,
            })),
          }}
        />
      ),
    },
    {
      key: "preferences",
      title: "Career Preferences",
      description: "What you are looking for. Separate from recruiter visibility.",
      checklist: "preferences",
      complete: sectionOf("preferences")?.complete ?? false,
      attention: false,
      savable: true,
      node: (
        <PreferencesSection
          initial={{
            openToWork: detail.preference?.openToWork ?? false,
            preferredRoles: detail.preference?.preferredRoles ?? [],
            preferredLocations: detail.preference?.preferredLocations ?? [],
            opportunityTypes: detail.preference?.opportunityTypes ?? [],
            remotePreference: s(detail.preference?.remotePreference),
            willingToRelocate: detail.preference?.willingToRelocate ?? false,
            noticePeriodDays:
              detail.preference?.noticePeriodDays === null ||
              detail.preference?.noticePeriodDays === undefined
                ? ""
                : String(detail.preference.noticePeriodDays),
            availableFromMonth: detail.preference?.availableFromMonth ?? null,
            availableFromYear: detail.preference?.availableFromYear ?? null,
          }}
        />
      ),
    },
  ];

  const firstIncomplete = steps.findIndex((step) => !step.complete);
  const initialIndex = firstIncomplete === -1 ? 0 : firstIncomplete;

  // The report card links back into the wizard by index, so the mapping is
  // derived from `steps` rather than restated — reordering a step here moves
  // its Add / Edit button with it.
  const stepIndexByKey = Object.fromEntries(
    steps.map((step, i) => [step.key, i]),
  );

  const review = buildProfileReview({
    detail,
    personaLabel:
      PERSONA_LABELS[detail.primaryPersona] ?? detail.primaryPersona,
    score: completeness.score,
    resume,
    mockInterviewCount: mockInterviews.length,
    verifiedAccomplishments,
    verifiedSkills,
    stepIndexByKey,
  });

  return (
    <DashboardShell
      user={{ ...shellUser, name: detail.fullName || shellUser.name }}
      isAdmin={session.user.isAdmin ?? false}
      showSectionNav={false}
      collapsible
      contentClassName="min-h-0"
    >
      <ProfileWizard
        steps={steps}
        initialIndex={initialIndex}
        score={completeness.score}
        fullName={detail.fullName}
        imageUrl={user.image ?? null}
        review={review}
        avatarUploadEnabled={isAvatarStorageConfigured()}
      />
    </DashboardShell>
  );
}
