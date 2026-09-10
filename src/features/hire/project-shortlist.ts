import "server-only";
import { encodeCandidateRef } from "@/features/hire/candidate-ref";
import { pickPublicEvidence } from "@/features/hire/to-public-match";
import {
  listProgramMemberLabels,
  listUserDisplayNames,
} from "@/repositories/hire";
import { prisma } from "@/lib/db";

/**
 * Every candidate the recruiter has shortlisted inside a talent project.
 *
 * THE T-149 half of the desk shortlist. `TalentRequestMatch.decision` is the
 * only shortlist store that can name a candidate on any track: it is keyed on
 * `candidateUserId`, while the legacy `RecruiterShortlistItem` is a hard FK to
 * `ProgramMember` and can therefore only ever hold AI-cohort members.
 *
 * The Scout header used to read the legacy table alone, so a candidate
 * shortlisted inside a project was written to the database correctly and then
 * appeared nowhere — the count stayed put and the panel stayed empty. This
 * reader is what closes that gap; `app/hire/layout.tsx` merges it with the
 * legacy list.
 *
 * Archived projects are excluded: a shortlist on a project the recruiter has
 * put away should not keep occupying the header count.
 */

export type ProjectShortlistRow = {
  candidateRef: string;
  /** Program members only — drives the evidence-profile link. Null elsewhere. */
  memberId: string | null;
  candidateUserId: string;
  jobRole: string;
  totalScore: number;
  displayName: string | null;
  skills: string[];
  source: string;
  /** Which project this shortlist came from, newest decision first. */
  requestId: string;
  yearsExperience?: number;
  missionsPassed?: number;
  certificateIssued?: boolean;
  rationale: string | null;
};

/** The four refs `decodeCandidateRef` accepts; anything else rides as CLAUDE. */
function refSource(source: string): string {
  return source === "PROGRAM" ||
    source === "CLAUDE" ||
    source === "CHALLENGE_60" ||
    source === "HACKATHON"
    ? source
    : "CLAUDE";
}

function roleFromEvidence(evidence: unknown): string | null {
  if (typeof evidence !== "object" || evidence === null) return null;
  const role = (evidence as Record<string, unknown>).jobRole;
  return typeof role === "string" && role.trim().length > 0 ? role.trim() : null;
}

export async function listProjectShortlist(
  recruiterUserId: string,
): Promise<ProjectShortlistRow[]> {
  const rows = await prisma.talentRequestMatch.findMany({
    where: {
      decision: "SHORTLISTED",
      request: { recruiterUserId, archivedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      requestId: true,
      candidateUserId: true,
      programMemberId: true,
      source: true,
      score: true,
      evidence: true,
      rationale: true,
      candidate: { select: { name: true } },
    },
  });
  if (rows.length === 0) return [];

  // Hydrate the SAME way the desk card does. Without this a project row
  // reaching the header carried only an id and a score, and every other field
  // rendered as "Not disclosed" — but only in a browser with no localStorage
  // snapshot behind it, which is exactly why it looked like a Browser B bug.
  const [nameByUser, memberLabels] = await Promise.all([
    listUserDisplayNames(rows.map((r) => r.candidateUserId)),
    listProgramMemberLabels(
      rows.map((r) => r.programMemberId).filter((id): id is string => Boolean(id)),
    ),
  ]);
  const memberById = new Map(memberLabels.map((m) => [m.id, m]));

  // One logical row per candidate even when the same person is shortlisted in
  // several projects — the header is a list of people, not of decisions. The
  // newest decision wins, which is why the query is ordered before this runs.
  const seen = new Set<string>();
  const out: ProjectShortlistRow[] = [];
  for (const r of rows) {
    if (seen.has(r.candidateUserId)) continue;
    seen.add(r.candidateUserId);

    const source = refSource(r.source);
    const isProgram = source === "PROGRAM";
    const member = r.programMemberId ? memberById.get(r.programMemberId) : null;
    const evidence = pickPublicEvidence(r.evidence);
    out.push({
      candidateRef: encodeCandidateRef(
        source,
        (isProgram ? r.programMemberId : r.candidateUserId) ?? r.candidateUserId,
      ),
      // Never fake a ProgramMember identity for a non-program candidate: the
      // evidence-profile link this drives addresses a ProgramMember row.
      memberId: isProgram ? r.programMemberId : null,
      candidateUserId: r.candidateUserId,
      jobRole:
        member?.jobRole?.trim() || roleFromEvidence(r.evidence) || "Candidate",
      totalScore: r.score,
      displayName:
        member?.fullName?.trim() ||
        nameByUser.get(r.candidateUserId) ||
        r.candidate?.name?.trim() ||
        null,
      skills: evidence.skills ?? [],
      source,
      requestId: r.requestId,
      yearsExperience: evidence.yearsExperience,
      missionsPassed: evidence.missionsPassed,
      certificateIssued: evidence.certificateIssued,
      rationale: r.rationale,
    });
  }
  return out;
}
