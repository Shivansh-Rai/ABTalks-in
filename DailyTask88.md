# ABTalks — Daily Task Sheet

**9 – 19 September 2026.** One section per person per day: the outcome, the work, where to start, the test, the
definition of done and the evidence. Full specifications, requirements and traceability live in
`ABTalks_Execution_Plan.xlsx`.

**Calendar.** 9–10 Sep implementation · **11 Sep Demo 1 code complete** · 12 Sep Demo 1 · 13 Sep holiday ·
**14 Sep Demo 2 code complete** · 15 Sep Demo 2 · **16 Sep all implementation complete** · 17 Sep internal UAT ·
18 Sep regression and production readiness · 19 Sep live verification and release · 20 Sep holiday.

5, 7 and 8 September are locked history and appear in the workbook as LOCKED / EXECUTED.

---

## Wednesday 9 September

### Sohail

**Outcome:** As the team, everyone builds against the same isolation, authorization and persistence rules from day one.  *(Demo 1)*
**Work:** The recruiter-isolation rule, the server-side authorization rule, the database-source-of-truth rule and the idempotency rule are written down as short, checkable guardrails, and each developer's Wave-1 approach is reviewed against them before…
**Start from:** T-283; after T-004, T-147, T-148, T-149, T-150.
**Test:** Walk each developer's Wave-1 approach against the four guardrails and record the sign-off.
**Done:** Every Wave-1 approach is reviewed and signed against the four guardrails before implementation.
**Evidence:** The written guardrails and the recorded sign-off per developer.

### Shallika

**Outcome:** The candidate profile and search-result presentation are designed and approved.  *(Demo 1)*
**Work:** Profile sections, edit and empty states, validation and error states, loading states, mobile width, and how a candidate is presented in recruiter results.  **Also:** T-201 Search results and side-by-side review panel; T-203 Assessment builder and assessment-taking screens; T-202 Credits, unlock and plans screens; T-204 Jobs, application and applicant screens; +2 more on the board
**Start from:** T-200; after T-005, T-006.
**Test:** Walk every candidate screen at desktop and 375px against the pattern library.
**Done:** All candidate profile and result screens approved with five states each.
**Evidence:** Approved screens on the UI-UX sheet, at desktop and 375px.

### Shivansh

**Outcome:** As ABTalks, a candidate's claims and their proven work are distinguishable everywhere.  *(Demo 1)*
**Work:** A single evidence record links a candidate skill to its real source - an assessment result, a cohort, a hackathon or another legitimate ABTalks activity. Self-declared skills carry no evidence record.
**Start from:** T-220; no prerequisite.
**Test:** Create evidence from an assessment and from a cohort. Confirm each record names its source. Re-run the creation and confirm no duplicate.
**Done:** Evidence records exist with a real source and are idempotent. Self-declared skills remain valid and searchable without evidence.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-C-004.

### Zainab

**Outcome:** As ABTalks, only a work email can become a recruiter account, and there is no way around it.  *(Demo 1)*
**Work:** Recruiter registration refuses free personal domains - gmail.com, yahoo.com, hotmail.com, outlook.com and equivalents - server-side, with a readable reason.
**Start from:** T-225; no prerequisite.
**Test:** Try to register with each of the four personal domains - all refused. Confirm no admin screen, API or configuration can grant an exception.
**Done:** All four personal domains refused server-side. No exception mechanism exists anywhere. No recruiter social login exists. Candidate sign-in still works.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-R-001, TC-R-002.

### shashank

**Outcome:** As the team, we have actually restored a backup, not merely taken one.  *(Demo 1)*
**Work:** A real backup is restored into a separate environment and verified. The steps and the timing are written down so anyone on the team can repeat it.
**Start from:** T-260; no prerequisite.
**Test:** Restore a backup end to end and verify the data. Time it and write the steps down.
**Done:** A restore has been performed and verified, with written repeatable steps and a recorded duration.
**Evidence:** The restore log, the verification output and the written procedure.

### Manuvrtti

