## Pending reconcile

<!-- Reconciled through 2026-08-05 (commit 519cc34) into docs/project-context.md. -->

- 2026-08-08 [schema|convention] Added LegalConsent + DataRightsRequest tables, ProgramMember.recruiterVisibilityConsentAt, public /terms /privacy + funnel consent logging (DPDP-oriented)
- 2026-08-06 [schema] Baselined orphaned HackathonProblem/HackathonSubmission migration and added /hackathon/submission flow on the existing tables to avoid shared-Neon drift
- 2026-08-06 [rule] Hackathon registration stays open until registrationClosesUtc (Fri 7 Aug 2026 6:00 PM IST); registrationOpen remains an emergency kill switch
- 2026-08-07 [rule] Hackathon registrationOpen kill switch set false; unregistered /hackathon/dashboard visitors see closed message instead of register redirect
- 2026-08-09 [convention] /admin/students lists challenge + hackathon via track filter (ALL|CHALLENGE|HACKATHON)
- 2026-08-09 [rule] Extended hackathon submission deadline to Sun 9 Aug 10:00 PM IST
- 2026-08-09 [rule] Adjusted hackathon submission deadline to Sun 9 Aug 8:45 PM IST
