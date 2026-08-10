## Pending reconcile

<!-- Reconciled through 2026-08-05 (commit 519cc34) into docs/project-context.md. -->

- 2026-08-10 [rule|convention] Plan 059 legal hardening: entity + Grievance Officer blocks (24h ack / 15d resolve) on /terms /privacy /contact with <<FILL>> placeholders; draft banner removed; DPDP s13/s14 rights; certificate non-accreditation, Synergy Points non-currency, Fees, Indemnity, 30-day notice-before-suit; new /cookies + /contact; blocking cookie consent modal (all|limited|essential) gating abtalks_ref/abtalks_src in middleware, stored in abtalks_consent cookie with no DB row; DSAR email notification + /admin/data-requests; reconsent banner on version bump. Client-safe constants split into src/lib/legal-constants.ts (importing @/lib/legal from a client component pulled node:fs/promises into the browser bundle). Versions bumped to 2026-08-10. NOTE: migration 20260808120000_legal_consent_and_rights still unapplied to Neon — LegalConsent/DataRightsRequest tables do not exist yet
- 2026-08-08 [schema|convention] Added LegalConsent + DataRightsRequest tables, ProgramMember.recruiterVisibilityConsentAt, public /terms /privacy + funnel consent logging (DPDP-oriented)
- 2026-08-06 [schema] Baselined orphaned HackathonProblem/HackathonSubmission migration and added /hackathon/submission flow on the existing tables to avoid shared-Neon drift
- 2026-08-06 [rule] Hackathon registration stays open until registrationClosesUtc (Fri 7 Aug 2026 6:00 PM IST); registrationOpen remains an emergency kill switch
- 2026-08-07 [rule] Hackathon registrationOpen kill switch set false; unregistered /hackathon/dashboard visitors see closed message instead of register redirect
- 2026-08-09 [convention] /admin/students lists challenge + hackathon via track filter (ALL|CHALLENGE|HACKATHON)
- 2026-08-09 [rule] Extended hackathon submission deadline to Sun 9 Aug 10:00 PM IST
- 2026-08-09 [rule] Adjusted hackathon submission deadline to Sun 9 Aug 8:45 PM IST
