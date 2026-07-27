"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{1,32}$/, "Slug must be 1-32 chars: a-z, 0-9, - or _");

const createInput = z.object({
  slug: slugSchema,
  label: z.string().trim().min(1, "Label is required").max(120),
  note: z.string().trim().max(200).optional(),
});

const updateInput = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  label: z.string().trim().min(1, "Label is required").max(120),
  note: z.string().trim().max(200).optional(),
});

const deleteInput = z.object({
  id: z.string().min(1),
});

export async function createHackathonLinkAction(input: {
  slug: string;
  label: string;
  note?: string;
}) {
  await requireAdmin();
  const parsed = createInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { slug, label, note } = parsed.data;

  const existing = await prisma.hackathonLink.findUnique({ where: { slug } });
  if (existing) {
    return { ok: false as const, message: `Slug "${slug}" already exists` };
  }

  await prisma.hackathonLink.create({
    data: { slug, label, note: note || null },
  });

  revalidatePath("/admin/hackathon-links");
  return { ok: true as const };
}

export async function updateHackathonLinkAction(input: {
  id: string;
  slug: string;
  label: string;
  note?: string;
}) {
  await requireAdmin();
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, slug, label, note } = parsed.data;

  const existing = await prisma.hackathonLink.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false as const, message: "Link not found" };
  }

  if (slug !== existing.slug) {
    const conflict = await prisma.hackathonLink.findUnique({ where: { slug } });
    if (conflict) {
      return { ok: false as const, message: `Slug "${slug}" already exists` };
    }
  }

  await prisma.hackathonLink.update({
    where: { id },
    data: { slug, label, note: note || null },
  });

  revalidatePath("/admin/hackathon-links");
  return { ok: true as const };
}

export async function deleteHackathonLinkAction(input: { id: string }) {
  await requireAdmin();
  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid input" };
  }

  const existing = await prisma.hackathonLink.findUnique({
    where: { id: parsed.data.id },
  });
  if (!existing) {
    return { ok: false as const, message: "Link not found" };
  }

  await prisma.hackathonLink.delete({ where: { id: parsed.data.id } });

  revalidatePath("/admin/hackathon-links");
  return { ok: true as const };
}
