import { z } from "zod";
import { PipelineStage } from "@prisma/client";

/**
 * T-240 recruiter hiring pipeline — validation boundary.
 *
 * The Prisma-generated `PipelineStage` enum is the single source of truth for
 * the nine stages. Wrap it here so every action, server route and client
 * component parses the same shape and TypeScript refuses a bad enum member at
 * compile time.
 */
export const pipelineStageSchema = z.nativeEnum(PipelineStage);

export const addToPipelineInputSchema = z.object({
  candidateUserId: z.string().min(1).max(120),
  stage: pipelineStageSchema.optional(),
});

export const moveStageInputSchema = z.object({
  itemId: z.string().min(1).max(120),
  stage: pipelineStageSchema,
});

export const removeItemInputSchema = z.object({
  itemId: z.string().min(1).max(120),
});

export type AddToPipelineInput = z.infer<typeof addToPipelineInputSchema>;
export type MoveStageInput = z.infer<typeof moveStageInputSchema>;
export type RemoveItemInput = z.infer<typeof removeItemInputSchema>;
