import "server-only";
import {
  CertificateStatus,
  CertificateType,
  Domain,
  EnrollmentStatusV2,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { getChallengeProgressStats } from "@/repositories/progress";
import { listForUser } from "@/repositories/credentials";
import {
  certificateDomainLabel,
  certificateTypeFromCredentialTitle,
  parseHackathonVariant,
  type HackathonCertificateVariant,
} from "@/features/certificate/constants";

/**
 * Verified Accomplishments — what the platform can attest to, derived.
 *
 * Every row here is read from a record another part of the system already
 * wrote: `Certificate`/`Credential`, `Enrollment`, `ProgramEnrollment`,
 * `HackathonParticipant`. Nothing is stored for this section, nothing is
 * inferred, and the candidate cannot add, edit or delete any of it. A candidate
 * with no history gets an empty list, not an encouraging guess.
 *
 * Contrast `CandidateProfile.awards`, which is the candidate's own prose, and
 * `CandidateCertification`, which is external certifications they typed in.
 */

export type VerifiedAccomplishment = {
  key: string;
  title: string;
  /** One quiet line under the title. Null when there is nothing honest to add. */
  detail: string | null;
  /** The pill: "Completed", "Winner", "Top 5", … */
  outcomeLabel: string;
  /** Null when the source row carries no meaningful date. */
  occurredAt: Date | null;
};

/** Claude's certificate is the gate; the other tracks gate on days completed. */
const CHALLENGE_ELIGIBLE_DAYS = 50;

/**
 * Product wording for the profile, which differs from the certificate artwork's
 * labels ("2nd place" / "3rd place" in HACKATHON_VARIANT_LABELS). Kept separate
 * so /achievements keeps saying what is printed on the PDF.
 */
const HACKATHON_PLACEMENT_LABELS: Record<HackathonCertificateVariant, string> = {
  winner: "Winner",
  second: "Runner Up",
  third: "Second Runner Up",
  top5: "Top 5",
};

/**
 * Challenge enrolments are ALSO mirrored into ProgramEnrollment against a
 * `legacy-<domain>` cohort (repositories/dual-write.ts). Without this exclusion
 * a finished challenge would be listed twice: once by the challenge rule and
 * again as a "cohort" carrying the challenge's own name.
 *
 * `legacy-program-<id>` is NOT excluded — that is the real AI Cohort Program.
 */
const CHALLENGE_MIRROR_COHORT_SLUGS = Object.values(Domain).map(
  (d) => `legacy-${d.toLowerCase()}`,
);

/** Highest first — a user holding several hackathon rows shows only the best. */
const HACKATHON_PLACEMENT_RANK: HackathonCertificateVariant[] = [
  "winner",
  "second",
  "third",
  "top5",
];

function metaRecord(metadata: unknown): Record<string, unknown> {
  if (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export async function getVerifiedAccomplishments(
  userId: string,
): Promise<VerifiedAccomplishment[]> {
  const [credentials, enrollments, programEnrollments, participant] =
    await Promise.all([
      // Repository boundary: this is flag-aware (Credential vs legacy
      // Certificate). Never read either table directly from here.
      listForUser(userId),
      prisma.enrollment.findMany({
        where: { userId, domain: { in: [Domain.SE, Domain.DS, Domain.AI] } },
        select: {
          id: true,
          domain: true,
          daysCompleted: true,
          completedAt: true,
          startedAt: true,
        },
      }),
      prisma.programEnrollment.findMany({
        where: {
          userId,
          OR: [
            { status: EnrollmentStatusV2.COMPLETED },
            { completedAt: { not: null } },
          ],
          cohort: { slug: { notIn: CHALLENGE_MIRROR_COHORT_SLUGS } },
        },
        select: {
          id: true,
          completedAt: true,
          updatedAt: true,
          cohort: { select: { name: true } },
        },
      }),
      prisma.hackathonParticipant.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          team: {
            select: {
              teamName: true,
              submission: { select: { id: true, createdAt: true } },
            },
          },
        },
      }),
    ]);

  const live = credentials.filter(
    (row) => row.status !== CertificateStatus.REVOKED,
  );
  const out: VerifiedAccomplishment[] = [];

  /* ── Claude Challenge: gated on the certificate existing, nothing else ── */
  const claude = live.find(
    (row) =>
      certificateTypeFromCredentialTitle(row.title) ===
      CertificateType.CLAUDE_CHALLENGE,
  );
  if (claude) {
    const meta = metaRecord(claude.metadata);
    const days =
      typeof meta.daysCompleted === "number" ? meta.daysCompleted : null;
    out.push({
      key: `claude-${claude.credentialId}`,
      title: "60-Day Claude Challenge",
      detail:
        days === null
          ? "Claude AI Mastery Track"
          : `Claude AI Mastery Track · ${days} days completed`,
      outcomeLabel: "Completed",
      occurredAt: claude.issuedAt,
    });
  }

  /* ── SE / AI / DS: gated on 50+ days, certificate or not ── */
  const challengeStats = await Promise.all(
    enrollments.map(async (e) => ({
      enrollment: e,
      // Flag-aware: derives from attempts when the 078 progress read is on,
      // and falls back to the legacy Enrollment snapshot when it is not.
      stats: await getChallengeProgressStats(e.id),
    })),
  );
  for (const { enrollment, stats } of challengeStats) {
    if (stats.daysCompleted < CHALLENGE_ELIGIBLE_DAYS) continue;
    out.push({
      key: `challenge-${enrollment.id}`,
      title: `60-Day ${certificateDomainLabel(enrollment.domain)} Challenge`,
      detail: `${stats.daysCompleted} days completed`,
      outcomeLabel: "Completed",
      occurredAt: enrollment.completedAt ?? enrollment.startedAt,
    });
  }

  /* ── Cohort: only once the platform recorded the run as finished ── */
  for (const program of programEnrollments) {
    out.push({
      key: `cohort-${program.id}`,
      title: program.cohort.name,
      detail: "AI Cohort Program",
      outcomeLabel: "Completed",
      occurredAt: program.completedAt ?? program.updatedAt,
    });
  }

  /* ── ViCoDathon: best placement if any, else participation ── */
  const hackathonRows = live.filter(
    (row) =>
      certificateTypeFromCredentialTitle(row.title) === CertificateType.HACKATHON,
  );
  const variants = hackathonRows
    .map((row) => parseHackathonVariant(metaRecord(row.metadata).hackathonVariant))
    .filter((v): v is HackathonCertificateVariant => v !== null);
  const best = HACKATHON_PLACEMENT_RANK.find((v) => variants.includes(v)) ?? null;

  const hasSubmission = Boolean(participant?.team.submission);
  if (hackathonRows.length > 0 || hasSubmission) {
    const anchor = hackathonRows[0];
    const teamName = participant?.team.teamName ?? null;
    out.push({
      key: anchor ? `hackathon-${anchor.credentialId}` : `hackathon-${participant?.id}`,
      title: "ViCoDathon 2026",
      detail: teamName
        ? `India's AI Vibe Coding Hackathon · Team ${teamName}`
        : "India's AI Vibe Coding Hackathon",
      outcomeLabel: best
        ? HACKATHON_PLACEMENT_LABELS[best]
        : "Participated in ViCoDathon",
      occurredAt:
        anchor?.issuedAt ??
        participant?.team.submission?.createdAt ??
        participant?.createdAt ??
        null,
    });
  }

  // Most recent first; undated rows sink to the bottom rather than to 1970.
  return out.sort((a, b) => {
    const at = a.occurredAt?.getTime() ?? 0;
    const bt = b.occurredAt?.getTime() ?? 0;
    return bt - at;
  });
}