**Outcome:** As ABTalks, our analytics describe behaviour that actually exists, without personal data.  *(Demo 2)*
**Work:** Events are instrumented only for product behaviour that exists: recruiter signup completed, candidate profile updated, candidate skill added, job application created, job alert sent, candidate profile viewed, profile-view notification sent…  **Also:** T-252 GA4 consent and production-only loading; T-259 Error tracking and structured logging
**Start from:** T-253; after T-252.
**Test:** Fire each event and inspect the payload in DebugView, confirming it carries no personal data. Confirm none of the removed events can fire.
**Done:** Every listed event fires once with no personal data, and no removed event exists in the codebase.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-S-006.

---

## Thursday 10 September

### Sohail

**Outcome:** As ABTalks, one recruiter can never reach another recruiter's data.  *(Demo 1)*
**Work:** Every recruiter-scoped read and write resolves the caller on the SERVER.  **Also:** T-256 Server-side authorization sweep; T-257 Protected contact details absent before unlock; T-258 Rate limiting on money and contact paths
**Start from:** T-255; after T-090, T-226.
**Test:** Sign in as recruiter A and collect a project URL, job id, assessment id and pipeline id.
**Done:** An automated suite proves server-side refusal for project, pipeline, credits, ledger, jobs, assessments, unlocks and outreach across recruiters.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-R-003, TC-S-001.

### Shallika

**Outcome:** The Platform Admin console is designed and approved.  *(Demo 3)*
**Work:** Navigation, global search and results, candidate and recruiter detail, both diagnosis panels, the credit-correction dialog with mandatory reason, audit log, delivery log and the View As banner.  **Also:** T-206 Mock interview, evidence and career-guidance screens
**Start from:** T-207; after T-122.
**Test:** Walk each support scenario on the designs: find why a candidate is not appearing; why a recruiter cannot unlock; correct a credit balance; find a failed email.
**Done:** Every admin screen approved with empty, error, loading, no-results and no-permission states.
**Evidence:** Approved screens on the UI-UX sheet, at desktop and 375px.

### Shivansh

**Outcome:** As a candidate, I take an assessment without losing answers, even if I close the browser.  *(Demo 1)*
**Work:** The candidate receives an assigned assessment, reads the instructions, starts, and answers MCQ, multi-select, subjective and file-upload questions. Answers autosave server-side.  **Also:** T-212 Career profile persistence; T-213 Self-declared skills and automatic discoverability; T-217 Own-data export and immediate account deletion; T-215 Opportunity preferences
**Start from:** T-218; after T-244, T-203.
**Test:** Start an assessment, answer all four question types, close the browser mid-way, reopen on another device and confirm every answer is still there.
**Done:** All four question types work, answers autosave and survive a device change, and duplicate submission is refused server-side.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-C-012, TC-C-013.

### Zainab

**Outcome:** As the business, recruiter credits are real money handled safely.  *(Demo 1)*
**Work:** A recruiter account holds its own credit balance, starting at the configured 200 dollars.  **Also:** T-229 Contact unlock with cost shown first; T-226 Independent recruiter setup; T-230 Unlock safety - idempotent, concurrent, insufficient balance; T-233 Recruiter credit and unlock history
**Start from:** T-228; after T-148, T-226.
**Test:** Create a recruiter and confirm a 200 dollar starting balance. Change the configured starting credits and confirm a new recruiter picks it up with no deployment.
**Done:** Starting credits are 200 dollars, configurable without deploy. The ledger is append-only and the balance is derived from it.
**Evidence:** PR, automated-test output and a short browser recording.

### shashank

**Outcome:** As a recruiter, I build a real test.  *(Demo 1)*
**Work:** A recruiter creates an assessment with a title, instructions and sections, writes MCQ, multi-select, subjective and file-upload questions, reorders and edits them, sets a duration and a pass mark, and previews it using the real candidate screen.  **Also:** T-234 Talent project with persistent criteria; T-235 Server-side candidate search with pagination; T-240 Shortlist, reject and hiring pipeline; T-244 Publish, assign, monitor and results; +1 more on the board
**Start from:** T-243; after T-226, T-203.
**Test:** Build an assessment with sections and all four question types. Reorder, edit and delete questions. Set duration and pass mark. Preview it.
**Done:** Full builder CRUD persists, all four question types work, duration and pass mark save, and preview uses the real candidate screen.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-R-017.

### Manuvrtti

