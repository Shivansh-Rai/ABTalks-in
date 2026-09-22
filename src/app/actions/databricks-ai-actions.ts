"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { DATABRICKS_AI_BASE } from "@/features/databricks-ai/constants";
import { createDatabricksAiEnrollment } from "@/features/databricks-ai/enroll";
import {
  submitDatabricksAiMissionRun,
  type DatabricksAiSubmitOk,
} from "@/features/databricks-ai/missions";
import {
  databricksAiEnrollSchema,
  databricksAiSubmitMissionSchema,
} from "@/lib/validations/databricks-ai";
import { findDatabricksAiEnrollment } from "@/repositories/databricks-ai";

type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

export async function enrollInDatabricksAiAction(
  input: unknown,
): Promise<ActionResult<{ enrollmentId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const parsed = databricksAiEnrollSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the form and try again." };
  }

  const result = await createDatabricksAiEnrollment(session.user.id, parsed.data);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(DATABRICKS_AI_BASE);
  return { ok: true, data: { enrollmentId: result.enrollmentId } };
}

export async function submitDatabricksAiMissionAction(
  input: unknown,
): Promise<ActionResult<DatabricksAiSubmitOk>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const parsed = databricksAiSubmitMissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid submission." };
  }

  const enrollment = await findDatabricksAiEnrollment(session.user.id);
  if (!enrollment) {
    return { ok: false, message: "You are not enrolled in this cohort." };
  }

  const result = await submitDatabricksAiMissionRun(
    enrollment,
    parsed.data.dayNumber,
    parsed.data.payload,
  );
  if ("ok" in result && result.ok === false) {
    return { ok: false, message: result.message };
  }

  revalidatePath(DATABRICKS_AI_BASE);
  revalidatePath(`${DATABRICKS_AI_BASE}/day/${parsed.data.dayNumber}`);
  return { ok: true, data: result as DatabricksAiSubmitOk };
}
