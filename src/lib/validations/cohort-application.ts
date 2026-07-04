import { z } from "zod";

export const VISA_CATEGORIES = [
  "US Citizen",
  "Permanent Resident (Green Card)",
  "H-1B",
  "H-4 EAD",
  "L-1 / L-2 EAD",
  "OPT (F-1)",
  "STEM OPT Extension",
  "CPT (F-1)",
  "O-1",
  "TN Visa (Canada/Mexico)",
  "E-3 (Australia)",
  "Other / Not applicable",
] as const;

export const EDUCATION_LEVELS = [
  "High School / GED",
  "Associate Degree",
  "Bachelor's Degree - Computer Science / Engineering",
  "Bachelor's Degree - Other Field",
  "Master's Degree - Computer Science / AI / Data Science",
  "Master's Degree - Other Field",
  "PhD - Computer Science / AI / Related",
  "PhD - Other Field",
  "Bootcamp / Self-taught",
  "Professional Certifications (AWS, GCP, Azure, etc.)",
] as const;

export const TOTAL_EXPERIENCE = [
  "Less than 1 year",
  "1-2 years",
  "3-5 years",
  "6-9 years",
  "10-15 years",
  "15+ years",
] as const;

export const AI_ML_EXPERIENCE = [
  "None - completely new to AI/ML",
  "Under 6 months (hobby / self-study)",
  "6-12 months",
  "1-2 years",
  "3-5 years",
  "5+ years",
] as const;

export const INDUSTRIES = [
  "Technology / Software",
  "Finance / FinTech / Banking",
  "Healthcare / Life Sciences",
  "Retail / E-commerce",
  "Manufacturing / Supply Chain",
  "Consulting / Advisory",
  "Government / Public Sector",
  "Education / Research",
  "Media / Entertainment",
  "Other",
] as const;

export const TARGET_ROLES = [
  "AI / ML Engineer",
  "MLOps / AI Platform Engineer",
  "AI Solutions Architect",
  "AI Product Manager",
  "AI Security Engineer",
  "Data Scientist moving into AI Engineering",
  "Enterprise AI Consultant",
  "AI Research Engineer",
  "Not sure yet - exploring options",
  "Other",
] as const;

export const START_WINDOWS = [
  "As soon as possible",
  "Within 2-4 weeks",
  "Within 1-2 months",
  "Flexible - ready whenever the cohort launches",
] as const;

const confirmed = z.literal(true, { error: "Please confirm to continue." });

export const cohortApplicationSchema = z.object({
  // Step 1 — Personal
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  linkedinUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .refine((v) => /linkedin\.com/i.test(v), "Enter your LinkedIn profile URL"),
  visaCategory: z.enum(VISA_CATEGORIES, { error: "Select an option" }),
  // Step 2 — Professional
  educationLevel: z.enum(EDUCATION_LEVELS, { error: "Select an option" }),
  totalExperience: z.enum(TOTAL_EXPERIENCE, { error: "Select an option" }),
  aiMlExperience: z.enum(AI_ML_EXPERIENCE, { error: "Select an option" }),
  currentTitleCompany: z.string().trim().min(1, "This field is required").max(200),
  industry: z.enum(INDUSTRIES, { error: "Select an option" }),
  primaryLanguagesTools: z.string().trim().min(1, "This field is required").max(300),
  // Step 3 — Story
  whyInterested: z
    .string()
    .trim()
    .min(50, "Please write at least a few sentences")
    .max(2500),
  whatToAchieve: z
    .string()
    .trim()
    .min(50, "Please write at least a few sentences")
    .max(2500),
  targetRole: z.enum(TARGET_ROLES, { error: "Select an option" }),
  // Step 4 — Commitment
  commitHours: confirmed,
  attendSessions: confirmed,
  understandPreCall: confirmed,
  basedInUsa: confirmed,
  readyForChallenge: confirmed,
  preferredStartWindow: z.enum(START_WINDOWS, { error: "Select an option" }),
});

export type CohortApplicationInput = z.infer<typeof cohortApplicationSchema>;
