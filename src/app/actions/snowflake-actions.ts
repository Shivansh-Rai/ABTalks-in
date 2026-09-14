"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { SNOWFLAKE_BASE } from "@/features/snowflake/constants";
import { createSnowflakeEnrollment } from "@/features/snowflake/enroll";
import {
  submitSnowflakeMissionRun,
  type SnowflakeSubmitOk,
} from "@/features/snowflake/missions";
import {
  snowflakeEnrollSchema,
  snowflakeSubmitMissionSchema,
} from "@/lib/validations/snowflake";
import { findSnowflakeEnrollment } from "@/repositories/snowflake";

type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

export async function enrollInSnowflakeAction(
  input: unknown,
): Promise<ActionResult<{ enrollmentId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const parsed = snowflakeEnrollSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the form and try again." };
  }

  const result = await createSnowflakeEnrollment(session.user.id, parsed.data);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(SNOWFLAKE_BASE);
  return { ok: true, data: { enrollmentId: result.enrollmentId } };
}

export async function submitSnowflakeMissionAction(
  input: unknown,
): Promise<ActionResult<SnowflakeSubmitOk>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const parsed = snowflakeSubmitMissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid submission." };
  }

  const enrollment = await findSnowflakeEnrollment(session.user.id);
  if (!enrollment) {
    return { ok: false, message: "You are not enrolled in this cohort." };
  }

  const result = await submitSnowflakeMissionRun(
    enrollment,
    parsed.data.dayNumber,
    parsed.data.payload,
  );
  if ("ok" in result && result.ok === false) {
    return { ok: false, message: result.message };
  }

  revalidatePath(SNOWFLAKE_BASE);
  revalidatePath(`${SNOWFLAKE_BASE}/day/${parsed.data.dayNumber}`);
  return { ok: true, data: result as SnowflakeSubmitOk };
}