**Outcome:** As ABTalks, notifications reach people once, reliably, and we know what happened to each one.  *(Demo 1)*
**Work:** One notification service delivers IN-APP always and EMAIL selectively for important events.  **Also:** T-245 Recruiter jobs - create, draft, publish, close, reopen; T-246 Candidate jobs - browse, filter, apply once, track
**Start from:** T-248; after T-036, T-205.
**Test:** Fire the same event twice and confirm one notification. Force an email failure and confirm the failure and its reason are persisted.
**Done:** Notifications deduplicate, persist delivery state including failure reasons, respect preferences and are idempotent under retry.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-S-005.

---

## Friday 11 September

**Demo 1 code complete by end of day.**

### Sohail

**Outcome:** As ABTalks, admin access is granted, scoped and revoked with no deployment.  *(Demo 1)*
**Work:** Platform Admin access is a database-backed role with permissions, not an environment-variable identity. Access is granted and revoked without a deployment.  **Also:** T-269 Credit correction with mandatory reason; T-270 Audit trail for sensitive actions; T-281 Three-persona integration pass
**Start from:** T-262; after T-097, T-207.
**Test:** Grant admin to an account and confirm access with no deploy. Revoke it and confirm immediate refusal. As a signed-in non-admin, call an admin server action directly - refused.
**Done:** Admin access is database-backed, grantable and revocable without deploy, and every admin action is refused server-side for non-admins.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-A-001, TC-A-002.

### Shallika

**Outcome:** Every screen built for Demo 1 matches its approved design.  *(Demo 1)*
**Work:** Review every Demo 1 screen in the running product against the approved design. Record PASS or NEEDS FIX with a screenshot. Every NEEDS FIX becomes a bug with an owner the same day.
**Start from:** T-209; after T-200, T-201, T-202, T-203, T-204.
**Test:** Open every Demo 1 screen at desktop and 375px and compare against the approved design.
**Done:** Every Demo 1 screen recorded PASS or NEEDS FIX; blocking defects fixed before the demo.
**Evidence:** The UI-UX QA sheet completed with screenshots.

### Shivansh

**Outcome:** As a candidate, my first three mock interviews are free and I can see how many remain.  *(Demo 2)*
**Work:** Attempts one, two and three are free and the remaining free count is visible.  **Also:** T-221 Cohort and hackathon evidence; T-264 Admin candidate detail; T-214 Retire the discoverability and per-field controls
**Start from:** T-222; after T-228, T-206.
**Test:** Take three interviews and watch the remaining count fall. Start a fourth and confirm the configured cost is charged once.
**Done:** Three free attempts, visible remaining count, configured cost on the fourth, nothing consumed on failure, and both values changeable without deploying.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-C-014, TC-C-015, TC-C-016.

### Zainab

**Outcome:** As a recruiter, I email a candidate from ABTalks and their reply comes back to me.  *(Demo 1)*
**Work:** A recruiter sends an email to an unlocked candidate from inside the product. The candidate's reply is routed back to that specific recruiter, not to a shared inbox.  **Also:** T-266 Admin recruiter detail and company identity; T-231 Plans and limits; T-227 Recruiter profile and company identity
**Start from:** T-232; after T-229, T-202.
**Test:** Send an outreach email, reply as the candidate, and confirm the reply reaches that recruiter and appears in the history.
**Done:** Replies route to the sending recruiter. Outreach history persists. Failures are logged with a readable reason.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-R-014.

### shashank

**Outcome:** As a recruiter, I read a candidate beside my results without losing my place.  *(Demo 1)*
**Work:** Search results stay visible while a candidate's profile and resume open in a resizable side panel. Next and previous move through the result set.  **Also:** T-237 Non-technical hiring search; T-238 Re-run search detects genuinely new candidates; T-236 Search synonyms; T-278 Read-only talent project inspection
**Start from:** T-239; after T-235, T-201.
**Test:** Search, open a candidate, resize the panel, move next and previous through several candidates, then close. The results, criteria and scroll position are exactly as before.
**Done:** The panel resizes, next/previous work through the result set, and closing preserves criteria, results and scroll position.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-R-007.

### Manuvrtti

