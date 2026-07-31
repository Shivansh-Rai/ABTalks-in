"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { removeParticipant } from "@/features/hackathon/remove-participant";
import { prisma } from "@/lib/db";
import {
  sendLeaderMemberRemovedEmail,
  sendMemberRemovedEmail,
} from "@/lib/hackathon-email";
import { logger } from "@/lib/logger";
import {
  removeTeamMemberSchema,
  type RemoveTeamMemberInput,
} from "@/lib/validations/hackathon";

function removalsLocked(): boolean {
  return Date.now() >= new Date(HACKATHON.rosterLockUtc).getTime();
}

export async function removeHackathonTeamMemberAction(
  input: RemoveTeamMemberInput,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, message: "Not authenticated" };
  }

  const parsed = removeTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const me = await prisma.hackathonParticipant.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      teamId: true,
      isLeader: true,
      fullName: true,
      email: true,
      team: { select: { entryType: true } },
    },
  });

  if (!me) {
    return {
      ok: false as const,
      message: "You're not registered for the hackathon.",
    };
  }
  if (!me.isLeader) {
    return {
      ok: false as const,
      message: "Only the team leader can remove members.",
    };
  }
  if (me.team.entryType === "SOLO") {
    return {
      ok: false as const,
      message: "Solo entries don't have teammates.",
    };
  }

  if (removalsLocked()) {
    return {
      ok: false as const,
      message: `Team changes closed on ${HACKATHON.rosterLockLabel}. Message the organizers on WhatsApp if you need a change.`,
    };
  }

  if (parsed.data.participantId === me.id) {
    return {
      ok: false as const,
      message:
        "You can't remove yourself. Contact the organizers to leave or transfer the team.",
    };
  }

  const result = await removeParticipant({
    participantId: parsed.data.participantId,
    teamId: me.teamId,
    removedByUserId: session.user.id,
    removedByRole: "LEADER",
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    return { ok: false as const, message: result.message };
  }

  try {
    await sendMemberRemovedEmail(
      result.data.fullName,
      result.data.email,
      result.data.teamName,
    );
    await sendLeaderMemberRemovedEmail(
      me.fullName,
      me.email,
      result.data.fullName,
      result.data.teamName,
      result.data.teamCode,
      result.data.spotsLeft,
    );
  } catch (error) {
    logger.error("hackathon removal emails failed", { error });
  }

  revalidatePath("/hackathon/dashboard");
  revalidatePath("/admin/hackathon");

  return {
    ok: true as const,
    data: {
      fullName: result.data.fullName,
      spotsLeft: result.data.spotsLeft,
    },
  };
}
