"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import {
  assessmentDraftSchema,
  createAndSendPlatformSchema,
  editSentPlatformSchema,
} from "@/lib/validations/assessment";
import {
  createPublishAndSend,
  deletePlatformDraft,
  editSentAssessment,
  savePlatformDraft,
} from "@/features/platform-assessments/service";
import { prismaPlatformStore } from "@/features/platform-assessments/prisma-store";

/**
 * Plan 166 — platform assessments, built and sent by platform admins.
 * Every action is gated on the global ADMIN role (requireAdmin redirects
 * anyone else). No notification is sent yet: the in-app-only event type
 * needs the Notifications owner's approval.
 */

type ActionOk<T = undefined> = T extends undefined
  ? { ok: true }
  : { ok: true; data: T };
type ActionErr = { ok: false; message: string; status?: number };

function statusFor(
  code: "NOT_FOUND" | "INVALID" | "CONFLICT",
): number | undefined {
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  return undefined;
}

function revalidate(assessmentId?: string) {
  revalidatePath("/admin/assessments");
  if (assessmentId) revalidatePath(`/admin/assessments/${assessmentId}`);
}

export async function savePlatformAssessmentAction(
  input: unknown,
): Promise<ActionOk<{ id: string }> | ActionErr> {
  const admin = await requireAdmin();

  const parsed = assessmentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid assessment",
    };
  }

  try {
    const result = await savePlatformDraft(
      prismaPlatformStore(),
      admin.userId,
      parsed.data,
    );
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        status: statusFor(result.code),
      };
    }
    revalidate(result.data.id);
    return { ok: true, data: { id: result.data.id } };
  } catch (error) {
    logger.error("[admin-assessment-actions] save", { error: String(error) });
    return { ok: false, message: "Failed to save assessment" };
  }
}

const idSchema = z.object({ assessmentId: z.string().min(1).max(64) });

export async function deletePlatformAssessmentAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  await requireAdmin();

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  try {
    const result = await deletePlatformDraft(
      prismaPlatformStore(),
      parsed.data.assessmentId,
    );
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        status: statusFor(result.code),
      };
    }
    revalidate();
    return { ok: true };
  } catch (error) {
    logger.error("[admin-assessment-actions] delete", { error: String(error) });
    return { ok: false, message: "Failed to delete assessment" };
  }
}

/**
 * Save, publish and send to the chosen audience in one step. A failure after
 * the draft was saved returns its id so the builder's retry updates that draft.
 */
export async function createAndSendPlatformAssessmentAction(
  input: unknown,
): Promise<
  | ActionOk<{ id: string; assigned: number }>
  | (ActionErr & { assessmentId?: string })
> {
  const admin = await requireAdmin();

  const parsed = createAndSendPlatformSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid assessment",
    };
  }

  try {
    const result = await createPublishAndSend(
      prismaPlatformStore(),
      admin.userId,
      parsed.data,
    );
    if (!result.ok) {
      if (result.assessmentId) revalidate(result.assessmentId);
      return {
        ok: false,
        message: result.message,
        status: statusFor(result.code),
        assessmentId: result.assessmentId ?? undefined,
      };
    }
    logger.info("[admin-assessment-actions] sent", {
      assessmentId: result.data.id,
      assigned: result.data.assigned,
      adminUserId: admin.userId,
    });
    revalidate(result.data.id);
    return { ok: true, data: result.data };
  } catch (error) {
    logger.error("[admin-assessment-actions] send", { error: String(error) });
    return { ok: false, message: "Failed to send assessment" };
  }
}

/**
 * Edit a SENT assessment: anything until someone starts, then wording only;
 * the deadline can move and groups can be added (never removed).
 */
export async function editSentPlatformAssessmentAction(
  input: unknown,
): Promise<
  | ActionOk<{ id: string; mode: "FULL" | "WORDING"; added: number }>
  | ActionErr
> {
  const admin = await requireAdmin();

  const parsed = editSentPlatformSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid assessment",
    };
  }

  try {
    const result = await editSentAssessment(
      prismaPlatformStore(),
      admin.userId,
      parsed.data,
    );
    if (!result.ok) {
      return { ok: false, message: result.message, status: statusFor(result.code) };
    }
    logger.info("[admin-assessment-actions] edited", {
      assessmentId: result.data.id,
      mode: result.data.mode,
      added: result.data.added,
      adminUserId: admin.userId,
    });
    revalidate(result.data.id);
    revalidatePath("/assessments");
    return { ok: true, data: result.data };
  } catch (error) {
    logger.error("[admin-assessment-actions] edit", { error: String(error) });
    return { ok: false, message: "Failed to save changes" };
  }
}
