import { z } from "zod";
import { candidateRefSchema } from "@/lib/validations/hire-request";

/**
 * The unlock boundary.
 *
 * One field. That is the whole point of this file: an unlock request names a
 * candidate and nothing else. It carries no cost, no balance, no organization
 * id and no recruiter id, because every one of those is something the server
 * already knows and the browser could otherwise edit — a payload that can carry
 * a price is a payload that can carry `0`.
 *
 * `candidateRefSchema` validates the *shape* of the handle. Whether this
 * recruiter may reach that candidate is re-checked against the pool in
 * `unlockContact`, because a well-formed ref proves nothing about entitlement.
 */
export const unlockContactSchema = z.object({
  candidateRef: candidateRefSchema,
});

export type UnlockContactInput = z.infer<typeof unlockContactSchema>;
