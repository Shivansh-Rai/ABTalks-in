import "server-only";
import { CredentialStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getVerifiedSkillsWithOrigins } from "@/features/profile/get-verified-skills";
import {
  buildEvidenceProvenance,
  collectSourceIds,
  type EvidenceProvenance,
} from "@/features/admin/evidence-provenance";

/**
 * T-266 — load every evidence badge for one candidate and every row those
 * badges point at, then hand both to the pure `buildEvidenceProvenance`, which
 * decides what is traced. See that module for the pointer map.
 *
 * Two round trips: the badges, then the sources they name, batched per table.
 * Source rows are loaded by id only — never by this candidate's user id — so a
 * pointer into someone else's row is found and reported as foreign, instead of
 * silently looking missing.
 */
export async function getEvidenceProvenance(userId: string): Promise<EvidenceProvenance> {
  const [evidenceRows, credentials, achievements, programmeSkills] = await Promise.all([
    prisma.skillEvidence.findMany({
      where: { candidateSkill: { userId } },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        sourceLabel: true,
        candidateSkill: { select: { skillId: true, skill: { select: { name: true } } } },
      },
    }),
    prisma.credential.findMany({
      where: { userId, status: CredentialStatus.ISSUED },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        credentialId: true,
        type: true,
        sourceType: true,
        sourceKey: true,
        title: true,
        metadata: true,
        issuedAt: true,
      },
    }),
    prisma.candidateAchievement.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      select: { id: true, sourceType: true, sourceId: true, title: true, outcomeLabel: true },
    }),
    getVerifiedSkillsWithOrigins(userId),
  ]);

  const evidence = evidenceRows.map((e) => ({
    id: e.id,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    sourceLabel: e.sourceLabel,
    skillId: e.candidateSkill.skillId,
    skillName: e.candidateSkill.skill.name,
  }));

  const ids = collectSourceIds({ evidence, credentials, achievements });
  const inIds = (s: Set<string>) => ({ id: { in: [...s] } });

  const [
    scores,
    evaluations,
    linkedCredentials,
    enrollments,
    participants,
    teams,
    workshops,
    certificates,
    reports,
  ] = await Promise.all([
    ids.score.size
      ? prisma.assessmentScore.findMany({
          where: inIds(ids.score),
          select: {
            id: true,
            dimension: true,
            score: true,
            maxScore: true,
            createdAt: true,
            report: { select: { title: true, candidateUserId: true, assessedAt: true } },
          },
        })
      : [],
    ids.evaluation.size
      ? prisma.activityEvaluation.findMany({
          where: inIds(ids.evaluation),
          select: {
            id: true,
            passed: true,
            isAuthoritative: true,
            score: true,
            maxScore: true,
            createdAt: true,
            attempt: {
              select: {
                submittedAt: true,
                enrollment: {
                  select: { userId: true, cohort: { select: { slug: true, name: true } } },
                },
                activity: {
                  select: {
                    title: true,
                    dayNumber: true,
                    module: {
                      select: {
                        programVersion: { select: { program: { select: { title: true } } } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [],
    ids.credential.size
      ? prisma.credential.findMany({
          where: inIds(ids.credential),
          select: { id: true, credentialId: true, userId: true, status: true },
        })
      : [],
    ids.enrollment.size
      ? prisma.programEnrollment.findMany({
          where: inIds(ids.enrollment),
          select: {
            id: true,
            userId: true,
            status: true,
            completedAt: true,
            cohort: {
              select: {
                slug: true,
                name: true,
                programVersion: { select: { program: { select: { title: true } } } },
              },
            },
          },
        })
      : [],
    ids.participant.size
      ? prisma.hackathonParticipant.findMany({
          where: inIds(ids.participant),
          select: {
            id: true,
            userId: true,
            createdAt: true,
            team: {
              select: {
                eventId: true,
                teamName: true,
                submission: { select: { createdAt: true, problem: { select: { title: true } } } },
              },
            },
          },
        })
      : [],
    ids.team.size
      ? prisma.hackathonTeam.findMany({
          where: inIds(ids.team),
          select: {
            id: true,
            eventId: true,
            teamName: true,
            participants: { where: { userId }, select: { createdAt: true } },
            submission: { select: { createdAt: true, problem: { select: { title: true } } } },
          },
        })
      : [],
    ids.workshop.size
      ? prisma.workshopRegistration.findMany({
          where: inIds(ids.workshop),
          select: { id: true, userId: true, eventId: true, createdAt: true },
        })
      : [],
    ids.certificate.size
      ? prisma.historicalCertificate.findMany({
          // Historical SkillEvidence / COHORT / WORKSHOP / Phase 2g hackathon
          // keys point at frozen Certificate.id, archived as legacyId.
          where: { legacyId: { in: [...ids.certificate] } },
          select: {
            legacyId: true,
            userId: true,
            type: true,
            status: true,
            issuedAt: true,
            metadata: true,
          },
        }).then((rows) =>
          rows.map((row) => ({
            id: row.legacyId,
            userId: row.userId,
            type: row.type,
            status: row.status,
            issuedAt: row.issuedAt,
            metadata: row.metadata,
          })),
        )
      : [],
    ids.report.size
      ? prisma.assessmentReport.findMany({
          where: inIds(ids.report),
          select: {
            id: true,
            candidateUserId: true,
            title: true,
            recommendation: true,
            assessedAt: true,
            createdAt: true,
          },
        })
      : [],
  ]);

  return buildEvidenceProvenance(userId, {
    evidence,
    credentials,
    achievements,
    programmeSkills,
    scores,
    evaluations: evaluations.map((ev) => ({
      ...ev,
      attempt: {
        submittedAt: ev.attempt.submittedAt,
        enrollment: ev.attempt.enrollment,
        activity: {
          title: ev.attempt.activity.title,
          dayNumber: ev.attempt.activity.dayNumber,
          programTitle: ev.attempt.activity.module.programVersion.program.title,
        },
      },
    })),
    linkedCredentials,
    enrollments: enrollments.map((pe) => ({
      ...pe,
      cohort: {
        slug: pe.cohort.slug,
        name: pe.cohort.name,
        programTitle: pe.cohort.programVersion.program.title,
      },
    })),
    participants,
    teams: teams.map((t) => ({
      id: t.id,
      eventId: t.eventId,
      teamName: t.teamName,
      candidateJoinedAt: t.participants[0]?.createdAt ?? null,
      submission: t.submission,
    })),
    workshops,
    certificates,
    reports,
  });
}
