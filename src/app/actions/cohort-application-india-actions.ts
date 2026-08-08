"use server";

import { workshopSupabase } from "@/lib/workshop-supabase";
import { logger } from "@/lib/logger";
import {
  cohortApplicationIndiaSchema,
  type CohortApplicationIndiaInput,
} from "@/lib/validations/cohort-application-india";
import { recordLegalConsents } from "@/features/legal/record-consent";

export async function submitCohortApplicationIndiaAction(
  input: CohortApplicationIndiaInput,
) {
  const parsed = cohortApplicationIndiaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const d = parsed.data;

  const { data: existing } = await workshopSupabase
    .from("cohort_applications_india")
    .select("id")
    .eq("email", d.email)
    .maybeSingle();
  if (existing) {
    return { ok: false as const, message: "You've already applied with this email." };
  }

  const { error } = await workshopSupabase.from("cohort_applications_india").insert({
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email,
    linkedin_url: d.linkedinUrl,
    originated_in_india: d.originatedInIndia,
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
    ready_for_challenge: d.readyForChallenge,
    preferred_start_window: d.preferredStartWindow,
  });
  if (error) {
    logger.error("cohort india application insert failed", { error });
    return { ok: false as const, message: "Something went wrong. Please try again." };
  }

  try {
    await recordLegalConsents({
      email: d.email,
      source: "cohort_india",
    });
  } catch (consentErr) {
    logger.error("cohort India legal consent log failed", {
      error: consentErr instanceof Error ? consentErr.message : String(consentErr),
    });
  }

  return { ok: true as const };
}
