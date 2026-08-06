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

export const sourceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{1,32}$/, "Invalid source slug");

export const removeTeamMemberSchema = z.object({
  participantId: z.string().trim().min(1, "Missing participant"),
  reason: z.string().trim().max(500).optional(),
});

export type RemoveTeamMemberInput = z.infer<typeof removeTeamMemberSchema>;

const hackathonRepoRegex =
  /^https:\/\/github\.com\/([a-zA-Z0-9-]{1,39})\/([a-zA-Z0-9._-]{1,100})\/?$/;

export const hackathonSubmissionSchema = z.object({
  problemId: z.string().trim().min(1, "Pick a brief").max(64),
  repoUrl: z
    .string()
    .trim()
    .max(500)
    .regex(
      hackathonRepoRegex,
      "Enter a public repo URL like https://github.com/you/project",
    ),
  liveUrl: z
    .union([z.literal(""), z.string().trim().url("Enter a valid URL").max(500)])
    .default(""),
  aiLogUrl: z
    .union([z.literal(""), z.string().trim().url("Enter a valid URL").max(500)])
    .default(""),
});

export type HackathonSubmissionInput = z.infer<
  typeof hackathonSubmissionSchema
>;
