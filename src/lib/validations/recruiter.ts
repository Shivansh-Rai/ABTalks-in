import { z } from "zod";

export const projectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
});
export const educationSchema = z.object({
  degree: z.string().trim().min(1).max(120),
  institution: z.string().trim().min(1).max(160),
  year: z.string().trim().max(20).default(""),
  score: z.string().trim().max(40).default(""),
});

export const projectsSchema = z.array(projectSchema).max(8).default([]);
export const educationListSchema = z.array(educationSchema).max(6).default([]);
export const achievementsSchema = z
  .array(z.string().trim().min(1).max(160))
  .max(12)
  .default([]);
export const certificationsSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(12)
  .default([]);

export type Project = z.infer<typeof projectSchema>;
export type Education = z.infer<typeof educationSchema>;

export function parseProjects(value: unknown): Project[] {
  const r = projectsSchema.safeParse(value);
  return r.success ? r.data : [];
}
export function parseEducation(value: unknown): Education[] {
  const r = educationListSchema.safeParse(value);
  return r.success ? r.data : [];
}
