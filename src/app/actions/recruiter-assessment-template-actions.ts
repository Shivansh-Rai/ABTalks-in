"use server";

import { revalidatePath } from "next/cache";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { logger } from "@/lib/logger";
import {
  createTemplate,
  deleteTemplate,
  renameTemplate,
  updateTemplateContent,
} from "@/features/recruiter-assessments/templates";
import { prismaTemplateStore } from "@/features/recruiter-assessments/template-prisma-store";

/**
 * Plan 185 — a recruiter's own assessment templates.
 *
 * Recruiter only. Every action resolves the caller with
 * requireRecruiterWorkspace() and passes that scope to the service; no action
 * reads an owner, organization or user id from its input, so a recruiter can
 * only ever name their own templates. There is deliberately no admin
 * counterpart: platform admins get JSON import in the builder and nothing here.
 *
 * Listing and opening a template are not actions. The /hire/create-test page
 * reads them on the server through the same service and scope.
 */

type ActionOk<T = undefined> = T extends undefined
  ? { ok: true }
  : { ok: true; data: T };
type ActionErr = { ok: false; message: string; status?: number };

function scopeFrom(workspace: { organizationId: string; userId: string }) {
  return {
    organizationId: workspace.organizationId,
    createdByUserId: workspace.userId,
  };
}

function statusFor(code: "NOT_FOUND" | "INVALID" | "CONFLICT"): number | undefined {
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  return undefined;
}

/** The landing lists templates and `?template=` opens one. */
function revalidateTemplates() {
  revalidatePath("/hire/create-test");
}

export async function createRecruiterAssessmentTemplateAction(
  input: unknown,
): Promise<ActionOk<{ id: string }> | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  try {
    const result = await createTemplate(
      prismaTemplateStore(),
      scopeFrom(workspace.data),
      input,
    );
    if (!result.ok) {
      return { ok: false, message: result.message, status: statusFor(result.code) };
    }
    revalidateTemplates();
    return { ok: true, data: { id: result.data.id } };
  } catch (error) {
    logger.error("[recruiter-assessment-template-actions] create", {
      error: String(error),
    });
    return { ok: false, message: "Failed to save template" };
  }
}

export async function updateRecruiterAssessmentTemplateAction(
  input: unknown,
): Promise<ActionOk<{ id: string }> | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  try {
    const result = await updateTemplateContent(
      prismaTemplateStore(),
      scopeFrom(workspace.data),
      input,
    );
    if (!result.ok) {
      return { ok: false, message: result.message, status: statusFor(result.code) };
    }
    revalidateTemplates();
    return { ok: true, data: { id: result.data.id } };
  } catch (error) {
    logger.error("[recruiter-assessment-template-actions] update", {
      error: String(error),
    });
    return { ok: false, message: "Failed to update template" };
  }
}

export async function renameRecruiterAssessmentTemplateAction(
  input: unknown,
): Promise<ActionOk<{ id: string }> | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  try {
    const result = await renameTemplate(
      prismaTemplateStore(),
      scopeFrom(workspace.data),
      input,
    );
    if (!result.ok) {
      return { ok: false, message: result.message, status: statusFor(result.code) };
    }
    revalidateTemplates();
    return { ok: true, data: { id: result.data.id } };
  } catch (error) {
    logger.error("[recruiter-assessment-template-actions] rename", {
      error: String(error),
    });
    return { ok: false, message: "Failed to rename template" };
  }
}

export async function deleteRecruiterAssessmentTemplateAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  try {
    const result = await deleteTemplate(
      prismaTemplateStore(),
      scopeFrom(workspace.data),
      input,
    );
    if (!result.ok) {
      return { ok: false, message: result.message, status: statusFor(result.code) };
    }
    revalidateTemplates();
    return { ok: true };
  } catch (error) {
    logger.error("[recruiter-assessment-template-actions] delete", {
      error: String(error),
    });
    return { ok: false, message: "Failed to delete template" };
  }
}
