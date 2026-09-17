"use server";

import { revalidatePath } from "next/cache";
import { TalentMatchDecision } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  deleteTalentProjectSchema,
  markMatchViewedSchema,
  markProjectOpenedSchema,
  renameTalentProjectSchema,
  setMatchDecisionSchema,
  togglePinTalentProjectSchema,
} from "@/lib/validations/hire";
import { dispatch as dispatchNotification } from "@/features/notification/notification-service";
import { prismaProfileViewStore } from "@/features/profile-view-notification/store";
import { notifyProfileViewed } from "@/features/profile-view-notification/service";

type ActionOk<T> = { ok: true; data: T };
type ActionErr = { ok: false; message: string };
type ActionResult<T> = ActionOk<T> | ActionErr;

async function requireApprovedRecruiter(): Promise<
  ActionResult<{ userId: string }>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Sign in as a recruiter to continue." };
  }
  let profile;
  try {
    profile = await prisma.recruiterProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
  } catch (error) {
    logger.error("[hire] requireApprovedRecruiter", { error: String(error) });
    return {
      ok: false,
      message: "Could not reach the server. Try again in a moment.",
    };
  }
  if (!profile) {
    return { ok: false, message: "Register as a recruiter first." };
  }
  return { ok: true, data: { userId: session.user.id } };
}

function revalidateHire(requestId: string) {
  revalidatePath("/hire");
  revalidatePath(`/hire/${requestId}`);
  revalidatePath("/hire/projects");
  // "layout" scope, not the bare path: the header's shortlist count and panel
  // are built in the /hire LAYOUT (app/hire/layout.tsx), which a page-scoped
  // revalidate leaves untouched. Without this a project shortlist landed in
  // TalentRequestMatch correctly and the header still showed the old count
  // until a full reload. Same reason talent-actions.ts does it for the cart.
  revalidatePath("/hire", "layout");
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

export async function deleteTalentProjectAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireApprovedRecruiter();
  if (!gate.ok) return gate;
  const parsed = deleteTalentProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  try {
    const result = await prisma.talentRequest.updateMany({
      where: {
        id: parsed.data.requestId,
        recruiterUserId: gate.data.userId,
      },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) {
      return { ok: false, message: "Request not found." };
    }
    revalidateHire(parsed.data.requestId);
    return { ok: true, data: { id: parsed.data.requestId } };
  } catch (error) {
    logger.error("[hire] deleteTalentProjectAction", { error: String(error) });
    return { ok: false, message: "Could not delete this project." };
  }
}

export async function togglePinTalentProjectAction(
  input: unknown,
): Promise<ActionResult<{ pinned: boolean }>> {
  const gate = await requireApprovedRecruiter();
  if (!gate.ok) return gate;
  const parsed = togglePinTalentProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  try {
    const existing = await prisma.talentRequest.findFirst({
      where: {
        id: parsed.data.requestId,
        recruiterUserId: gate.data.userId,
      },
      select: { extra: true },
    });
    if (!existing) {
      return { ok: false, message: "Request not found." };
    }

    const currentExtra =
      existing.extra &&
      typeof existing.extra === "object" &&
      !Array.isArray(existing.extra)
        ? (existing.extra as Record<string, unknown>)
        : {};

    const nextPinned =
      typeof parsed.data.pinned === "boolean"
        ? parsed.data.pinned
        : !Boolean(currentExtra.pinned);

    const mergedExtra = { ...currentExtra, pinned: nextPinned };

    const result = await prisma.talentRequest.updateMany({
      where: {
        id: parsed.data.requestId,
        recruiterUserId: gate.data.userId,
      },
      data: { extra: mergedExtra },
    });
    if (result.count === 0) {
      return { ok: false, message: "Request not found." };
    }
    revalidateHire(parsed.data.requestId);
    return { ok: true, data: { pinned: nextPinned } };
  } catch (error) {
    logger.error("[hire] togglePinTalentProjectAction", {
      error: String(error),
    });
    return { ok: false, message: "Could not update project pin status." };
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
    // Persistence only. Revalidating `/hire/${id}` would reload matches with
    // lastViewedAt = now() and recompute isNew against this visit, so every
    // New badge would die on the page that should show them. The already
    // rendered result keeps the previous timestamp; the next full load uses
    // this write. The project list does not display lastViewedAt, so /hire
    // is not revalidated either.
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
  } catch (error) {
    logger.error("[hire] markMatchViewedAction", { error: String(error) });
    return { ok: false, message: "Could not record that this candidate was viewed." };
  }

  // T-251: notify the candidate that a real recruiter viewed them. Wrapped
  // in its own try so a notification failure never fails the recruiter's
  // view action — the DB update above is already committed.
  try {
    await notifyProfileViewed(
      { store: prismaProfileViewStore(), dispatch: dispatchNotification },
      {
        candidateUserId: parsed.data.candidateUserId,
        recruiterUserId: gate.data.userId,
      },
    );
  } catch (error) {
    logger.error("[hire] profile-view notify failed", {
      error: String(error),
      candidateUserId: parsed.data.candidateUserId,
    });
  }

  return { ok: true, data: { viewedAt: viewedAt.toISOString() } };
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
