import { z } from "zod";
import { MockInterviewStatus } from "@prisma/client";

/**
 * T-276 mock-interview admin ops — validation boundary.
 *
 * The Prisma enum drives status filters so a rename ripples once. The
 * five schemas cover the five ops verbs the admin surface offers:
 * list (with filters), get one, invalidate, delete, grant allowance.
 */

export const mockInterviewListFilterSchema = z.object({
  userId: z.string().trim().max(120).optional(),
  domainSlug: z.string().trim().max(80).optional(),
  status: z.nativeEnum(MockInterviewStatus).optional(),
  /** ISO date strings; empty is "no bound". */
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export type MockInterviewListFilter = z.infer<
  typeof mockInterviewListFilterSchema
>;

export const mockInterviewIdSchema = z.object({
  interviewId: z.string().trim().min(1).max(120),
});

export type MockInterviewIdInput = z.infer<typeof mockInterviewIdSchema>;

export const invalidateMockInterviewSchema = z.object({
  interviewId: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1, "Reason is required").max(500),
});

export type InvalidateMockInterviewInput = z.infer<
  typeof invalidateMockInterviewSchema
>;

export const deleteMockInterviewSchema = z.object({
  interviewId: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1, "Reason is required").max(500),
});

export type DeleteMockInterviewInput = z.infer<
  typeof deleteMockInterviewSchema
>;

export const grantMockAllowanceSchema = z.object({
  userId: z.string().trim().min(1).max(120),
  extraAttempts: z.number().int().min(1).max(50),
  reason: z.string().trim().min(1, "Reason is required").max(500),
});

export type GrantMockAllowanceInput = z.infer<
  typeof grantMockAllowanceSchema
>;