**Outcome:** As a candidate, I am told when a job worth applying to is published.  *(Demo 2)*
**Work:** A candidate records job-alert criteria from approved signals - skills, role, location and opportunity type.  **Also:** T-247 Applicants converge into the recruiter pipeline; T-249 Recruiter notification events
**Start from:** T-250; after T-248, T-245, T-205.
**Test:** Set criteria of React, full-time, Bengaluru. Publish a matching job - one notification and one email. Edit and re-publish the same job - nothing.
**Done:** One notification per candidate per job, nothing on re-publish, nothing for non-matching candidates, alerts can be disabled, and delivery state is recorded.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-C-009, TC-C-010, TC-C-011.

---

## Saturday 12 September

### Sohail

**Outcome:** Demo 1 - verify, fix blockers, rehearse, demonstrate.
**Work:** Run the demo, hold the release decision, and own any blocker found on the day.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shallika

**Outcome:** Demo 1 - verify, fix blockers, rehearse, demonstrate.
**Work:** Check every demonstrated screen against the approved design and log defects.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shivansh

**Outcome:** Demo 1 - verify, fix blockers, rehearse, demonstrate.
**Work:** Smoke-test the candidate journey and fix blockers found in it.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Zainab

**Outcome:** Demo 1 - verify, fix blockers, rehearse, demonstrate.
**Work:** Smoke-test recruiter signup, credits, unlock and outreach and fix blockers found in them.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### shashank

**Outcome:** Demo 1 - verify, fix blockers, rehearse, demonstrate.
**Work:** Smoke-test projects, search, review, pipeline and the assessment builder and fix blockers found in them.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Manuvrtti

**Outcome:** Demo 1 - verify, fix blockers, rehearse, demonstrate.
**Work:** Smoke-test jobs, applications and notifications and fix blockers found in them.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

---

## Monday 14 September

**Demo 2 code complete by end of day.**

### Sohail

**Outcome:** As ABTalks, we can disable, restore and secure an account safely.  *(Demo 3)*
**Work:** An operator disables an account with a reason, restores it, and triggers a secure-account action. A disabled account is refused at sign-in by the server.  **Also:** T-277 Business configuration without deployment; T-282 Pre-September journeys regression
**Start from:** T-272; after T-270, T-207.
**Test:** Disable an account with a reason and confirm sign-in is refused. Restore it and confirm access returns. Confirm no screen shows or sets a password.
**Done:** Disable, restore and secure all work with audit entries, and no operator ever sees or sets a password.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-A-010.

### Shallika

**Outcome:** Every screen built for Demo 2 matches its approved design.  *(Demo 2)*
**Work:** Review every Demo 2 screen in the running product against the approved design and raise bugs for differences.
**Start from:** T-210; after T-205, T-206, T-208.
**Test:** Open every Demo 2 screen at both widths and compare against the approved design.
**Done:** Every Demo 2 screen recorded PASS or NEEDS FIX; blocking defects fixed before the demo.
**Evidence:** The UI-UX QA sheet completed with screenshots.

### Shivansh

**Outcome:** As ABTalks, assessments record the strongest honest browser signals and claim nothing more.  *(Demo 2)*
**Work:** Fullscreen entry and exit, tab and window changes, visibility changes, copy and paste, page leave and timing are all recorded as fact against the attempt.  **Also:** T-224 Career guidance and next steps; T-223 Mock interview report; T-216 Self-reported external profile links
**Start from:** T-219; after T-218.
**Test:** Take an assessment and deliberately exit fullscreen, switch tabs, copy and paste, and leave the page. Confirm each signal is recorded with a timestamp against the attempt.
**Done:** Every listed signal is recorded and visible on the attempt. No screen or document claims eye tracking, monitor detection or cheating certainty.
**Evidence:** PR, automated-test output and a short browser recording.

### Zainab

**Outcome:** As ABTalks, our public terms and privacy describe what the product actually does.  *(Demo 2)*
**Work:** Terms and privacy are rewritten to describe automatic candidate discoverability, protected contact details behind a paid recruiter unlock, what a recruiter receives, and how a candidate exports or deletes their data.
**Start from:** T-279; after T-217, T-208.
**Test:** Read both documents against the built product and confirm every statement is true.
**Done:** Terms and privacy match the shipped behaviour with no reference to discoverability consent.
**Evidence:** PR, automated-test output and a short browser recording.

### shashank

