import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/validations/phone";

const empty = z.literal("");

/** Explicit literals so validation never depends on a stale bundled `Domain` object. */
const domainSchema = z.enum(["SE", "DS", "AI", "CLAUDE"]);

/**
 * Legacy flat schema — matches the current registration form (no `userType` field).
 * Phone stays optional here so existing registrations keep working.
 */
export const registerSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(200),
  college: z.string().min(1, "College is required").max(200),
  graduationYear: z.number().int().min(2020).max(2035),
  domain: domainSchema,
  skills: z.array(z.string().min(1).max(50)).max(10).default([]),
  linkedinUrl: z.union([empty, z.string().url()]).default(""),
  phone: optionalPhoneSchema,
  githubUsername: z
    .union([empty, z.string().regex(/^[a-zA-Z0-9-]+$/).max(50)])
    .default(""),
  referralCode: z
    .union([empty, z.string().length(6).regex(/^[A-Z0-9]{6}$/)])
    .default(""),
});

export type RegisterInput = z.infer<typeof registerSchema>;

const studentFields = z.object({
  userType: z.literal("STUDENT"),
  college: z.string().min(1, "College is required").max(200),
  graduationYear: z.number().int().min(2020).max(2035),
});

const professionalFields = z.object({
  userType: z.literal("PROFESSIONAL"),
  organization: z.string().min(1, "Organization is required").max(200),
  role: z.string().min(1, "Role is required").max(200),
  yearsExperience: z
    .number({ error: "Years of experience is required" })
    .int()
    .min(0)
    .max(60),
});

const registerPayloadBase = z.object({
  fullName: z.string().min(1, "Name is required").max(200),
  phone: optionalPhoneSchema,
  domain: domainSchema,
  skills: z.array(z.string().min(1).max(50)).max(10).default([]),
  linkedinUrl: z.union([empty, z.string().url()]).default(""),
  githubUsername: z
    .union([empty, z.string().regex(/^[a-zA-Z0-9-]+$/).max(50)])
    .default(""),
  referralCode: z
    .union([empty, z.string().length(6).regex(/^[A-Z0-9]{6}$/)])
    .default(""),
});

/**
 * Server-side registration payload (students + professionals).
 * `completeRegistrationAction` builds this from `FormData` (including default `userType`).
 */
export const registerPayloadSchema = z.discriminatedUnion("userType", [
  registerPayloadBase.merge(studentFields),
  registerPayloadBase.merge(professionalFields),
]);

export type RegisterPayloadInput = z.infer<typeof registerPayloadSchema>;
