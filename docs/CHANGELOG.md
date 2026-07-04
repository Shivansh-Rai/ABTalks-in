## Pending reconcile

- 2026-07-04 [convention] AI Cohort Training Program public routes renamed from `/ai-talent-hunt` to `/ai-cohort-register` (+ `/apply` subroute).
- 2026-07-04 [rule] AI Talent Hunt applications at `/ai-talent-hunt` stored in workshop Supabase `cohort_applications` (not Neon); confirmation email deferred. Dashboard read paths must not write; streaks/daysCompleted stay write-time-only (submitDay). Immutable content (daily tasks, Challenge.startsAt) cached via unstable_cache tags daily-tasks:<challengeId> / challenge:CLAUDE, busted on reseed/redeploy.
- 2026-06-28 [rule] Marketplace item costSP raised from 250 to 1800 SP for all catalog products in marketplace.json.
- 2026-06-17 [env] RESEND_API_KEY for welcome email on registration via Resend (team@abtalks.in).
- 2026-06-12 [schema] Added RecruiterReview model for admin-curated anonymized recruiter profiles with share tokens.
- 2026-06-12 [schema] Added projects/education Json and achievements/certifications arrays to RecruiterReview for admin-curated resume sections.
- 2026-06-12 [schema] Expanded RecruiterReview to full assessment-report format with /100 scores, resume sections, and admin-only logistics/compensation.
- 2026-06-12 [convention] Server-side recruiter PDF via @react-pdf/renderer at GET /r/[token]/pdf (Node runtime only).
