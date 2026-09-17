import { z } from "zod";

/*
 * What the recruiter has typed so far, and where it goes.
 *
 * Nothing here is written to the server. The account fields reach
 * `registerRecruiterWithOtpAction` on the Verify step; the optional company
 * fields reach `updateRecruiterProfileAction` once the recruiter is signed in.
 *
 * The draft lives in sessionStorage — it survives a refresh, not a closed tab
 * — because it holds a name and a work email. It never holds a code.
 */

export const STEP_IDS = ["welcome", "identity", "company", "verify", "complete"] as const;
export type StepId = (typeof STEP_IDS)[number];

/** The three steps the progress rail names. Welcome and the finish sit outside. */
export const PROGRESS_STEPS: { id: StepId; label: string }[] = [
  { id: "identity", label: "You" },
  { id: "company", label: "Company" },
  { id: "verify", label: "Verify" },
];

export const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,000+"] as const;

export const INDUSTRIES = [
  "Software & SaaS",
  "IT services & consulting",
  "AI & data",
  "Fintech & banking",
  "E-commerce & retail",
  "Edtech",
  "Healthcare",
  "Manufacturing",
  "Media & marketing",
  "Staffing & recruitment",
  "Other",
] as const;

export const draftSchema = z.object({
  v: z.literal(1),
  step: z.enum(STEP_IDS),
  fullName: z.string().max(120),
  email: z.string().max(254),
  company: z.string().max(200),
  website: z.string().max(200),
  industry: z.string().max(80),
  companySize: z.string().max(40),
  companyLocation: z.string().max(120),
  newsletterOptIn: z.boolean(),
  /** The account exists. Verify can never run twice for this draft. */
  registered: z.boolean(),
});

export type OnboardingDraft = z.infer<typeof draftSchema>;

export const EMPTY_DRAFT: OnboardingDraft = {
  v: 1,
  step: "welcome",
  fullName: "",
  email: "",
  company: "",
  website: "",
  industry: "",
  companySize: "",
  companyLocation: "",
  newsletterOptIn: true,
  registered: false,
};

const DRAFT_KEY = "abtalks-recruiter-onboarding";

export function readDraft(): OnboardingDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeDraft(draft: OnboardingDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private mode or a full quota: the flow still works, it just won't
    // survive a refresh.
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function hasCompanyExtras(draft: OnboardingDraft): boolean {
  return Boolean(
    draft.website.trim() ||
      draft.industry.trim() ||
      draft.companySize.trim() ||
      draft.companyLocation.trim(),
  );
}
