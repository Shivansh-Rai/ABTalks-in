import "server-only";

import { prisma } from "@/lib/db";
import {
  listProgramMemberLabels,
  listUserDisplayNames,
} from "@/repositories/hire";
import { filterSearchableUserIds } from "@/repositories/talent";
import { encodeCandidateRef } from "@/features/hire/candidate-ref";
import { existingEngagements } from "@/features/hire/contact-access";
import { loadAvailabilityByUserId } from "@/features/hire/dossier";
import { getOwnedSession, snapshotFromJson } from "@/features/hire/search-sessions";
import { estimateCompensation, formatBandLpa } from "@/features/hire/compensation";
import { roleFamilyFor, tidyRoleLabel } from "@/features/hire/role-family";
import type { MatchTier } from "@/features/hire/types";
import type { MatchCardData, MatchTriage } from "@/components/hire/match-card";
import {
  pickPublicEvidence,
  pickPublicScores,
} from "@/features/hire/to-public-match";

/**
 * What the recruiter has already done with a match, as opposed to how the
 * match scored. Preserved across match runs by the upsert in `runMatchAction`.
 */
export type MatchState = MatchTriage;

/**
 * Matches for one requirement, ready to render, for one recruiter.
 *
 * Shared by the requirement page and the full candidate list. It is one place
 * on purpose: the query is scoped to the caller's own request, and it
 * selects given name for the card heading. Company, email and profile URLs
 * stay off this query.
 */
