import "server-only";

import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type RemoveParticipantResult =
  | {
      ok: true;
      data: {
        userId: string;
        fullName: string;
        email: string;
        slotIndex: number;
        teamId: string;
        teamCode: string;
        teamName: string | null;
        spotsLeft: number;
      };
    }
  | { ok: false; message: string };

export async function removeParticipant(args: {
  participantId: string;
  teamId: string;
  removedByUserId: string;
  removedByRole: "LEADER" | "ADMIN";
  reason?: string | null;
}): Promise<RemoveParticipantResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const target = await tx.hackathonParticipant.findFirst({
        where: { id: args.participantId, teamId: args.teamId },
        select: {
          id: true,
          userId: true,
          slotIndex: true,
          isLeader: true,
          fullName: true,
          email: true,
          phone: true,
          college: true,
          graduationYear: true,
          sourceSlug: true,
          createdAt: true,
          team: {
            select: {
              id: true,
              teamCode: true,
              teamName: true,
              entryType: true,
            },
          },
        },
      });

      if (!target) {
        return {
          ok: false as const,
          message: "That member is no longer on this team.",
        };
      }
      if (target.isLeader) {
        return {
          ok: false as const,
          message: "The team leader can't be removed.",
        };
      }
      if (target.team.entryType === "SOLO") {
        return {
          ok: false as const,
          message: "Solo entries have no team members to remove.",
        };
      }

      await tx.hackathonRemoval.create({
        data: {
          teamId: target.team.id,
          teamCode: target.team.teamCode,
          teamName: target.team.teamName,
          userId: target.userId,
          fullName: target.fullName,
          email: target.email,
          phone: target.phone,
          college: target.college,
          graduationYear: target.graduationYear,
          slotIndex: target.slotIndex,
          sourceSlug: target.sourceSlug,
          originalJoinedAt: target.createdAt,
          removedByUserId: args.removedByUserId,
          removedByRole: args.removedByRole,
          reason: args.reason ?? null,
        },
      });

      await tx.hackathonParticipant.delete({ where: { id: target.id } });

      if (args.removedByRole === "ADMIN") {
        await tx.adminAction.create({
          data: {
            adminUserId: args.removedByUserId,
            targetUserId: target.userId,
            actionType: "REMOVE_HACKATHON_TEAM_MEMBER",
            metadata: {
              teamCode: target.team.teamCode,
              teamName: target.team.teamName,
              slotIndex: target.slotIndex,
              participantId: target.id,
            },
            reason: args.reason ?? null,
          },
        });
      }

      const remaining = await tx.hackathonParticipant.count({
        where: { teamId: args.teamId },
      });

      return {
        ok: true as const,
        data: {
          userId: target.userId,
          fullName: target.fullName,
          email: target.email,
          slotIndex: target.slotIndex,
          teamId: target.team.id,
          teamCode: target.team.teamCode,
          teamName: target.team.teamName,
          spotsLeft: HACKATHON.maxTeamSize - remaining,
        },
      };
    });
  } catch (error) {
    logger.error("hackathon participant removal failed", { error });
    return {
      ok: false,
      message: "Something went wrong. Please try again.",
    };
  }
}

export async function getLastRemovalForUser(userId: string): Promise<{
  teamName: string | null;
  teamCode: string;
  createdAt: string;
} | null> {
  try {
    const row = await prisma.hackathonRemoval.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { teamName: true, teamCode: true, createdAt: true },
    });
    if (!row) return null;
    return {
      teamName: row.teamName,
      teamCode: row.teamCode,
      createdAt: row.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}
