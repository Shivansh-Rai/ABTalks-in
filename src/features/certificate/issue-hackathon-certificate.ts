import "server-only";
import {
  CertificateType,
  CredentialSourceType,
  CredentialType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  hackathonParticipationSourceKey,
  issueHackathonParticipationCredential,
  issueHackathonPlacementCredential,
} from "@/repositories/credentials-write";
import type { HackathonCertificateVariant } from "./constants";

/** Stamped into metadata so a future event can be told apart from this one. */
export const HACKATHON_EVENT_KEY = "vicodathon-2026";

/** 00:00 IST on 14 Aug 2026 — DATE OF ISSUE on ViCoDathon certs. */
export const HACKATHON_CERTIFICATE_ISSUED_AT = new Date(
  "2026-08-13T18:30:00.000Z",
);

export type HackathonCertificateResult =
  | { ok: true; data: { certificateId: string; alreadyIssued: boolean } }
  | { ok: false; message: string };

const PARTICIPANT_SELECT = {
  fullName: true,
  isLeader: true,
  team: {
    select: {
      id: true,
      teamCode: true,
      teamName: true,
      entryType: true,
      submission: {
        select: {
          repoUrl: true,
          liveUrl: true,
          aiLogUrl: true,
          updatedAt: true,
          problem: { select: { title: true } },
        },
      },
    },
  },
} as const;

export async function ensureHackathonCertificate(
  userId: string,
): Promise<HackathonCertificateResult> {
  const participant = await prisma.hackathonParticipant.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: PARTICIPANT_SELECT,
  });

  if (!participant) {
    return { ok: false, message: "Not registered for the hackathon" };
  }

  const submission = participant.team.submission;
  if (!submission) {
    return { ok: false, message: "Team has no submission" };
  }

  const repoUrl = submission.repoUrl.trim();
  const liveUrl = submission.liveUrl.trim();
  if (!repoUrl || !liveUrl) {
    return { ok: false, message: "Submission is missing a repo URL or a live URL" };
  }

  const fullName = participant.fullName.trim();
  if (!fullName) {
    const [existingCert, existingCred] = await Promise.all([
      prisma.historicalCertificate.findFirst({
        where: { userId, type: CertificateType.HACKATHON },
        select: { certificateId: true },
      }),
      prisma.credential.findUnique({
        where: {
          type_sourceType_sourceKey: {
            type: CredentialType.PARTICIPATION,
            sourceType: CredentialSourceType.HACKATHON_TEAM,
            sourceKey: hackathonParticipationSourceKey(
              HACKATHON_EVENT_KEY,
              participant.team.id,
              userId,
            ),
          },
        },
        select: { credentialId: true },
      }),
    ]);
    if (!existingCert && !existingCred) {
      return {
        ok: false,
        message: "Participant has no name on their hackathon registration",
      };
    }
  }

  return issueHackathonParticipationCredential({
    userId,
    recipientName: fullName,
    issuedAt: new Date(),
    eventKey: HACKATHON_EVENT_KEY,
    teamId: participant.team.id,
    metadata: {
      event: HACKATHON_EVENT_KEY,
      teamId: participant.team.id,
      teamCode: participant.team.teamCode,
      teamName: participant.team.teamName,
      entryType: participant.team.entryType,
      isLeader: participant.isLeader,
      problemTitle: submission.problem?.title ?? null,
      repoUrl,
      liveUrl,
      submittedAt: submission.updatedAt.toISOString(),
    },
  });
}

export async function ensureHackathonAwardCertificate(input: {
  userId: string;
  variant: HackathonCertificateVariant;
  recipientName: string;
}): Promise<HackathonCertificateResult> {
  const { userId, variant } = input;
  const recipientName = input.recipientName.trim();
  if (!recipientName) {
    return { ok: false, message: "Recipient name is required" };
  }

  const participant = await prisma.hackathonParticipant.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: PARTICIPANT_SELECT,
  });

  if (!participant) {
    return { ok: false, message: "Not registered for the hackathon" };
  }

  const submission = participant.team.submission;
  const repoUrl = submission?.repoUrl.trim() ?? "";
  const liveUrl = submission?.liveUrl.trim() ?? "";

  return issueHackathonPlacementCredential({
    userId,
    variant,
    recipientName,
    issuedAt: HACKATHON_CERTIFICATE_ISSUED_AT,
    eventKey: HACKATHON_EVENT_KEY,
    teamId: participant.team.id,
    metadata: {
      event: HACKATHON_EVENT_KEY,
      teamId: participant.team.id,
      teamCode: participant.team.teamCode,
      teamName: participant.team.teamName,
      entryType: participant.team.entryType,
      isLeader: participant.isLeader,
      problemTitle: submission?.problem?.title ?? null,
      repoUrl,
      liveUrl,
      submittedAt: submission?.updatedAt.toISOString() ?? null,
      hackathonVariant: variant,
    },
  });
}
