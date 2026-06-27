import { z } from "zod";

export const redeemItemSchema = z.object({
  itemId: z.string().cuid("Invalid item"),
  shippingAddress: z.string().min(20, "Address looks too short").max(1000),
  recipientPhone: z.string().min(7, "Enter a valid phone").max(20),
});

export const updateRedemptionStatusSchema = z.object({
  redemptionId: z.string().cuid(),
  nextStatus: z.enum(["SHIPPED", "FULFILLED", "CANCELLED"]),
  trackingNote: z.string().max(500).optional(),
});