**Outcome:** As a recruiter, I can tell at a glance what is proven and what is claimed.  *(Demo 2)*
**Work:** Every skill shown to a recruiter is labelled self-declared or evidence-backed, and an evidence-backed skill names its source. Where candidates are otherwise comparable, evidence-backed ranks higher.  **Also:** T-242 Recruiter analytics
**Start from:** T-241; after T-220, T-235, T-201.
**Test:** Search a skill where one candidate has evidence and one does not.
**Done:** Labels are correct and sourced, ranking favours evidence among comparable candidates, and zero-evidence candidates still appear.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-R-021.

### Manuvrtti

**Outcome:** As a candidate, I know when a real recruiter looked at me.  *(Demo 2)*
**Work:** When a real recruiter opens a candidate's profile the candidate is notified at most ONCE per recruiter per candidate per rolling 24 hours, in-app and selectively by email.  **Also:** T-254 UTM attribution and DebugView verification
**Start from:** T-251; after T-248, T-239, T-205.
**Test:** View a candidate three times in an hour as the same recruiter - exactly one notification. View as a second recruiter - one more.
**Done:** At most one notification per recruiter per candidate per rolling 24 hours, correctly deduplicated.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-C-018.

---

## Tuesday 15 September

### Sohail

**Outcome:** Demo 2 - verify, fix blockers, rehearse, demonstrate.
**Work:** Run the demo and own any blocker found on the day.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shallika

**Outcome:** Demo 2 - verify, fix blockers, rehearse, demonstrate.
**Work:** Check every Demo 2 screen against the approved design and log defects.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shivansh

**Outcome:** Demo 2 - verify, fix blockers, rehearse, demonstrate.
**Work:** Verify mock interviews, evidence, external links, guidance and self-delete.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Zainab

**Outcome:** Demo 2 - verify, fix blockers, rehearse, demonstrate.
**Work:** Verify credit history, terms and privacy wording.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### shashank

**Outcome:** Demo 2 - verify, fix blockers, rehearse, demonstrate.
**Work:** Verify claimed versus evidence-backed labelling, ranking and recruiter analytics.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Manuvrtti

**Outcome:** Demo 2 - verify, fix blockers, rehearse, demonstrate.
**Work:** Verify jobs, applicant convergence, job alerts, profile views and recruiter notifications.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

---

## Wednesday 16 September

**All committed implementation complete by end of day.**

### Sohail

**Outcome:** As ABTalks, we can see what a user sees without becoming them.  *(Demo 3)*
**Work:** View As requires an explicit permission. A persistent banner is visible for the whole session. Entry and exit are both audited. Dangerous actions are refused while in support mode.  **Also:** T-280 Operations guide
**Start from:** T-271; after T-270, T-207.
**Test:** Enter View As, confirm the banner is always visible, try a dangerous action and confirm refusal, then exit.
**Done:** Permission required, banner persistent, entry and exit audited, dangerous actions refused, and no session created as the target user.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-A-009.

### Shallika

**Outcome:** Every screen shipped this month matches its approved design.  *(Demo 3)*
**Work:** Final review across candidate, recruiter and admin. Every remaining visual or interaction defect in committed functionality is raised and fixed - nothing is carried forward.
**Start from:** T-211; after T-207, T-209, T-210.
**Test:** Open every screen shipped this month at both widths.
**Done:** Every screen recorded PASS; no known visual defect remains in committed functionality.
**Evidence:** The completed UI-UX QA sheet.

### Shivansh

**Outcome:** As ABTalks support, one screen tells me why a candidate is not appearing.  *(Demo 3)*
**Work:** The panel answers 'why isn't this candidate showing up?' by listing every real condition - profile usability, skills present, account state, moderation suppression, deletion state and search-index state - and naming the actual blocker in plain…  **Also:** T-273 Assessment support; T-274 Evidence explanation
**Start from:** T-265; after T-264, T-214, T-207.
**Test:** Create several genuinely non-appearing candidates - incomplete profile, no skills, suspended, moderated, deleted - and confirm the panel names the real blocker each time and never mentions consent or visibility.
**Done:** Every real condition is listed and the true blocker named. No consent, visibility or opt-out wording appears anywhere in the panel.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-A-004.

### Zainab

