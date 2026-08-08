"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dataRightsRequestSchema } from "@/lib/validations/legal";

export async function submitDataRightsRequestAction(input: unknown) {
  const parsed = dataRightsRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const session = await auth();
  const email = parsed.data.email.trim().toLowerCase();

  await prisma.dataRightsRequest.create({
    data: {
      userId: session?.user?.id ?? null,
      email,
      type: parsed.data.type,
      message: parsed.data.message?.trim() || null,
    },
    select: { id: true },
  });

  return { ok: true as const };
}
