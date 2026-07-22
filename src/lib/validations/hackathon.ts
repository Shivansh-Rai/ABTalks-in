import { z } from "zod";
import { requiredPhoneSchema } from "@/lib/validations/phone";

export const participantSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: requiredPhoneSchema,
  college: z.string().trim().min(2, "College is required").max(200),
  graduationYear: z.number().int().min(2024).max(2032),
});

export const teamCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Team code must be 6 characters");

export const hackathonRegistrationSchema = z.discriminatedUnion("entryType", [
  participantSchema.extend({
    entryType: z.literal("SOLO"),
  }),
  participantSchema.extend({
    entryType: z.literal("TEAM_CREATE"),
    teamName: z.string().trim().min(2, "Team name is required").max(60),
  }),
  participantSchema.extend({
    entryType: z.literal("TEAM_JOIN"),
    teamCode: teamCodeSchema,
  }),
]);

export type HackathonRegistrationInput = z.infer<
  typeof hackathonRegistrationSchema
>;
