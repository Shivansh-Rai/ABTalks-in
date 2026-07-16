"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const bodySchema = z.string().trim().min(1).max(2000);

const createInput = z.object({
  studentUserId: z.string().min(1),
  body: bodySchema,
});

const updateInput = z.object({
  remarkId: z.string().min(1),
  body: bodySchema,
});

const deleteInput = z.object({
  remarkId: z.string().min(1),
});

export async function createAdminRemarkAction(input: {
  studentUserId: string;
  body: string;
}) {
  const admin = await requireAdmin();
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { studentUserId, body } = parsed.data;

  const student = await prisma.user.findUnique({
    where: { id: studentUserId },
    select: { studentProfile: { select: { id: true } } },
  });
  if (!student?.studentProfile) {
    return { ok: false as const, message: "Student not found" };
  }

  await prisma.adminRemark.create({
    data: {
      studentUserId,
      adminUserId: admin.userId,
      body,
    },
  });

  revalidatePath(`/admin/students/${studentUserId}`);
  return { ok: true as const };
}

export async function updateAdminRemarkAction(input: {
  remarkId: string;
  body: string;
}) {
  await requireAdmin();
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { remarkId, body } = parsed.data;

  const existing = await prisma.adminRemark.findUnique({
    where: { id: remarkId },
    select: { id: true, studentUserId: true },
  });
  if (!existing) {
    return { ok: false as const, message: "Remark not found" };
  }

  await prisma.adminRemark.update({
    where: { id: remarkId },
    data: { body },
  });

  revalidatePath(`/admin/students/${existing.studentUserId}`);
  return { ok: true as const };
}

export async function deleteAdminRemarkAction(input: { remarkId: string }) {
  await requireAdmin();
  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid input" };

  const { remarkId } = parsed.data;

  const existing = await prisma.adminRemark.findUnique({
    where: { id: remarkId },
    select: { id: true, studentUserId: true },
  });
  if (!existing) {
    return { ok: false as const, message: "Remark not found" };
  }

  await prisma.adminRemark.delete({
    where: { id: remarkId },
  });

  revalidatePath(`/admin/students/${existing.studentUserId}`);
  return { ok: true as const };
}
