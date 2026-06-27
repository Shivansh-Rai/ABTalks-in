"use server";

import { auth } from "@/auth";
import { redeemItemSchema } from "@/lib/validations/marketplace";
import { redeemItem } from "@/features/marketplace/redeem-item";

export async function redeemItemAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, reason: "auth", message: "Sign in required" };
  }
  const parsed = redeemItemSchema.safeParse({
    itemId: formData.get("itemId"),
    shippingAddress: formData.get("shippingAddress"),
    recipientPhone: formData.get("recipientPhone"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      reason: "validation" as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  return redeemItem({ userId: session.user.id, ...parsed.data });
}
