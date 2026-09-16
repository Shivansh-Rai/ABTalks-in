"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deleteMockInterview,
  grantMockInterviewAllowance,
  invalidateMockInterview,
} from "@/features/admin/mock-interview-admin";
import {
  deleteMockInterviewSchema,
  grantMockAllowanceSchema,
  invalidateMockInterviewSchema,
} from "@/lib/validations/mock-interview-admin";

/**
 * T-276 mock-interview admin server actions.
 *
 * Each action:
 * - Gates on `requireAdmin()` (throws a Next redirect on non-admin).
 * - Zod-parses input — no client-supplied admin identity is trusted.
 * - Delegates the mutation + audit to the repository.
 * - Revalidates the admin list + detail routes.
 */

type ActionOk<T = undefined> = T extends undefined
  ? { ok: true }
  : { ok: true; data: T };
type ActionErr = { ok: false; message: string; code?: string; status?: number };

export async function invalidateMockInterviewAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  const admin = await requireAdmin();

  const parsed = invalidateMockInterviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
      status: 400,
    };
  }

  const result = await invalidateMockInterview(parsed.data, admin.userId);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/admin/mock-interview");
  revalidatePath(`/admin/mock-interview/${parsed.data.interviewId}`);
  return { ok: true };
}

export async function deleteMockInterviewAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  const admin = await requireAdmin();

  const parsed = deleteMockInterviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
      status: 400,
    };
  }

  const result = await deleteMockInterview(parsed.data, admin.userId);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/admin/mock-interview");
  return { ok: true };
}

export async function grantMockInterviewAllowanceAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  const admin = await requireAdmin();

  const parsed = grantMockAllowanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
      status: 400,
    };
  }

  const result = await grantMockInterviewAllowance(parsed.data, admin.userId);
  if (result.ok) {
    revalidatePath("/admin/mock-interview");
    return { ok: true };
  }

  return {
    ok: false,
    message: result.message,
    code: "code" in result ? result.code : undefined,
  };
}