**Outcome:** As ABTalks support, one screen tells me why a recruiter cannot unlock.  *(Demo 3)*
**Work:** The panel answers 'why can't this recruiter unlock?' from real state: account state, plan, credit balance, whether this candidate was already unlocked, the candidate and contact state, and the actual failure reason from the last attempt.
**Start from:** T-267; after T-266, T-230, T-207.
**Test:** Create four failing situations - no credits, plan limit, suspended account and a failed attempt - and confirm the panel names the real reason each time.
**Done:** Every real blocking condition is listed and the true reason is named.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-A-005.

### shashank

**Outcome:** As an ABTalks operator, I can find any person, recruiter, job, project or assessment.  *(Demo 3)*
**Work:** One search box finds candidates, recruiters, jobs, talent projects and assessments and opens the matching record. Results are server-side and permission-checked.  **Also:** T-275 Applicant trace
**Start from:** T-263; after T-262, T-207.
**Test:** Search for a known record of each of the five types and open each result.
**Done:** All five entity types are findable and openable, with server-side permission checks.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-A-003.

### Manuvrtti

**Outcome:** As ABTalks support, I can say why a message did not arrive.  *(Demo 3)*
**Work:** Every delivery attempt is persisted with the event, the recipient, the channel, and its created, sent and failed states with a failure reason and retry state.  **Also:** T-276 Programme, cohort, hackathon and mock-interview operations
**Start from:** T-268; after T-248, T-262, T-207.
**Test:** Force a bounce and a provider failure. Find both in the console and confirm each names the real reason and its retry state.
**Done:** Every attempt is searchable with a readable failure reason and retry state.
**Evidence:** PR, automated-test output and a short browser recording. Covers TC-A-006.

---

## Thursday 17 September

### Sohail

**Outcome:** Internal UAT and blocker fixes.
**Work:** Lead UAT across all three personas; every failure gets an owner before end of day.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shallika

**Outcome:** Internal UAT and blocker fixes.
**Work:** UAT the interface across all three personas and raise every remaining visual defect.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shivansh

**Outcome:** Internal UAT and blocker fixes.
**Work:** UAT the full candidate journey and fix what is assigned.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Zainab

**Outcome:** Internal UAT and blocker fixes.
**Work:** UAT recruiter signup, money and outreach and fix what is assigned.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### shashank

**Outcome:** Internal UAT and blocker fixes.
**Work:** UAT projects, search, pipeline and assessments and fix what is assigned.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Manuvrtti

**Outcome:** Internal UAT and blocker fixes.
**Work:** UAT jobs, notifications and analytics and fix what is assigned.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

---

## Friday 18 September

### Sohail

**Outcome:** Full regression, retest and production readiness.
**Work:** Run production-readiness checks and hold the go/no-go.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shallika

**Outcome:** Full regression, retest and production readiness.
**Work:** Final visual regression across all three personas.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shivansh

**Outcome:** Full regression, retest and production readiness.
**Work:** Regression on the candidate journey and retest of every candidate-side fix.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Zainab

**Outcome:** Full regression, retest and production readiness.
**Work:** Regression on signup, credits, unlock and outreach and retest of every fix.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### shashank

**Outcome:** Full regression, retest and production readiness.
**Work:** Regression on projects, search, pipeline and assessments and retest of every fix.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Manuvrtti

**Outcome:** Full regression, retest and production readiness.
**Work:** Regression on jobs, notifications and analytics and retest of every fix.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

---

## Saturday 19 September

### Sohail

**Outcome:** Live production verification and release.
**Work:** Verify the Platform Admin console live and make the release decision.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shallika

**Outcome:** Live production verification and release.
**Work:** Verify both journeys and the admin console live against the approved design.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Shivansh

**Outcome:** Live production verification and release.
**Work:** Verify the candidate journey live on production.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Zainab

**Outcome:** Live production verification and release.
**Work:** Verify recruiter signup, credits, unlock and outreach live on production.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### shashank

**Outcome:** Live production verification and release.
**Work:** Verify projects, search, review, pipeline and assessments live on production.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

### Manuvrtti

**Outcome:** Live production verification and release.
**Work:** Verify jobs, applications, notifications and analytics live on production.
**Start from:** the demo readiness rows and the open bug list in `ABTalks_Execution_Plan.xlsx`.
**Test:** walk the journeys you own on the environment being demonstrated or released.
**Done:** every journey you own passes, or the failure is logged with an owner and a severity.
**Evidence:** signed rehearsal or verification note, plus any bug rows raised.

---

