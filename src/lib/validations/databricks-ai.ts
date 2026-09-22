import { z } from "zod";
import { DATABRICKS_AI_TOTAL_DAYS } from "@/features/databricks-ai/constants";
import { normalizeGithubUsername } from "@/lib/validations/candidate-profile";

const githubRepoRegex =
  /^https:\/\/github\.com\/([a-zA-Z0-9-]{1,39})\/([a-zA-Z0-9._-]{1,100})\/?$/;

export const databricksAiEnrollSchema = z
  .object({
    linkedinUrl: z
      .string()
      .trim()
      .url("Enter a valid URL")
      .refine((v) => /linkedin\.com/i.test(v), "Enter your LinkedIn profile URL"),
    skills: z
      .array(z.string().trim().min(1).max(40))
      .min(1, "Add at least one skill")
      .max(8, "Max 8 skills"),
    githubUsername: z
      .string()
      .trim()
      .refine((v) => normalizeGithubUsername(v) !== null, {
        message: "Enter a valid GitHub username or profile URL",
      })
      .transform((v) => normalizeGithubUsername(v)!),
    githubRepoUrl: z
      .string()
      .trim()
      .regex(
        githubRepoRegex,
        "Enter a public repo URL like https://github.com/owner/repo",
      ),
    hasLaptopAndAccount: z.literal(true, {
      error: "Confirm you're set up for this cohort",
    }),
  })
  .refine(
    (data) => {
      const match = data.githubRepoUrl.match(githubRepoRegex);
      if (!match) return false;
      return match[1]!.toLowerCase() === data.githubUsername.toLowerCase();
    },
    {
      path: ["githubRepoUrl"],
      message: "The repo owner must match your GitHub username",
    },
  );

export type DatabricksAiEnrollInput = z.infer<typeof databricksAiEnrollSchema>;

export const databricksAiMissionDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(DATABRICKS_AI_TOTAL_DAYS),
});

export const databricksAiSubmitMissionSchema = z.object({
  dayNumber: z.number().int().min(1).max(DATABRICKS_AI_TOTAL_DAYS),
  payload: z.union([
    z.object({
      answers: z.array(z.union([z.string().max(500), z.number()])).max(20),
    }),
    z.object({}),
  ]),
});
