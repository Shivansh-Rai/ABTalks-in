import { z } from "zod";
import { optionalPhoneSchema } from "./phone";

export const recruiterRegisterSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  company: z.string().trim().min(1, "Company is required").max(120),
  phone: optionalPhoneSchema,
});

export type RecruiterRegisterInput = z.infer<typeof recruiterRegisterSchema>;

export const shortlistToggleSchema = z.object({
  memberId: z.string().cuid(),
});

export const shortlistNoteSchema = z.object({
  memberId: z.string().cuid(),
  note: z.string().max(2000),
});

export const adminRecruiterActionSchema = z.object({
  recruiterProfileId: z.string().cuid(),
});

export const talentPoolFiltersSchema = z.object({
  q: z.string().max(120).optional(),
  skills: z.string().max(200).optional(),
  minYears: z.coerce.number().int().min(0).max(40).optional(),
  minScore: z.coerce.number().int().min(0).max(2000).optional(),
  page: z.coerce.number().int().min(1).max(100).optional(),
});
