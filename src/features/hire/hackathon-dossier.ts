import "server-only";

import { listHackathonCandidates } from "@/repositories/hire";
import { encodeCandidateRef } from "@/features/hire/candidate-ref";
import { computeCoverage, loadAvailabilityByUserId } from "@/features/hire/dossier";
import { declared, derived, verified } from "@/features/hire/dossier-provenance";
import { candidatePublicId } from "@/features/hire/public-id";
import { tidyRoleLabel } from "@/features/hire/role-family";
import { splitSkills } from "@/features/hire/challenge-dossier";
import type { CandidateDossier, EvidenceCoverage } from "@/features/hire/types";

export type HackathonDossierSet = {
  dossiers: CandidateDossier[];
  coverage: EvidenceCoverage;
  nameByUser: Map<string, string>;
};

const EMPTY: HackathonDossierSet = {
  dossiers: [],
  coverage: {
    dimensions: {
      stack: false,
      missions: false,
      cleanPass: false,
      projects: false,
      consistency: false,
      interview: false,
      experience: false,
    },
    note: "No hackathon submissions in the pool yet.",
  },
  nameByUser: new Map(),
};

/**
 * People who actually shipped a hackathon repo. Thin evidence: one shipped
 * project, optional profile skills. No 60-day denominator.
 */
export async function buildHackathonDossierSet(): Promise<HackathonDossierSet> {
  const rows = await listHackathonCandidates();
  if (rows.length === 0) return EMPTY;

  // This used to be hard-coded null, which meant a hackathon candidate who had
  // filled in their preferences was permanently "availability unconfirmed" and
  // could never show as open to work. The row exists; the read was missing.
  const availability = await loadAvailabilityByUserId(rows.map((r) => r.userId));

  const nameByUser = new Map<string, string>();
  const dossiers: CandidateDossier[] = rows.map((row) => {
    const p = row.recruiterIdentity;
    const skills = splitSkills(p.skills);
    const given = row.user.name?.trim();
    if (given) nameByUser.set(row.userId, given);
    const av = availability.get(row.userId) ?? null;
    return {
      publicId: candidatePublicId(row.userId),
      source: "HACKATHON",
      candidateRef: encodeCandidateRef("HACKATHON", row.userId),
      programMemberId: null,
      userId: row.userId,
      roleFamily: derived("OTHER"),
      rawRoleLabel: p.role
        ? declared(tidyRoleLabel(p.role))
        : derived("Hackathon builder"),
      yearsExperience: declared(p.yearsExperience ?? 0),
      education: declared({
        level: null,
        university: null,
        gradYear: p.graduationYear ?? null,
      }),
      declaredSkills: declared(skills),
      links: declared({
        linkedin: p.hasLinkedin,
        github: p.hasGithub,
        resume: p.hasResume,
      }),
      evidence: {
        missionsPassed: verified(1),
        missionsAttempted: verified(1),
        missionsWaived: verified(0),
        cleanPassCount: verified(0),
        cleanPassPct: derived(0),
        commitDays: verified(1),
        activeDaysSpan: verified(1),
        lastActiveAt: verified(null),
        projectScores: verified([]),
        interview: verified(null),
        workingLanguages: verified(skills.slice(0, 4)),
        missionTypesPassed: verified(["HACKATHON"]),
        cohortProgress: derived({ day: 1, ofDays: 1 }),
        certificateIssued: verified(false),
        quizAverage: verified(null),
      },
      availability: av
        ? {
            openToWork: av.openToWork,
            expectedSalaryMin: av.expectedSalaryMin,
            expectedSalaryMax: av.expectedSalaryMax,
            salaryCurrency: av.salaryCurrency,
            noticePeriodDays: av.noticePeriodDays,
            preferredWorkMode: av.preferredWorkMode,
            preferredCities: av.preferredCities,
            openToRelocate: av.openToRelocate,
          }
        : null,
      compensation: { declared: null, estimate: null },
    };
  });

  return {
    dossiers,
    coverage: computeCoverage(dossiers),
    nameByUser,
  };
}
