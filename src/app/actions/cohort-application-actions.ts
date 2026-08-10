"use server";

import { workshopSupabase } from "@/lib/workshop-supabase";
import { logger } from "@/lib/logger";
import {
  cohortApplicationSchema,
  type CohortApplicationInput,
} from "@/lib/validations/cohort-application";
import { recordLegalConsents } from "@/features/legal/record-consent";
import { recordNewsletterOptIn } from "@/features/legal/record-newsletter-optin";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";

export async function submitCohortApplicationAction(input: CohortApplicationInput) {
  const parsed = cohortApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const d = parsed.data;

  const { data: existing } = await workshopSupabase
    .from("cohort_applications")
    .select("id")
    .eq("email", d.email)
    .maybeSingle();
  if (existing) {
    return { ok: false as const, message: "You've already applied with this email." };
  }

  const { error } = await workshopSupabase.from("cohort_applications").insert({
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email,
    linkedin_url: d.linkedinUrl,
    visa_category: d.visaCategory,
    education_level: d.educationLevel,
    total_experience: d.totalExperience,
    ai_ml_experience: d.aiMlExperience,
    current_title_company: d.currentTitleCompany,
    industry: d.industry,
    primary_languages_tools: d.primaryLanguagesTools,
    why_interested: d.whyInterested,
    what_to_achieve: d.whatToAchieve,
    target_role: d.targetRole,
    commit_hours: d.commitHours,
    attend_sessions: d.attendSessions,
    understand_pre_call: d.understandPreCall,
    based_in_usa: d.basedInUsa,
    ready_for_challenge: d.readyForChallenge,
    preferred_start_window: d.preferredStartWindow,
  });
  if (error) {
    logger.error("cohort application insert failed", { error });
    return { ok: false as const, message: "Something went wrong. Please try again." };
  }

  try {
    await recordLegalConsents({
      email: d.email,
      source: "cohort_us",
    });
  } catch (consentErr) {
    logger.error("cohort US legal consent log failed", {
      error: consentErr instanceof Error ? consentErr.message : String(consentErr),
      terms: TERMS_VERSION,
      privacy: PRIVACY_VERSION,
    });
  }

  await recordNewsletterOptIn({
    email: d.email,
    source: "cohort_us",
    optIn: d.newsletterOptIn === true,
  });

  return { ok: true as const };
}
