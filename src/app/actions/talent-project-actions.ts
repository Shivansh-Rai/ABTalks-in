"use server";

import { revalidatePath } from "next/cache";
import { TalentMatchDecision } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  markMatchViewedSchema,
  markProjectOpenedSchema,
  renameTalentProjectSchema,
  setMatchDecisionSchema,
} from "@/lib/validations/hire";

type ActionOk<T> = { ok: true; data: T };
type ActionErr = { ok: false; message: string };
type ActionResult<T> = ActionOk<T> | ActionErr;

async function requireApprovedRecruiter(): Promise<
  ActionResult<{ userId: string }>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Sign in as an approved recruiter." };
  }
  let profile;
  try {
    profile = await prisma.recruiterProfile.findUnique({
      where: { userId: session.user.id },
      select: { approved: true },
    });
  } catch (error) {
    logger.error("[hire] requireApprovedRecruiter", { error: String(error) });
    return {
      ok: false,
      message: "Could not reach the server. Try again in a moment.",
    };
  }
  if (!profile?.approved) {
    return { ok: false, message: "Recruiter access not approved yet." };
  }
  return { ok: true, data: { userId: session.user.id } };
}

function revalidateHire(requestId: string) {
  revalidatePath("/hire");
  revalidatePath(`/hire/${requestId}`);
}

export async function renameTalentProjectAction(
  input: unknown,
): Promise<ActionResult<{ name: string }>> {
  const gate = await requireApprovedRecruiter();
  if (!gate.ok) return gate;
  const parsed = renameTalentProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  try {
    const result = await prisma.talentRequest.updateMany({
      where: {
        id: parsed.data.requestId,
        recruiterUserId: gate.data.userId,
      },
      data: { name: parsed.data.name },
    });
    if (result.count === 0) {
      return { ok: false, message: "Request not found." };
    }
    revalidateHire(parsed.data.requestId);
    return { ok: true, data: { name: parsed.data.name } };
  } catch (error) {
    logger.error("[hire] renameTalentProjectAction", { error: String(error) });
    return { ok: false, message: "Could not rename this project." };
  }
}

export async function markProjectOpenedAction(
  input: unknown,
): Promise<ActionResult<{ lastViewedAt: string }>> {
  const gate = await requireApprovedRecruiter();
  if (!gate.ok) return gate;
  const parsed = markProjectOpenedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const lastViewedAt = new Date();
  try {
    const result = await prisma.talentRequest.updateMany({
      where: {
        id: parsed.data.requestId,
        recruiterUserId: gate.data.userId,
      },
      data: { lastViewedAt },
    });
    if (result.count === 0) {
      return { ok: false, message: "Request not found." };
    }
    revalidateHire(parsed.data.requestId);
    return { ok: true, data: { lastViewedAt: lastViewedAt.toISOString() } };
  } catch (error) {
    logger.error("[hire] markProjectOpenedAction", { error: String(error) });
    return { ok: false, message: "Could not record this visit." };
  }
}

export async function markMatchViewedAction(
  input: unknown,
): Promise<ActionResult<{ viewedAt: string }>> {
  const gate = await requireApprovedRecruiter();
  if (!gate.ok) return gate;
  const parsed = markMatchViewedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const viewedAt = new Date();
  try {
    await prisma.talentRequestMatch.updateMany({
      where: {
        requestId: parsed.data.requestId,
        candidateUserId: parsed.data.candidateUserId,
        viewedAt: null,
        request: { recruiterUserId: gate.data.userId },
      },
      data: { viewedAt },
    });
    revalidateHire(parsed.data.requestId);
    return { ok: true, data: { viewedAt: viewedAt.toISOString() } };
  } catch (error) {
    logger.error("[hire] markMatchViewedAction", { error: String(error) });
    return { ok: false, message: "Could not record that this candidate was viewed." };
  }
}

export async function setMatchDecisionAction(
  input: unknown,
): Promise<ActionResult<{ decision: TalentMatchDecision }>> {
  const gate = await requireApprovedRecruiter();
  if (!gate.ok) return gate;
  const parsed = setMatchDecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const decision = parsed.data.decision as TalentMatchDecision;
  try {
    const result = await prisma.talentRequestMatch.updateMany({
      where: {
        requestId: parsed.data.requestId,
        candidateUserId: parsed.data.candidateUserId,
        request: { recruiterUserId: gate.data.userId },
      },
      data: { decision },
    });
    if (result.count === 0) {
      return { ok: false, message: "Match not found." };
    }
    revalidateHire(parsed.data.requestId);
    return { ok: true, data: { decision } };
  } catch (error) {
    logger.error("[hire] setMatchDecisionAction", { error: String(error) });
    return { ok: false, message: "Could not save that decision." };
  }
}
