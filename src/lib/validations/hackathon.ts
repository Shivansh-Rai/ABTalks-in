import { z } from "zod";
import { legalAcceptanceSchema } from "@/lib/validations/legal";

/**
 * What the register popup sends.
 *
 * Name, email and phone are deliberately absent: the server reads them from
 * the session and the student profile (see `registration-identity.ts`), so the
 * form only asks for what it does not already know. `phone` survives as an
 * optional field for the rare account with no number on file — it is a plain
 * (possibly empty) string rather than `.optional()` or `.default()` because
 * either of those makes the schema's input and output types diverge, which
 * breaks react-hook-form's resolver generics. The server applies
 * `requiredPhoneSchema` to whatever it ends up with.
 */
export const participantSchema = z
  .object({
    college: z.string().trim().min(2, "College is required").max(200),
    graduationYear: z.number().int().min(2024).max(2032),
    phone: z.string().trim().max(24),
  })
  .merge(legalAcceptanceSchema);

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
