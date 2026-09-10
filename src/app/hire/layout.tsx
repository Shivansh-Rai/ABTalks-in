import type { ReactNode } from "react";
import { auth } from "@/auth";
import { isRecruiterAuthEnabled } from "@/lib/feature-flags";
import { getRecruiterState } from "@/features/talent-pool/recruiter-registration";
import { getRecruiterAccountSnapshot } from "@/features/hire/recruiter-account";
import { existingEngagements } from "@/features/hire/contact-access";
import { listProjectShortlist } from "@/features/hire/project-shortlist";
import { logger } from "@/lib/logger";
import { getShortlist } from "@/features/talent-pool/pool";
import { encodeCandidateRef } from "@/features/hire/candidate-ref";
import { HireAuthProvider } from "@/components/hire/hire-auth-provider";
import { HireDeskProvider } from "@/components/hire/hire-desk-context";
import { HireChrome } from "@/components/hire/hire-chrome";
import { MergeGuestCart } from "@/components/hire/merge-guest-cart";
import type { CartRow } from "@/components/hire/shortlist-cart";
import "./hire-scout.css";

export default async function HireLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const state = userId ? await getRecruiterState(userId) : { status: "none" as const };
  const active = state.status === "active";
  const account = userId && active ? await getRecruiterAccountSnapshot(userId) : null;

  // The header shortlist is the union of TWO stores, and it has to be, because
  // neither can name every candidate:
  //
  //   - RecruiterShortlistItem (legacy, T-027) is a hard FK to ProgramMember,
  //     so it only ever holds AI-cohort members.
  //   - TalentRequestMatch.decision (T-149) is keyed on candidateUserId and
  //     covers every track, but only exists inside a talent project.
  //
  // Reading only the first is why a candidate shortlisted inside a project was
  // written to the database correctly and then appeared nowhere. Both are
  // merged here ONCE and the count is derived from the same array, so the
  // header can never show a number the panel cannot list.
  let podRows: CartRow[] = [];
  if (userId && active) {
    // NO try/catch around listProjectShortlist on purpose. If the project
    // shortlist query fails — a missing column, a migration that never reached
    // this environment — this surface must fail LOUDLY. A caught error here
    // renders a plausible header with a silently short shortlist, which is
    // exactly how a schema drift stayed hidden until it cost a day to find.
    const [legacy, project] = await Promise.all([
      getShortlist(userId),
      listProjectShortlist(userId),
    ]);

    const legacyRows = legacy.ok ? legacy.data : [];
    const engagements = await existingEngagements(userId, [
      ...legacyRows.map((r) => r.userId),
      ...project.map((r) => r.candidateUserId),
    ]);

    podRows = legacyRows.map((r) => ({
      candidateRef: encodeCandidateRef("PROGRAM", r.memberId),
      memberId: r.memberId,
      jobRole: r.jobRole ?? "Candidate",
      totalScore: r.totalScore,
      note: r.note,
      displayName: r.displayName,
      skills: r.skills,
      yearsExperience: r.yearsExperience ?? undefined,
      source: "PROGRAM" as const,
      openToWork: r.openToWork,
      revealedName: r.revealedName,
      engagementStatus: engagements.get(r.userId)?.status ?? null,
    }));

    // Dedupe on candidateRef: a program member shortlisted BOTH the legacy way
    // and inside a project is one person, not two rows. Legacy wins because it
    // carries the note and the revealed name.
    const seen = new Set(podRows.map((r) => r.candidateRef));
    for (const r of project) {
      if (seen.has(r.candidateRef)) continue;
      seen.add(r.candidateRef);
      podRows.push({
        candidateRef: r.candidateRef,
        memberId: r.memberId,
        jobRole: r.jobRole,
        totalScore: r.totalScore,
        note: null,
        displayName: r.displayName,
        skills: r.skills,
        source: r.source,
        revealedName: null,
        engagementStatus: engagements.get(r.candidateUserId)?.status ?? null,
        yearsExperience: r.yearsExperience,
        missionsPassed: r.missionsPassed,
        certificateIssued: r.certificateIssued,
        rationale: r.rationale,
        // Coordinates the pod needs to remove this row through T-149.
        projectRequestId: r.requestId,
        candidateUserId: r.candidateUserId,
      });
    }
  }

  return (
    <HireAuthProvider
      approved={active}
      signedIn={Boolean(userId)}
      authEnabled={isRecruiterAuthEnabled()}
    >
      {/* A recruiter who registered *because* they wanted specific candidates
          keeps that ask in sessionStorage until it is recorded, and the
          session that recorded it may not be the one that placed it. */}
      {active && <MergeGuestCart />}
      <HireDeskProvider>
        <HireChrome
          account={account}
          // Same array the panel renders, so the badge and the list can never
          // disagree. `account.cartCount` counts the legacy table only.
          serverCartCount={podRows.length}
          podRows={podRows}
        >
          {children}
        </HireChrome>
      </HireDeskProvider>
    </HireAuthProvider>
  );
}