export async function loadRequestMatches(
  requestId: string,
  recruiterUserId: string,
  /**
   * Plan 133. Present → only that search session's results, in its order and
   * with its scoring; `null` → a project with no session selected (none).
   * Absent → every match in the project, as before (the full candidate list).
   * Decisions always come from the project row, so the shortlist is shared by
   * every session of this project and by no other project.
   */
  opts?: { sessionId: string | null },
): Promise<{
  title: string;
  // The recruiter's own label for the request; null on every row created
  // before the persistence migration, hence the `title` fallback at the call
  // site rather than here.
  name: string | null;
  status: string;
  alertWhenAvailable: boolean;
  // When the recruiter last opened this request. The only thing a match's
  // `firstSeenAt` can be compared against to answer "new since I was here"
  // (T-045). Returned, not yet rendered.
  lastViewedAt: Date | null;
  archivedAt: Date | null;
  // Per-match triage state travels alongside the card data rather than inside
  // `MatchCardData`, so the card component's props are unchanged until the
  // T-045 / T-042 UI lands and its shape is decided.
  matches: (MatchCardData & MatchTriage)[];
  cartCount: number;
} | null> {
  const request = await prisma.talentRequest.findFirst({
    where: { id: requestId, recruiterUserId },
    select: {
      title: true,
      name: true,
      status: true,
      alertWhenAvailable: true,
      lastViewedAt: true,
      archivedAt: true,
      mustHaveStack: true,
      matches: {
        orderBy: { score: "desc" },
        select: {
          candidateUserId: true,
          programMemberId: true,
          source: true,
          score: true,
          tier: true,
          scoreBreakdown: true,
          rationale: true,
          gaps: true,
          availabilityUnknown: true,
          evidence: true,
          firstSeenAt: true,
          viewedAt: true,
          decision: true,
        },
      },
    },
  });
  if (!request) return null;

  const projectMatches = opts
    ? await scopeToSession(request.matches, requestId, recruiterUserId, opts.sessionId)
    : request.matches;

  // Every match is keyed on a person, so this needs no per-source branching.
  const storedUserIds = projectMatches.map((m) => m.candidateUserId);

  // A saved match list is a discovery surface, not an archive. `TalentRequestMatch`
  // is a snapshot frozen at match time, so a candidate who has since been made
  // unsearchable would keep rendering on a recruiter's saved request forever
  // unless the gate is re-applied on read. Engagement requests are different and
  // deliberately not filtered — those are the record of an introduction that has
  // already happened.
  const stillSearchable = await filterSearchableUserIds(storedUserIds);
  const visibleMatches = projectMatches.filter((m) =>
    stillSearchable.has(m.candidateUserId),
  );
  const candidateUserIds = visibleMatches.map((m) => m.candidateUserId);

  // Professional name / role / shortlist state still live on ProgramMember.
  // Loaded from the provenance id in a separate query rather than through a
  // relation, because the match row no longer has one — the candidate is the
  // user, and the cohort row is only where the evidence was read from.
  const provenanceMemberIds = [
    ...new Set(
      visibleMatches
        .map((m) => m.programMemberId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [engagements, cartCount, nameByUser, members, availabilityByUser] =
    await Promise.all([
      existingEngagements(recruiterUserId, candidateUserIds),
      prisma.recruiterShortlistItem.count({ where: { recruiterUserId } }),
      listUserDisplayNames(candidateUserIds),
      listProgramMemberLabels(provenanceMemberIds, {
        shortlistedByRecruiterUserId: recruiterUserId,
      }),
      // Read live, exactly like the compensation band below is recomputed
      // rather than read back: the stored row is a snapshot from match time, and
      // a candidate who has since switched "open to work" off would otherwise
      // keep the badge on this page forever.
      loadAvailabilityByUserId(candidateUserIds),
    ]);
  const memberById = new Map(members.map((m) => [m.id, m]));
  return {
    title: request.title,
    name: request.name,
    status: request.status,
    alertWhenAvailable: request.alertWhenAvailable,
    lastViewedAt: request.lastViewedAt,
    archivedAt: request.archivedAt,
    cartCount,
    matches: visibleMatches.map((m): MatchCardData & MatchTriage => {
      const raw =
        m.evidence && typeof m.evidence === "object"
          ? (m.evidence as Record<string, unknown>)
          : {};
      const evidence = pickPublicEvidence(raw);
      // Older rows stored CandidateEvidence.interview as a nested object.
      const nested = raw.interview;
      if (nested && typeof nested === "object") {
        const iv = nested as Record<string, unknown>;
        if (evidence.interviewOverall == null && typeof iv.overall === "number") {
          evidence.interviewOverall = iv.overall;
        }
        if (evidence.interviewComm == null && typeof iv.comm === "number") {
          evidence.interviewComm = iv.comm;
        }
        if (evidence.interviewTech == null && typeof iv.tech === "number") {
          evidence.interviewTech = iv.tech;
        }
        if (evidence.interviewProblem == null && typeof iv.problem === "number") {
          evidence.interviewProblem = iv.problem;
        }
      }
      const storedLocation =
        typeof raw.locationLabel === "string" && raw.locationLabel.trim()
          ? raw.locationLabel.trim()
          : null;
      const source = m.source === "PROGRAM" ? "PROGRAM" : m.source;
      const isProgram = source === "PROGRAM";
      const member = m.programMemberId
        ? memberById.get(m.programMemberId)
        : undefined;
      // The stored evidence blob carries the challenge candidate's role label;
      // there is no ProgramMember row to read it from.
      const rawRole =
        member?.jobRole ??
        (typeof (m.evidence as { jobRole?: unknown })?.jobRole === "string"
          ? ((m.evidence as { jobRole: string }).jobRole)
          : "");
      // Recomputed rather than stored: the band is a view of the role and the
      // tier, and a frozen copy would drift the moment the table is retuned.
      const band = estimateCompensation({
        roleFamily: roleFamilyFor(rawRole),
        yearsExperience: evidence.yearsExperience ?? 0,
        evidenceTier: m.tier as MatchTier,
        missionsPassed: evidence.missionsPassed ?? 0,
      });
      return {
        candidateRef: encodeCandidateRef(
          source === "PROGRAM" ||
            source === "CLAUDE" ||
            source === "CHALLENGE_60" ||
            source === "HACKATHON"
            ? source
            : "CLAUDE",
          (isProgram ? m.programMemberId : m.candidateUserId) ?? "",
        ),
        source:
          source === "PROGRAM" ||
          source === "CLAUDE" ||
          source === "CHALLENGE_60" ||
          source === "HACKATHON"
            ? source
            : "CLAUDE",
        programMemberId: m.programMemberId,
        displayName:
          (member?.fullName?.trim() || nameByUser.get(m.candidateUserId)) ?? null,
        jobRole: rawRole ? tidyRoleLabel(rawRole) : "Candidate",
        locationLabel: storedLocation,
        score: m.score,
        tier: m.tier,
        rationale: m.rationale,
        gaps: m.gaps,
        availabilityUnknown: m.availabilityUnknown,
        openToWork:
          availabilityByUser.get(m.candidateUserId)?.openToWork === true,
        shortlisted: (member?.shortlistedBy?.length ?? 0) > 0,
        engagementStatus: engagements.get(m.candidateUserId)?.status ?? null,
        scores: pickPublicScores(m.scoreBreakdown),
        // Always the recomputed ABTalks band, never a stored declared figure.
        // The candidate's own expectation is admin-only (see to-public-match.ts);
        // reading it back out of a frozen evidence blob would reopen exactly the
        // exposure that was closed on the write side.
        compensationBand: band ? formatBandLpa(band) : null,
        compensationDeclared: false,
        highlightSkills: request.mustHaveStack.length
          ? request.mustHaveStack
          : undefined,
        evidence,
        candidateUserId: m.candidateUserId,
        viewedAt: m.viewedAt ? m.viewedAt.toISOString() : null,
        decision: m.decision,
        isNew:
          m.firstSeenAt.getTime() >
          (request.lastViewedAt ?? m.firstSeenAt).getTime(),
      };
    }),
  };
}

type StoredMatch = {
  candidateUserId: string;
  programMemberId: string | null;
  source: string;
  score: number;
  tier: string;
  scoreBreakdown: unknown;
  rationale: string | null;
  gaps: string[];
  availabilityUnknown: boolean;
  evidence: unknown;
  firstSeenAt: Date;
  viewedAt: Date | null;
  decision: string;
};

/**
 * Plan 133. One session's view of the project's matches: only the candidates
 * that session returned, in its order, with the scoring it computed. Identity
 * and the recruiter's decision stay the project row's. A session id that is
 * not in this recruiter's project returns nothing.
 */
async function scopeToSession<M extends StoredMatch>(
  matches: M[],
  requestId: string,
  recruiterUserId: string,
  sessionId: string | null,
): Promise<M[]> {
  if (!sessionId) return [];
  const session = await getOwnedSession(recruiterUserId, requestId, sessionId);
  if (!session) return [];

  const byUser = new Map(matches.map((m) => [m.candidateUserId, m]));
  const snapshot = snapshotFromJson(session.resultSnapshot);
  const out: M[] = [];
  for (const candidateUserId of session.resultCandidateIds) {
    const row = byUser.get(candidateUserId);
    if (!row) continue;
    const seen = snapshot.get(candidateUserId);
    out.push(
      seen
        ? {
            ...row,
            score: seen.score,
            tier: seen.tier,
            scoreBreakdown: seen.scoreBreakdown,
            evidence: seen.evidence,
            rationale: seen.rationale,
            gaps: seen.gaps,
            availabilityUnknown: seen.availabilityUnknown,
          } as M
        : row,
    );
  }
  return out;
}
