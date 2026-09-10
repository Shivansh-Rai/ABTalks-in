"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { logger } from "@/lib/logger";
import { assessmentDraftSchema } from "@/lib/validations/assessment";
import {
  createAssessment,
  deleteAssessment,
  saveAssessmentDraft,
} from "@/features/recruiter-assessments/service";
import { prismaAssessmentStore } from "@/features/recruiter-assessments/prisma-store";

type ActionOk<T = undefined> = T extends undefined
  ? { ok: true }
  : { ok: true; data: T };
type ActionErr = { ok: false; message: string; status?: number };

function scopeFrom(workspace: {
  organizationId: string;
  userId: string;
}) {
  return {
    organizationId: workspace.organizationId,
    createdByUserId: workspace.userId,
  };
}

export async function saveRecruiterAssessmentAction(
  input: unknown,
): Promise<ActionOk<{ id: string }> | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  const parsed = assessmentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid assessment",
    };
  }

  try {
    const store = prismaAssessmentStore();
    const scope = scopeFrom(workspace.data);
    const result = parsed.data.assessmentId
      ? await saveAssessmentDraft(store, scope, parsed.data)
      : await createAssessment(store, scope, parsed.data);

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "CONFLICT"
            ? 409
            : undefined;
      return { ok: false, message: result.message, status };
    }

    revalidatePath("/hire/assessments");
    return { ok: true, data: { id: result.data.id } };
  } catch (error) {
    logger.error("[recruiter-assessment-actions] save", {
      error: String(error),
    });
    return { ok: false, message: "Failed to save assessment" };
  }
}

const deleteSchema = z.object({
  assessmentId: z.string().min(1),
});

export async function deleteRecruiterAssessmentAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  try {
    const result = await deleteAssessment(
      prismaAssessmentStore(),
      scopeFrom(workspace.data),
      parsed.data.assessmentId,
    );
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        status: result.code === "NOT_FOUND" ? 404 : undefined,
      };
    }
    revalidatePath("/hire/assessments");
    return { ok: true };
  } catch (error) {
    logger.error("[recruiter-assessment-actions] delete", {
      error: String(error),
    });
    return { ok: false, message: "Failed to delete assessment" };
  }
}
