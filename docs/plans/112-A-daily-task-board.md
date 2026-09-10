# 112-A — Daily Task Board · 5–19 September 2026

> **Deadline: Sunday 20 September — which is a Sunday, so the product goes LIVE on Saturday 19 September.**
> **Sundays 6, 13 and 20 September are HOLIDAYS. Nobody works them.**
> 13 working days, of which 10 are build days. FULL committed scope is in this plan - nothing was deferred.

## Before your first task

1. **Investigate → Plan → Review → Implement → Test → Regression → Done.** Start every task with prompt **P1**, never P3.
2. **Check your design first.** If your row has a Design dependency, confirm it is *Approved* on the UI-UX sheet before writing frontend code.
3. **HIGH RISK means stop after the plan** and send it to Sohail. Do not start coding.
4. **Do the Regression Check** — that is testing what you did *not* build.
5. **Shallika reviews the running app**, not screenshots. Blockers get fixed; minor cosmetic issues become October bugs.

| Person | Role | Load |
|---|---|---|
| **Shallika** | UI/UX Designer — full time, no code | 105% of design days |
| **Shivansh** | Developer — full time | 154% |
| **Zainab** | Developer — full time | 148% |
| **shashank** | Developer — full time | 145% |
| **Manuvrtti** | Developer — part time | 165% |
| **Sohail** | Architect + builder + release | 152% |

> **Everyone is scheduled at ~150% of capacity.** This is stated, not hidden — see Delivery Risk at the end. Build in priority order so that whatever slips is the least critical work.

---

## Saturday 05 September — FOUNDATION

*Decisions, contracts and finding out what already exists.*

### Shallika · *designer*

- [ ] `T-005` **As the team, we need to know where the product currently looks and feels inconsistent - but only on the journeys we are shipping.** *(day 1 of 3)*
    - **🟢 LOW** · P0
    - **What needs to work:** A short written audit of the recruiter and candidate journeys in the 20 Sep scope: inconsistent buttons, forms, cards, spacing, typography, navigation, missing states, confusing steps, responsive breakages. NOT a whole-platform review.
    - **Find out first:** Walk the live product as a real recruiter and a real candidate. Note what confuses you. Stay inside the September journeys - do not audit pages we are not shipping.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk both journeys end to end. Screenshot every inconsistency.
    - **Done when:** A written list, grouped by journey, ranked by how much it hurts the user. Anything not on a September journey is marked P2 and parked.
- [ ] `T-007` **As a recruiter, signing up and landing in my workspace should feel like a real product.** *(day 1 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for recruiter signup, the five onboarding steps, the workspace shell and Home - including every state and how they behave on a phone.
    - **Find out first:** Read the recruiter journey on the User Journeys sheet first. Design the FLOW, not five separate screens.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk a developer through the flow. They can describe what happens at every step without asking you a question.
    - **Done when:** Every screen and every state: loading, empty, error, success, disabled. Desktop and mobile. Handoff includes the user goal, the flow, what each component does, validation behaviour and interaction notes. APPROVED before Wednesday so R1 and R12 can start.

### Shivansh

- [ ] `T-013` **As the team, we must stop assuming the candidate profile works because the code exists.** *(day 1 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** Every profile section checked against: add, read, change, remove, validate, survives a logout, has empty/error/loading states, works on a phone, is private when it should be, shows correctly to a recruiter. Every failure written down.
    - **Find out first:** Use the profile with a fresh account, section by section, BEFORE reading code.
    - **Prompts:** P1 Investigate.
    - **Manual test:** Fresh account. Each section: add, save, reload, log out, log in, edit, remove. Note every failure.
    - **Done when:** A written gap list with severities. This sizes the rest of C1 - if it is bigger than 3 days of fixes, we cut sections rather than slipping.

### Zainab

- [ ] `T-029` **As the team, we must be certain how a recruiter earns the right to see contact details.** *(day 1 of 3)*
    - **🔴 HIGH RISK** · P0 · waits on D-5, D-8
    - **What needs to work:** A written flow: click contact, check the plan allowance, record that access was granted, show the details - plus what happens at zero allowance and what the candidate is told.
    - **Find out first:** Today a human admin approves each release. It moves to a plan allowance. Ask Claude to find the ONE function that decides whether a recruiter may see contact details - it must keep deciding, unchanged.
    - **Prompts:** P1 Investigate -> STOP for Sohail. This releases personal data.
    - **Manual test:** Walk the flow with Sohail. Confirm the privacy wording matches what the site publicly promises.
    - **Done when:** Flow approved by Sohail. The single access-deciding function is unchanged. Candidate-facing wording agreed.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### shashank

- [ ] `T-022` **As the team, we need to know whether saving a search today actually saves a recruiter's WORK.** *(day 1 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** A written answer: after signing out and returning, what survives - criteria, matched candidates, who was viewed, who was shortlisted? Each backed by the code that proves it.
    - **Find out first:** Use the product first: create a search, sign out, come back, see what is lost. Then ask Claude why.
    - **Prompts:** P1 Investigate, scoped to the search module.
    - **Manual test:** Create a search, note three candidates, sign out, sign back in. Write down exactly what disappeared.
    - **Done when:** A written answer per item with the field that proves it. This sizes the rest of R3.

### Sohail

- [ ] `T-001` **As the team, we need the decisions that block everyone settled before Wednesday.** *(day 1 of 4)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every blocking decision is written down with a one-line reason. Nobody builds against a guess.
    - **Find out first:** Three are already agreed (payments deferred, contact unlock by plan allowance, no company verification) - just record them. The rest need a call.
    - **Prompts:** No AI. Product judgement.
    - **Manual test:** Open the decision record. Every question has an answer, not a question.
    - **Done when:** All decisions marked Decided with a reason and the tasks each unblocks. No task starts Wednesday against an open decision.
    - **⛔ Sohail owns and signs this himself.**
- [ ] `T-002` **As the team, we must know that database changes can reach production before we write any.**
    - **🔴 HIGH RISK** · P0 · waits on D-2
    - **What needs to work:** Either the path is proven on a copy of the database, or the blocker is understood and resolved. Written down either way.
    - **Find out first:** The docs contradict each other. Settle it with a real run against a COPY of the database, never production.
    - **Prompts:** P11 Database review. Ask Claude to explain the blocker, not fix it.
    - **Manual test:** Run it against a copy. Read the output. Paste it into the decision record.
    - **Done when:** Output recorded. If it failed, the resolution is written down and tested. No database change merges until this is done.
    - **⛔ Sohail owns and signs this himself.**

---

## Sunday 06 September — HOLIDAY

> No work. No development, design, QA, review or testing.

---

## Monday 07 September — FOUNDATION

*Decisions close. Wave-1 designs must be approved by tomorrow evening.*

### Shallika · *designer*

- [ ] `T-005` **As the team, we need to know where the product currently looks and feels inconsistent - but only on the journeys we are shipping.** *(day 3 of 3)*
    - **🟢 LOW** · P0
    - **What needs to work:** A short written audit of the recruiter and candidate journeys in the 20 Sep scope: inconsistent buttons, forms, cards, spacing, typography, navigation, missing states, confusing steps, responsive breakages. NOT a whole-platform review.
    - **Find out first:** Walk the live product as a real recruiter and a real candidate. Note what confuses you. Stay inside the September journeys - do not audit pages we are not shipping.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk both journeys end to end. Screenshot every inconsistency.
    - **Done when:** A written list, grouped by journey, ranked by how much it hurts the user. Anything not on a September journey is marked P2 and parked.
- [ ] `T-006` **As a developer, I need agreed patterns so I am not inventing a button style at 11pm.** *(day 1 of 2)*
    - **🟢 LOW** · P0
    - **What needs to work:** The handful of patterns these journeys need are defined and named: buttons, inputs, dropdowns, cards, tables, badges, modals, navigation, alerts/toasts, plus loading, empty, error and success states.
    - **Find out first:** A design system document already exists in the repo. EXTEND it - do not start a new one, and do not redesign components that already work.
    - **Prompts:** No AI needed.
    - **Manual test:** A developer can point at any element in the September journeys and find its pattern.
    - **Done when:** Patterns documented and referenced from the design files. Small enough to be usable this month - this is consistency, not an enterprise system.
- [ ] `T-007` **As a recruiter, signing up and landing in my workspace should feel like a real product.** *(day 3 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for recruiter signup, the five onboarding steps, the workspace shell and Home - including every state and how they behave on a phone.
    - **Find out first:** Read the recruiter journey on the User Journeys sheet first. Design the FLOW, not five separate screens.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk a developer through the flow. They can describe what happens at every step without asking you a question.
    - **Done when:** Every screen and every state: loading, empty, error, success, disabled. Desktop and mobile. Handoff includes the user goal, the flow, what each component does, validation behaviour and interaction notes. APPROVED before Wednesday so R1 and R12 can start.

### Shivansh

- [ ] `T-013` **As the team, we must stop assuming the candidate profile works because the code exists.** *(day 3 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** Every profile section checked against: add, read, change, remove, validate, survives a logout, has empty/error/loading states, works on a phone, is private when it should be, shows correctly to a recruiter. Every failure written down.
    - **Find out first:** Use the profile with a fresh account, section by section, BEFORE reading code.
    - **Prompts:** P1 Investigate.
    - **Manual test:** Fresh account. Each section: add, save, reload, log out, log in, edit, remove. Note every failure.
    - **Done when:** A written gap list with severities. This sizes the rest of C1 - if it is bigger than 3 days of fixes, we cut sections rather than slipping.

### Zainab

- [ ] `T-003` **As a developer, I need the shared helpers to exist so I am not blocked by someone else's feature.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Four shared helpers exist as no-op stubs that type-check: check a plan limit, send a notification, record a candidate signal, add someone to a shortlist.
    - **Find out first:** None exist. Check for anything similar before creating new files.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Import each from a test file. The project builds.
    - **Done when:** All four on the main branch by Tuesday evening so every consumer can keep moving.
- [ ] `T-029` **As the team, we must be certain how a recruiter earns the right to see contact details.** *(day 3 of 3)*
    - **🔴 HIGH RISK** · P0 · waits on D-5, D-8
    - **What needs to work:** A written flow: click contact, check the plan allowance, record that access was granted, show the details - plus what happens at zero allowance and what the candidate is told.
    - **Find out first:** Today a human admin approves each release. It moves to a plan allowance. Ask Claude to find the ONE function that decides whether a recruiter may see contact details - it must keep deciding, unchanged.
    - **Prompts:** P1 Investigate -> STOP for Sohail. This releases personal data.
    - **Manual test:** Walk the flow with Sohail. Confirm the privacy wording matches what the site publicly promises.
    - **Done when:** Flow approved by Sohail. The single access-deciding function is unchanged. Candidate-facing wording agreed.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### shashank

- [ ] `T-022` **As the team, we need to know whether saving a search today actually saves a recruiter's WORK.** *(day 3 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** A written answer: after signing out and returning, what survives - criteria, matched candidates, who was viewed, who was shortlisted? Each backed by the code that proves it.
    - **Find out first:** Use the product first: create a search, sign out, come back, see what is lost. Then ask Claude why.
    - **Prompts:** P1 Investigate, scoped to the search module.
    - **Manual test:** Create a search, note three candidates, sign out, sign back in. Write down exactly what disappeared.
    - **Done when:** A written answer per item with the field that proves it. This sizes the rest of R3.

### Manuvrtti

- [ ] `T-036` **As a developer, I need one agreed way to notify someone.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** One shared helper sends a notification in the app and by email, honouring preferences. A stub exists by Tuesday.
    - **Find out first:** A notification system already exists for admin broadcasts. Ask Claude how it identifies each notification and follow the same approach.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Import it from a test file. It builds.
    - **Done when:** Stub merged by Tuesday. Type names agreed and frozen after Wednesday.

### Sohail

- [ ] `T-001` **As the team, we need the decisions that block everyone settled before Wednesday.** *(day 3 of 4)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every blocking decision is written down with a one-line reason. Nobody builds against a guess.
    - **Find out first:** Three are already agreed (payments deferred, contact unlock by plan allowance, no company verification) - just record them. The rest need a call.
    - **Prompts:** No AI. Product judgement.
    - **Manual test:** Open the decision record. Every question has an answer, not a question.
    - **Done when:** All decisions marked Decided with a reason and the tasks each unblocks. No task starts Wednesday against an open decision.
    - **⛔ Sohail owns and signs this himself.**

---

## Tuesday 08 September — FOUNDATION

*Go/no-go gate tonight.*

> **GATE tonight.** Decisions closed · shared stubs merged · database path proven · **wave-1 designs APPROVED**. If designs are not approved, Wednesday's frontend work cannot start.

### Shallika · *designer*

- [ ] `T-006` **As a developer, I need agreed patterns so I am not inventing a button style at 11pm.** *(day 2 of 2)*
    - **🟢 LOW** · P0
    - **What needs to work:** The handful of patterns these journeys need are defined and named: buttons, inputs, dropdowns, cards, tables, badges, modals, navigation, alerts/toasts, plus loading, empty, error and success states.
    - **Find out first:** A design system document already exists in the repo. EXTEND it - do not start a new one, and do not redesign components that already work.
    - **Prompts:** No AI needed.
    - **Manual test:** A developer can point at any element in the September journeys and find its pattern.
    - **Done when:** Patterns documented and referenced from the design files. Small enough to be usable this month - this is consistency, not an enterprise system.
- [ ] `T-007` **As a recruiter, signing up and landing in my workspace should feel like a real product.** *(day 4 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for recruiter signup, the five onboarding steps, the workspace shell and Home - including every state and how they behave on a phone.
    - **Find out first:** Read the recruiter journey on the User Journeys sheet first. Design the FLOW, not five separate screens.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk a developer through the flow. They can describe what happens at every step without asking you a question.
    - **Done when:** Every screen and every state: loading, empty, error, success, disabled. Desktop and mobile. Handoff includes the user goal, the flow, what each component does, validation behaviour and interaction notes. APPROVED before Wednesday so R1 and R12 can start.

### Shivansh

- [ ] `T-013` **As the team, we must stop assuming the candidate profile works because the code exists.** *(day 4 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** Every profile section checked against: add, read, change, remove, validate, survives a logout, has empty/error/loading states, works on a phone, is private when it should be, shows correctly to a recruiter. Every failure written down.
    - **Find out first:** Use the profile with a fresh account, section by section, BEFORE reading code.
    - **Prompts:** P1 Investigate.
    - **Manual test:** Fresh account. Each section: add, save, reload, log out, log in, edit, remove. Note every failure.
    - **Done when:** A written gap list with severities. This sizes the rest of C1 - if it is bigger than 3 days of fixes, we cut sections rather than slipping.

### Zainab

- [ ] `T-003` **As a developer, I need the shared helpers to exist so I am not blocked by someone else's feature.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Four shared helpers exist as no-op stubs that type-check: check a plan limit, send a notification, record a candidate signal, add someone to a shortlist.
    - **Find out first:** None exist. Check for anything similar before creating new files.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Import each from a test file. The project builds.
    - **Done when:** All four on the main branch by Tuesday evening so every consumer can keep moving.

### shashank

- [ ] `T-022` **As the team, we need to know whether saving a search today actually saves a recruiter's WORK.** *(day 4 of 4)*
    - **🟢 LOW** · P0
    - **What needs to work:** A written answer: after signing out and returning, what survives - criteria, matched candidates, who was viewed, who was shortlisted? Each backed by the code that proves it.
    - **Find out first:** Use the product first: create a search, sign out, come back, see what is lost. Then ask Claude why.
    - **Prompts:** P1 Investigate, scoped to the search module.
    - **Manual test:** Create a search, note three candidates, sign out, sign back in. Write down exactly what disappeared.
    - **Done when:** A written answer per item with the field that proves it. This sizes the rest of R3.

### Manuvrtti

- [ ] `T-036` **As a developer, I need one agreed way to notify someone.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** One shared helper sends a notification in the app and by email, honouring preferences. A stub exists by Tuesday.
    - **Find out first:** A notification system already exists for admin broadcasts. Ask Claude how it identifies each notification and follow the same approach.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Import it from a test file. It builds.
    - **Done when:** Stub merged by Tuesday. Type names agreed and frozen after Wednesday.

### Sohail

- [ ] `T-001` **As the team, we need the decisions that block everyone settled before Wednesday.** *(day 4 of 4)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every blocking decision is written down with a one-line reason. Nobody builds against a guess.
    - **Find out first:** Three are already agreed (payments deferred, contact unlock by plan allowance, no company verification) - just record them. The rest need a call.
    - **Prompts:** No AI. Product judgement.
    - **Manual test:** Open the decision record. Every question has an answer, not a question.
    - **Done when:** All decisions marked Decided with a reason and the tasks each unblocks. No task starts Wednesday against an open decision.
    - **⛔ Sohail owns and signs this himself.**
- [ ] `T-004` **As the project lead, I need to know on Tuesday evening whether we can safely start building.**
    - **🟡 MEDIUM** · P0
    - **What needs to work:** A go/no-go call, written down.
    - **Find out first:** Check: decisions closed, stubs merged, database path proven, designs approved for wave 1.
    - **Prompts:** None.
    - **Manual test:** Read the four criteria. Sign or don't.
    - **Done when:** Signed. If the database path is unproven, no database change merges Wednesday - we re-sequence instead.

---

## Wednesday 09 September — BUILD WAVE 1

*The main build window opens. Continuous testing from today.*

### Shallika · *designer*

- [ ] `T-008` **As a recruiter, finding and choosing candidates should feel considered, not like a database query.** *(day 1 of 3)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for the talent project, the criteria panel, search results, the candidate card, the shortlist and the pipeline board - designed as ONE connected flow.
    - **Find out first:** This is the heart of the product. Think through the whole journey: enter project, set criteria, search, understand a candidate card, shortlist, come back next week and still understand where you were.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk the flow with Sohail and shashank. It makes sense without explanation.
    - **Done when:** Complete flow with all states, including what a recruiter sees with zero results and with a brand-new empty project. Approved before the search build starts on the 11th.

### Shivansh

- [ ] `T-014` **As a candidate, everything I type into my profile is still there tomorrow.** *(day 1 of 4)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The profile sections in September scope save, survive a logout, and can be edited and removed.
    - **Find out first:** Fix ONLY what the audit found broken. Do not rebuild working sections.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fill every section. Save, reload, LOG OUT, LOG BACK IN - all still there. Edit four sections. Remove one item from three sections - each disappears everywhere including the recruiter view.
    - **Done when:** Every in-scope section passes all twelve checks. Removals propagate everywhere.
    - **Regression check:** MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
- [ ] `T-017` **As a new recruiter, I create my account and verify my email without confusion.** *(day 1 of 2)*
    - **🔴 HIGH RISK** · P0 · waits on D-6
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Signup and the emailed code work reliably, and a wrong code gives a readable message rather than a dead end.
    - **Find out first:** Signup exists but is gated behind a flag and an invite list. Ask Claude how the code decides who may register - that must not change.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (who is allowed in) -> P3 Implement -> P10 Security review.
    - **Manual test:** Register with an invited email. Check the real inbox. Enter a WRONG code - read the message. Enter the right one. You land on the company step, not a search screen.
    - **Done when:** Fresh recruiter registers, receives a real code, wrong codes fail readably, right codes proceed.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-020` **As a recruiter, every screen feels like part of the same product.** *(day 1 of 3)*
    - **🟡 MEDIUM** · P0 · waits on D-13
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Every recruiter screen sits inside one shell with a persistent menu, and moving between sections does not reload the whole page.
    - **Find out first:** A recruiter shell already exists with a smaller menu. EXTEND it - do not create a second layout.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Visit five recruiter sections in a row. The menu stays, the current section is highlighted, and the page does not fully reload.
    - **Done when:** One shell across every recruiter screen, with the active section always visible.
    - **Regression check:** MANDATORY: every existing recruiter screen still renders inside the shell.
- [ ] `T-077` **As a recruiter, I write a job posting and control when it goes live.** *(day 1 of 4)*
    - **🔴 HIGH RISK** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a job with title, description, skills, location, work mode and type; saves it as a draft; and can publish, close and reopen it.
    - **Find out first:** Jobs today are admin-created only, with no owning company and no draft state. Skills-per-job storage EXISTS and is unused - find it. Existing live jobs must keep working.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (changes live job records) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Create a job, save as draft. As a CANDIDATE open the draft URL directly - not found. Publish - the candidate sees it. Close - no new applications, readable message. Reopen.
    - **Done when:** Full draft/publish/close/reopen. Draft invisibility proven by direct URL. Every job live before the change is still live and applyable.
    - **Regression check:** MANDATORY: open /jobs as a candidate - existing jobs still list, open and accept applications.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### shashank

- [ ] `T-023` **As a recruiter, I create a named hiring project so my work has somewhere to live.** *(day 1 of 3)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a project, sees it in a list, renames it and archives it.
    - **Find out first:** A search-brief record already exists. EXTEND it - do not create a parallel project table.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement. Extend the existing record; do not add a parallel model.
    - **Manual test:** Create a project with a name. See it listed with its last-activity date. Rename it. Archive it - it leaves the list but is not deleted. Sign out and back in - all still true.
    - **Done when:** Projects create, list, rename and archive. Another company's project id returns not-found.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-027` **As a recruiter, when I shortlist someone it is still there tomorrow, on any device.** *(day 1 of 4)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Shortlisting saves against the person in the database, not the browser. Today part of it lives only in the browser and is lost when site data is cleared.
    - **Find out first:** There are TWO shortlists today: one in the database that only works for one candidate group, and one in the browser that works for everyone. Ask Claude to confirm, and to find the unused tables that already have the right shape.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (existing recruiter data) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Shortlist in Browser A. Sign out. Open Browser B, sign in. Still shortlisted, in the right project. Then shortlist one candidate from EACH group - all persist.
    - **Done when:** Database-backed, keyed on the person, works for every candidate group. Nothing read from browser storage. Another company's list returns not-found.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged. MANDATORY: an existing recruiter's current shortlist must not disappear.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### Manuvrtti

- [ ] `T-037` **As a user, notifications reach me reliably and stop when I switch them off.** *(day 1 of 6)*
    - **🟡 MEDIUM** · P0 · waits on D-9
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The notifications these September journeys need appear in the bell and, where appropriate, arrive as a real email - and switching one off genuinely stops it.
    - **Find out first:** Email sending already works - reuse it, do NOT add a second provider. Scope is only the notifications the September journeys need, not the full set.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger a notification - it appears in the bell. Mark it read - it stays read after a reload. Check a REAL inbox. Switch the preference off, trigger again - bell only, no email. Confirm test addresses are suppressed.
    - **Done when:** Bell and real email both work. Preferences honoured. Every send logged. Repeat events do not duplicate.
    - **Regression check:** MANDATORY: trigger an existing admin broadcast and confirm it still reaches the bell. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.

### Sohail

- [ ] `T-032` **As the business, plan limits live as data we can change, not numbers in code.** *(day 1 of 3)*
    - **🔴 HIGH RISK** · P0 · waits on D-3
    - **What needs to work:** Plans and their limits are stored records. Changing a limit is a data edit, not a deployment.
    - **Find out first:** Nothing exists. Ask Claude to check whether ANY subscription storage exists before creating it. An existing plans dialog hard-codes prices - match the agreed numbers.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P11 Database review -> P3 Implement.
    - **Manual test:** Change a limit in the stored plan. Reload the plans page - the new number shows. No deploy.
    - **Done when:** Plans stored with every limit as data. Applied to a copy of the database first. Existing recruiters keep working.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen. MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-039` **As a developer, I can run the journey tests on my machine and in CI.** *(day 1 of 3)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** A test setup runs the journey tests on every pull request, with one green example and a one-page how-to.
    - **Find out first:** No journey-test framework exists today, only hand-written scripts. Pick the standard one for this stack.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open a pull request with a deliberately broken journey - CI goes red.
    - **Done when:** Tests run on every pull request. One green example plus a how-to a junior can follow.

---

## Thursday 10 September — BUILD WAVE 1

### Shallika · *designer*

- [ ] `T-008` **As a recruiter, finding and choosing candidates should feel considered, not like a database query.** *(day 2 of 3)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for the talent project, the criteria panel, search results, the candidate card, the shortlist and the pipeline board - designed as ONE connected flow.
    - **Find out first:** This is the heart of the product. Think through the whole journey: enter project, set criteria, search, understand a candidate card, shortlist, come back next week and still understand where you were.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk the flow with Sohail and shashank. It makes sense without explanation.
    - **Done when:** Complete flow with all states, including what a recruiter sees with zero results and with a brand-new empty project. Approved before the search build starts on the 11th.

### Shivansh

- [ ] `T-014` **As a candidate, everything I type into my profile is still there tomorrow.** *(day 2 of 4)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The profile sections in September scope save, survive a logout, and can be edited and removed.
    - **Find out first:** Fix ONLY what the audit found broken. Do not rebuild working sections.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fill every section. Save, reload, LOG OUT, LOG BACK IN - all still there. Edit four sections. Remove one item from three sections - each disappears everywhere including the recruiter view.
    - **Done when:** Every in-scope section passes all twelve checks. Removals propagate everywhere.
    - **Regression check:** MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
- [ ] `T-015` **As a candidate, I can say what I am good at without needing ABTalks to verify it first.** *(day 1 of 5)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A candidate adds their own skills and becomes discoverable on them. Self-declared skills are clearly distinct from verified ones everywhere they appear - never presented as proven.
    - **Find out first:** KEY PRODUCT RULE: verified evidence must NOT be required for discovery. Ask Claude how skills and search currently work, and whether anything today requires verification before a candidate appears.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (honesty of candidate claims) -> P3 Implement.
    - **Manual test:** Fresh candidate adds three self-declared skills. A recruiter searching that skill FINDS them. On the recruiter's screen those skills are clearly marked as self-declared, not verified.
    - **Done when:** Self-declared skills make a candidate discoverable. They are visually and semantically distinct from verified skills. Nothing claims a self-declared skill is proven.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-017` **As a new recruiter, I create my account and verify my email without confusion.** *(day 2 of 2)*
    - **🔴 HIGH RISK** · P0 · waits on D-6
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Signup and the emailed code work reliably, and a wrong code gives a readable message rather than a dead end.
    - **Find out first:** Signup exists but is gated behind a flag and an invite list. Ask Claude how the code decides who may register - that must not change.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (who is allowed in) -> P3 Implement -> P10 Security review.
    - **Manual test:** Register with an invited email. Check the real inbox. Enter a WRONG code - read the message. Enter the right one. You land on the company step, not a search screen.
    - **Done when:** Fresh recruiter registers, receives a real code, wrong codes fail readably, right codes proceed.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-018` **As a recruiter, I tell ABTalks about my company once and it is remembered.** *(day 1 of 3)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Company name, website, logo, industry, size and location save and are still there on return.
    - **Find out first:** Ask Claude what the company record already stores versus what signup collects today (far less). Reuse the existing file-upload approach for the logo.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fill every field including a logo. Save. Reload - still there. Sign out and back in - still there.
    - **Done when:** All six fields persist across a reload and a re-login. Continue stays disabled until name and website are valid.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
- [ ] `T-020` **As a recruiter, every screen feels like part of the same product.** *(day 2 of 3)*
    - **🟡 MEDIUM** · P0 · waits on D-13
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Every recruiter screen sits inside one shell with a persistent menu, and moving between sections does not reload the whole page.
    - **Find out first:** A recruiter shell already exists with a smaller menu. EXTEND it - do not create a second layout.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Visit five recruiter sections in a row. The menu stays, the current section is highlighted, and the page does not fully reload.
    - **Done when:** One shell across every recruiter screen, with the active section always visible.
    - **Regression check:** MANDATORY: every existing recruiter screen still renders inside the shell.
- [ ] `T-077` **As a recruiter, I write a job posting and control when it goes live.** *(day 2 of 4)*
    - **🔴 HIGH RISK** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a job with title, description, skills, location, work mode and type; saves it as a draft; and can publish, close and reopen it.
    - **Find out first:** Jobs today are admin-created only, with no owning company and no draft state. Skills-per-job storage EXISTS and is unused - find it. Existing live jobs must keep working.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (changes live job records) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Create a job, save as draft. As a CANDIDATE open the draft URL directly - not found. Publish - the candidate sees it. Close - no new applications, readable message. Reopen.
    - **Done when:** Full draft/publish/close/reopen. Draft invisibility proven by direct URL. Every job live before the change is still live and applyable.
    - **Regression check:** MANDATORY: open /jobs as a candidate - existing jobs still list, open and accept applications.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### Zainab

- [ ] `T-030` **As a recruiter with allowance left, I unlock a candidate's contact details and see them immediately.** *(day 1 of 5)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Unlocking spends one allowance and reveals the details. A recruiter with none left sees a clear message and NO contact details anywhere in the response.
    - **Find out first:** Confirm the existing access-deciding function is reused, not bypassed. The allowance check comes from R2.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.
    - **Manual test:** With allowance: unlock - details appear, counter drops by one. With NONE: refused. Open the browser network tab on the refused case - NO email, phone or CV link anywhere in the response.
    - **Done when:** Allowance spends correctly. The refused case leaks nothing - checked in the network response, not on screen.
    - **Regression check:** MANDATORY: a recruiter already granted contact for a candidate must still see it.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-074` **As a recruiter, when a candidate has actually done the work I want to see that, not just their word for it.** *(day 1 of 5)*
    - **🔴 HIGH RISK** · P1
    - **What needs to work:** Completing a verified activity records proof once, and the recruiter sees that skill marked as evidence-backed rather than self-declared.
    - **Find out first:** A proof table exists but NOTHING writes to it - confirm that first. Self-declared skills already make a candidate discoverable (C1); this is purely about showing stronger confidence where it is earned.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement.
    - **Manual test:** Complete a verified activity. The skill shows as evidence-backed on the recruiter's view, with a count. Trigger it twice more - still ONE record. A self-declared skill with no activity still shows, marked self-declared.
    - **Done when:** One proof record per activity. Skill strength moves once. Self-declared and evidence-backed are visibly distinct and never confused. If recording fails, the candidate's own submission still succeeds.
    - **Regression check:** MANDATORY: complete one existing challenge task and one programme mission - points, streaks and progress all still work.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### shashank

- [ ] `T-023` **As a recruiter, I create a named hiring project so my work has somewhere to live.** *(day 2 of 3)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a project, sees it in a list, renames it and archives it.
    - **Find out first:** A search-brief record already exists. EXTEND it - do not create a parallel project table.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement. Extend the existing record; do not add a parallel model.
    - **Manual test:** Create a project with a name. See it listed with its last-activity date. Rename it. Archive it - it leaves the list but is not deleted. Sign out and back in - all still true.
    - **Done when:** Projects create, list, rename and archive. Another company's project id returns not-found.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-027` **As a recruiter, when I shortlist someone it is still there tomorrow, on any device.** *(day 2 of 4)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Shortlisting saves against the person in the database, not the browser. Today part of it lives only in the browser and is lost when site data is cleared.
    - **Find out first:** There are TWO shortlists today: one in the database that only works for one candidate group, and one in the browser that works for everyone. Ask Claude to confirm, and to find the unused tables that already have the right shape.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (existing recruiter data) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Shortlist in Browser A. Sign out. Open Browser B, sign in. Still shortlisted, in the right project. Then shortlist one candidate from EACH group - all persist.
    - **Done when:** Database-backed, keyed on the person, works for every candidate group. Nothing read from browser storage. Another company's list returns not-found.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged. MANDATORY: an existing recruiter's current shortlist must not disappear.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### Manuvrtti

- [ ] `T-037` **As a user, notifications reach me reliably and stop when I switch them off.** *(day 2 of 6)*
    - **🟡 MEDIUM** · P0 · waits on D-9
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The notifications these September journeys need appear in the bell and, where appropriate, arrive as a real email - and switching one off genuinely stops it.
    - **Find out first:** Email sending already works - reuse it, do NOT add a second provider. Scope is only the notifications the September journeys need, not the full set.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger a notification - it appears in the bell. Mark it read - it stays read after a reload. Check a REAL inbox. Switch the preference off, trigger again - bell only, no email. Confirm test addresses are suppressed.
    - **Done when:** Bell and real email both work. Preferences honoured. Every send logged. Repeat events do not duplicate.
    - **Regression check:** MANDATORY: trigger an existing admin broadcast and confirm it still reaches the bell. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.

### Sohail

- [ ] `T-032` **As the business, plan limits live as data we can change, not numbers in code.** *(day 2 of 3)*
    - **🔴 HIGH RISK** · P0 · waits on D-3
    - **What needs to work:** Plans and their limits are stored records. Changing a limit is a data edit, not a deployment.
    - **Find out first:** Nothing exists. Ask Claude to check whether ANY subscription storage exists before creating it. An existing plans dialog hard-codes prices - match the agreed numbers.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P11 Database review -> P3 Implement.
    - **Manual test:** Change a limit in the stored plan. Reload the plans page - the new number shows. No deploy.
    - **Done when:** Plans stored with every limit as data. Applied to a copy of the database first. Existing recruiters keep working.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen. MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-039` **As a developer, I can run the journey tests on my machine and in CI.** *(day 2 of 3)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** A test setup runs the journey tests on every pull request, with one green example and a one-page how-to.
    - **Find out first:** No journey-test framework exists today, only hand-written scripts. Pick the standard one for this stack.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open a pull request with a deliberately broken journey - CI goes red.
    - **Done when:** Tests run on every pull request. One green example plus a how-to a junior can follow.

---

## Friday 11 September — BUILD WAVE 1

### Shallika · *designer*

- [ ] `T-008` **As a recruiter, finding and choosing candidates should feel considered, not like a database query.** *(day 3 of 3)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for the talent project, the criteria panel, search results, the candidate card, the shortlist and the pipeline board - designed as ONE connected flow.
    - **Find out first:** This is the heart of the product. Think through the whole journey: enter project, set criteria, search, understand a candidate card, shortlist, come back next week and still understand where you were.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk the flow with Sohail and shashank. It makes sense without explanation.
    - **Done when:** Complete flow with all states, including what a recruiter sees with zero results and with a brand-new empty project. Approved before the search build starts on the 11th.
- [ ] `T-009` **As a candidate, building my profile should feel quick and worth doing.** *(day 1 of 2)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for candidate signup, the profile sections, adding self-declared skills, and the privacy/visibility control - including what a recruiter sees.
    - **Find out first:** Key product rule: a candidate does NOT need verified evidence to be discoverable. Self-declared skills must feel legitimate, while staying visibly different from verified ones.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk it with Shivansh. The difference between self-declared and verified is obvious without a legend.
    - **Done when:** All sections and states. Self-declared and verified are visually distinct and honestly labelled. Mobile covered. Approved before the profile build finishes.

### Shivansh

- [ ] `T-014` **As a candidate, everything I type into my profile is still there tomorrow.** *(day 3 of 4)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The profile sections in September scope save, survive a logout, and can be edited and removed.
    - **Find out first:** Fix ONLY what the audit found broken. Do not rebuild working sections.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fill every section. Save, reload, LOG OUT, LOG BACK IN - all still there. Edit four sections. Remove one item from three sections - each disappears everywhere including the recruiter view.
    - **Done when:** Every in-scope section passes all twelve checks. Removals propagate everywhere.
    - **Regression check:** MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
- [ ] `T-015` **As a candidate, I can say what I am good at without needing ABTalks to verify it first.** *(day 2 of 5)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A candidate adds their own skills and becomes discoverable on them. Self-declared skills are clearly distinct from verified ones everywhere they appear - never presented as proven.
    - **Find out first:** KEY PRODUCT RULE: verified evidence must NOT be required for discovery. Ask Claude how skills and search currently work, and whether anything today requires verification before a candidate appears.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (honesty of candidate claims) -> P3 Implement.
    - **Manual test:** Fresh candidate adds three self-declared skills. A recruiter searching that skill FINDS them. On the recruiter's screen those skills are clearly marked as self-declared, not verified.
    - **Done when:** Self-declared skills make a candidate discoverable. They are visually and semantically distinct from verified skills. Nothing claims a self-declared skill is proven.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-018` **As a recruiter, I tell ABTalks about my company once and it is remembered.** *(day 2 of 3)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Company name, website, logo, industry, size and location save and are still there on return.
    - **Find out first:** Ask Claude what the company record already stores versus what signup collects today (far less). Reuse the existing file-upload approach for the logo.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fill every field including a logo. Save. Reload - still there. Sign out and back in - still there.
    - **Done when:** All six fields persist across a reload and a re-login. Continue stays disabled until name and website are valid.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
- [ ] `T-020` **As a recruiter, every screen feels like part of the same product.** *(day 3 of 3)*
    - **🟡 MEDIUM** · P0 · waits on D-13
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Every recruiter screen sits inside one shell with a persistent menu, and moving between sections does not reload the whole page.
    - **Find out first:** A recruiter shell already exists with a smaller menu. EXTEND it - do not create a second layout.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Visit five recruiter sections in a row. The menu stays, the current section is highlighted, and the page does not fully reload.
    - **Done when:** One shell across every recruiter screen, with the active section always visible.
    - **Regression check:** MANDATORY: every existing recruiter screen still renders inside the shell.
- [ ] `T-077` **As a recruiter, I write a job posting and control when it goes live.** *(day 3 of 4)*
    - **🔴 HIGH RISK** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a job with title, description, skills, location, work mode and type; saves it as a draft; and can publish, close and reopen it.
    - **Find out first:** Jobs today are admin-created only, with no owning company and no draft state. Skills-per-job storage EXISTS and is unused - find it. Existing live jobs must keep working.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (changes live job records) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Create a job, save as draft. As a CANDIDATE open the draft URL directly - not found. Publish - the candidate sees it. Close - no new applications, readable message. Reopen.
    - **Done when:** Full draft/publish/close/reopen. Draft invisibility proven by direct URL. Every job live before the change is still live and applyable.
    - **Regression check:** MANDATORY: open /jobs as a candidate - existing jobs still list, open and accept applications.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### Zainab

- [ ] `T-030` **As a recruiter with allowance left, I unlock a candidate's contact details and see them immediately.** *(day 2 of 5)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Unlocking spends one allowance and reveals the details. A recruiter with none left sees a clear message and NO contact details anywhere in the response.
    - **Find out first:** Confirm the existing access-deciding function is reused, not bypassed. The allowance check comes from R2.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.
    - **Manual test:** With allowance: unlock - details appear, counter drops by one. With NONE: refused. Open the browser network tab on the refused case - NO email, phone or CV link anywhere in the response.
    - **Done when:** Allowance spends correctly. The refused case leaks nothing - checked in the network response, not on screen.
    - **Regression check:** MANDATORY: a recruiter already granted contact for a candidate must still see it.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-074` **As a recruiter, when a candidate has actually done the work I want to see that, not just their word for it.** *(day 2 of 5)*
    - **🔴 HIGH RISK** · P1
    - **What needs to work:** Completing a verified activity records proof once, and the recruiter sees that skill marked as evidence-backed rather than self-declared.
    - **Find out first:** A proof table exists but NOTHING writes to it - confirm that first. Self-declared skills already make a candidate discoverable (C1); this is purely about showing stronger confidence where it is earned.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement.
    - **Manual test:** Complete a verified activity. The skill shows as evidence-backed on the recruiter's view, with a count. Trigger it twice more - still ONE record. A self-declared skill with no activity still shows, marked self-declared.
    - **Done when:** One proof record per activity. Skill strength moves once. Self-declared and evidence-backed are visibly distinct and never confused. If recording fails, the candidate's own submission still succeeds.
    - **Regression check:** MANDATORY: complete one existing challenge task and one programme mission - points, streaks and progress all still work.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### shashank

- [ ] `T-023` **As a recruiter, I create a named hiring project so my work has somewhere to live.** *(day 3 of 3)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a project, sees it in a list, renames it and archives it.
    - **Find out first:** A search-brief record already exists. EXTEND it - do not create a parallel project table.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement. Extend the existing record; do not add a parallel model.
    - **Manual test:** Create a project with a name. See it listed with its last-activity date. Rename it. Archive it - it leaves the list but is not deleted. Sign out and back in - all still true.
    - **Done when:** Projects create, list, rename and archive. Another company's project id returns not-found.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-024` **As a recruiter, my project remembers what kind of person I am looking for.** *(day 1 of 4)*
    - **🟡 MEDIUM** · P0 · waits on D-12
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Everything the recruiter says about the role is saved on the project and shown again, editable, when they return.
    - **Find out first:** Several of these fields already exist on the search-brief record. Ask Claude which, so you extend rather than duplicate.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Set the criteria on a project. Save. Sign out, sign back in IN A DIFFERENT BROWSER. Open the project - every criterion is exactly as you left it and editable in place.
    - **Done when:** Every criterion persists across a session and a browser change.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-027` **As a recruiter, when I shortlist someone it is still there tomorrow, on any device.** *(day 3 of 4)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Shortlisting saves against the person in the database, not the browser. Today part of it lives only in the browser and is lost when site data is cleared.
    - **Find out first:** There are TWO shortlists today: one in the database that only works for one candidate group, and one in the browser that works for everyone. Ask Claude to confirm, and to find the unused tables that already have the right shape.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (existing recruiter data) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Shortlist in Browser A. Sign out. Open Browser B, sign in. Still shortlisted, in the right project. Then shortlist one candidate from EACH group - all persist.
    - **Done when:** Database-backed, keyed on the person, works for every candidate group. Nothing read from browser storage. Another company's list returns not-found.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged. MANDATORY: an existing recruiter's current shortlist must not disappear.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### Manuvrtti

- [ ] `T-037` **As a user, notifications reach me reliably and stop when I switch them off.** *(day 3 of 6)*
    - **🟡 MEDIUM** · P0 · waits on D-9
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The notifications these September journeys need appear in the bell and, where appropriate, arrive as a real email - and switching one off genuinely stops it.
    - **Find out first:** Email sending already works - reuse it, do NOT add a second provider. Scope is only the notifications the September journeys need, not the full set.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger a notification - it appears in the bell. Mark it read - it stays read after a reload. Check a REAL inbox. Switch the preference off, trigger again - bell only, no email. Confirm test addresses are suppressed.
    - **Done when:** Bell and real email both work. Preferences honoured. Every send logged. Repeat events do not duplicate.
    - **Regression check:** MANDATORY: trigger an existing admin broadcast and confirm it still reaches the bell. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.

### Sohail

- [ ] `T-032` **As the business, plan limits live as data we can change, not numbers in code.** *(day 3 of 3)*
    - **🔴 HIGH RISK** · P0 · waits on D-3
    - **What needs to work:** Plans and their limits are stored records. Changing a limit is a data edit, not a deployment.
    - **Find out first:** Nothing exists. Ask Claude to check whether ANY subscription storage exists before creating it. An existing plans dialog hard-codes prices - match the agreed numbers.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P11 Database review -> P3 Implement.
    - **Manual test:** Change a limit in the stored plan. Reload the plans page - the new number shows. No deploy.
    - **Done when:** Plans stored with every limit as data. Applied to a copy of the database first. Existing recruiters keep working.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen. MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-033` **As the business, a recruiter who has used up their plan must not be able to do the restricted thing - even bypassing the screen.** *(day 1 of 4)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** One shared check decides whether a recruiter may do a restricted action, and counts usage correctly when several requests arrive at once.
    - **Find out first:** Today every premium restriction is a dialog in the browser. There is NO server-side check at all. Confirm that before building.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review. Do NOT let Claude put the check only in the UI.
    - **Manual test:** Use up a limit through the UI. Then call the same action DIRECTLY with the browser bypassed - still refused. Repeat for a recruiter with allowance left - it succeeds.
    - **Done when:** Refused server-side with the client removed. Counters never over-count. The refusal is a readable message, not a crash.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen. MANDATORY: run a recruiter search that worked before and confirm the same candidates come back.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-039` **As a developer, I can run the journey tests on my machine and in CI.** *(day 3 of 3)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** A test setup runs the journey tests on every pull request, with one green example and a one-page how-to.
    - **Find out first:** No journey-test framework exists today, only hand-written scripts. Pick the standard one for this stack.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open a pull request with a deliberately broken journey - CI goes red.
    - **Done when:** Tests run on every pull request. One green example plus a how-to a junior can follow.

---

## Saturday 12 September — BUILD WAVE 1

*Wave 1 must be demoable tonight. Scope decision.*

> **Wave 1 must be demoable on a preview tonight.** SCOPE DECISION: anything behind drops a P1 whole rather than half-shipping.

### Shallika · *designer*

- [ ] `T-009` **As a candidate, building my profile should feel quick and worth doing.** *(day 2 of 2)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for candidate signup, the profile sections, adding self-declared skills, and the privacy/visibility control - including what a recruiter sees.
    - **Find out first:** Key product rule: a candidate does NOT need verified evidence to be discoverable. Self-declared skills must feel legitimate, while staying visibly different from verified ones.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk it with Shivansh. The difference between self-declared and verified is obvious without a legend.
    - **Done when:** All sections and states. Self-declared and verified are visually distinct and honestly labelled. Mobile covered. Approved before the profile build finishes.
- [ ] `T-010` **As a recruiter, unlocking and contacting a candidate should feel deliberate and clear.** *(day 1 of 3)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for the contact unlock, the allowance indicator, the message composer and the outreach history - including what a recruiter with no allowance left sees.
    - **Find out first:** This is where money meets privacy. The recruiter must understand what they are spending and the candidate must be treated respectfully.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk it with Zainab. What happens at zero allowance is obvious.
    - **Done when:** Unlock, spend, compose, send, history, and the zero-allowance state all designed. Approved before the outreach build starts.

### Shivansh

- [ ] `T-014` **As a candidate, everything I type into my profile is still there tomorrow.** *(day 4 of 4)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The profile sections in September scope save, survive a logout, and can be edited and removed.
    - **Find out first:** Fix ONLY what the audit found broken. Do not rebuild working sections.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fill every section. Save, reload, LOG OUT, LOG BACK IN - all still there. Edit four sections. Remove one item from three sections - each disappears everywhere including the recruiter view.
    - **Done when:** Every in-scope section passes all twelve checks. Removals propagate everywhere.
    - **Regression check:** MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
- [ ] `T-015` **As a candidate, I can say what I am good at without needing ABTalks to verify it first.** *(day 3 of 5)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A candidate adds their own skills and becomes discoverable on them. Self-declared skills are clearly distinct from verified ones everywhere they appear - never presented as proven.
    - **Find out first:** KEY PRODUCT RULE: verified evidence must NOT be required for discovery. Ask Claude how skills and search currently work, and whether anything today requires verification before a candidate appears.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (honesty of candidate claims) -> P3 Implement.
    - **Manual test:** Fresh candidate adds three self-declared skills. A recruiter searching that skill FINDS them. On the recruiter's screen those skills are clearly marked as self-declared, not verified.
    - **Done when:** Self-declared skills make a candidate discoverable. They are visually and semantically distinct from verified skills. Nothing claims a self-declared skill is proven.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-018` **As a recruiter, I tell ABTalks about my company once and it is remembered.** *(day 3 of 3)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Company name, website, logo, industry, size and location save and are still there on return.
    - **Find out first:** Ask Claude what the company record already stores versus what signup collects today (far less). Reuse the existing file-upload approach for the logo.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fill every field including a logo. Save. Reload - still there. Sign out and back in - still there.
    - **Done when:** All six fields persist across a reload and a re-login. Continue stays disabled until name and website are valid.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
- [ ] `T-077` **As a recruiter, I write a job posting and control when it goes live.** *(day 4 of 4)*
    - **🔴 HIGH RISK** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a job with title, description, skills, location, work mode and type; saves it as a draft; and can publish, close and reopen it.
    - **Find out first:** Jobs today are admin-created only, with no owning company and no draft state. Skills-per-job storage EXISTS and is unused - find it. Existing live jobs must keep working.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (changes live job records) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Create a job, save as draft. As a CANDIDATE open the draft URL directly - not found. Publish - the candidate sees it. Close - no new applications, readable message. Reopen.
    - **Done when:** Full draft/publish/close/reopen. Draft invisibility proven by direct URL. Every job live before the change is still live and applyable.
    - **Regression check:** MANDATORY: open /jobs as a candidate - existing jobs still list, open and accept applications.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### Zainab

- [ ] `T-030` **As a recruiter with allowance left, I unlock a candidate's contact details and see them immediately.** *(day 3 of 5)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Unlocking spends one allowance and reveals the details. A recruiter with none left sees a clear message and NO contact details anywhere in the response.
    - **Find out first:** Confirm the existing access-deciding function is reused, not bypassed. The allowance check comes from R2.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.
    - **Manual test:** With allowance: unlock - details appear, counter drops by one. With NONE: refused. Open the browser network tab on the refused case - NO email, phone or CV link anywhere in the response.
    - **Done when:** Allowance spends correctly. The refused case leaks nothing - checked in the network response, not on screen.
    - **Regression check:** MANDATORY: a recruiter already granted contact for a candidate must still see it.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-074` **As a recruiter, when a candidate has actually done the work I want to see that, not just their word for it.** *(day 3 of 5)*
    - **🔴 HIGH RISK** · P1
    - **What needs to work:** Completing a verified activity records proof once, and the recruiter sees that skill marked as evidence-backed rather than self-declared.
    - **Find out first:** A proof table exists but NOTHING writes to it - confirm that first. Self-declared skills already make a candidate discoverable (C1); this is purely about showing stronger confidence where it is earned.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement.
    - **Manual test:** Complete a verified activity. The skill shows as evidence-backed on the recruiter's view, with a count. Trigger it twice more - still ONE record. A self-declared skill with no activity still shows, marked self-declared.
    - **Done when:** One proof record per activity. Skill strength moves once. Self-declared and evidence-backed are visibly distinct and never confused. If recording fails, the candidate's own submission still succeeds.
    - **Regression check:** MANDATORY: complete one existing challenge task and one programme mission - points, streaks and progress all still work.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### shashank

- [ ] `T-024` **As a recruiter, my project remembers what kind of person I am looking for.** *(day 2 of 4)*
    - **🟡 MEDIUM** · P0 · waits on D-12
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Everything the recruiter says about the role is saved on the project and shown again, editable, when they return.
    - **Find out first:** Several of these fields already exist on the search-brief record. Ask Claude which, so you extend rather than duplicate.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Set the criteria on a project. Save. Sign out, sign back in IN A DIFFERENT BROWSER. Open the project - every criterion is exactly as you left it and editable in place.
    - **Done when:** Every criterion persists across a session and a browser change.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-025` **As a recruiter, re-running my search must not lose track of who I already looked at.** *(day 1 of 3)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Re-running a search keeps the history of when each candidate first appeared, so people I have seen are not shown as new.
    - **Find out first:** Today re-running a search DELETES all previous matches and recreates them - which is why history is lost. Confirm this before changing it. This is data-loss shaped.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (rewrites existing rows) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Run a match. Note when candidate X first appeared. Run it again. X's first-seen date is UNCHANGED. A genuinely new candidate has a later date.
    - **Done when:** First-seen dates survive a re-run. Only genuinely new candidates are marked new.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-027` **As a recruiter, when I shortlist someone it is still there tomorrow, on any device.** *(day 4 of 4)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Shortlisting saves against the person in the database, not the browser. Today part of it lives only in the browser and is lost when site data is cleared.
    - **Find out first:** There are TWO shortlists today: one in the database that only works for one candidate group, and one in the browser that works for everyone. Ask Claude to confirm, and to find the unused tables that already have the right shape.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (existing recruiter data) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Shortlist in Browser A. Sign out. Open Browser B, sign in. Still shortlisted, in the right project. Then shortlist one candidate from EACH group - all persist.
    - **Done when:** Database-backed, keyed on the person, works for every candidate group. Nothing read from browser storage. Another company's list returns not-found.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged. MANDATORY: an existing recruiter's current shortlist must not disappear.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### Manuvrtti

- [ ] `T-037` **As a user, notifications reach me reliably and stop when I switch them off.** *(day 4 of 6)*
    - **🟡 MEDIUM** · P0 · waits on D-9
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The notifications these September journeys need appear in the bell and, where appropriate, arrive as a real email - and switching one off genuinely stops it.
    - **Find out first:** Email sending already works - reuse it, do NOT add a second provider. Scope is only the notifications the September journeys need, not the full set.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger a notification - it appears in the bell. Mark it read - it stays read after a reload. Check a REAL inbox. Switch the preference off, trigger again - bell only, no email. Confirm test addresses are suppressed.
    - **Done when:** Bell and real email both work. Preferences honoured. Every send logged. Repeat events do not duplicate.
    - **Regression check:** MANDATORY: trigger an existing admin broadcast and confirm it still reaches the bell. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.

### Sohail

- [ ] `T-033` **As the business, a recruiter who has used up their plan must not be able to do the restricted thing - even bypassing the screen.** *(day 2 of 4)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** One shared check decides whether a recruiter may do a restricted action, and counts usage correctly when several requests arrive at once.
    - **Find out first:** Today every premium restriction is a dialog in the browser. There is NO server-side check at all. Confirm that before building.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review. Do NOT let Claude put the check only in the UI.
    - **Manual test:** Use up a limit through the UI. Then call the same action DIRECTLY with the browser bypassed - still refused. Repeat for a recruiter with allowance left - it succeeds.
    - **Done when:** Refused server-side with the client removed. Counters never over-count. The refusal is a readable message, not a crash.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen. MANDATORY: run a recruiter search that worked before and confirm the same candidates come back.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

---

## Sunday 13 September — HOLIDAY

> No work. No development, design, QA, review or testing.

---

## Monday 14 September — BUILD WAVE 2

*Last build day but one.*

### Shallika · *designer*

- [ ] `T-010` **As a recruiter, unlocking and contacting a candidate should feel deliberate and clear.** *(day 3 of 3)*
    - **🟢 LOW** · P0
    - **What needs to work:** Approved designs for the contact unlock, the allowance indicator, the message composer and the outreach history - including what a recruiter with no allowance left sees.
    - **Find out first:** This is where money meets privacy. The recruiter must understand what they are spending and the candidate must be treated respectfully.
    - **Prompts:** No AI needed.
    - **Manual test:** Walk it with Zainab. What happens at zero allowance is obvious.
    - **Done when:** Unlock, spend, compose, send, history, and the zero-allowance state all designed. Approved before the outreach build starts.
- [ ] `T-011` **As the designer, I need to check what was actually built, not what was designed.** *(day 1 of 2)*
    - **🟢 LOW** · P0
    - **What needs to work:** Every feature from build wave 1 is reviewed in the running application - not from screenshots.
    - **Find out first:** Open the preview and use it. Compare against the approved design.
    - **Prompts:** No AI needed.
    - **Manual test:** For each wave-1 feature check: does it match the design, does it work on a phone, hover and focus states, loading, errors, empty states, spacing, typography, consistency, and anything confusing.
    - **Done when:** Every wave-1 feature has a recorded UI/UX SIGN-OFF of PASS or NEEDS FIX. Issues are ranked BLOCKER / MAJOR / MINOR. Minor cosmetic issues become P2 bugs - they do NOT block the release.

### Shivansh

- [ ] `T-015` **As a candidate, I can say what I am good at without needing ABTalks to verify it first.** *(day 5 of 5)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A candidate adds their own skills and becomes discoverable on them. Self-declared skills are clearly distinct from verified ones everywhere they appear - never presented as proven.
    - **Find out first:** KEY PRODUCT RULE: verified evidence must NOT be required for discovery. Ask Claude how skills and search currently work, and whether anything today requires verification before a candidate appears.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (honesty of candidate claims) -> P3 Implement.
    - **Manual test:** Fresh candidate adds three self-declared skills. A recruiter searching that skill FINDS them. On the recruiter's screen those skills are clearly marked as self-declared, not verified.
    - **Done when:** Self-declared skills make a candidate discoverable. They are visually and semantically distinct from verified skills. Nothing claims a self-declared skill is proven.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-016` **As a candidate, I control what recruiters see and can check it myself.** *(day 1 of 2)*
    - **🔴 HIGH RISK** · P0 · waits on D-8
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A candidate can turn recruiter visibility off and preview exactly what a recruiter sees - rendered by the same code the recruiter uses, so the preview cannot lie.
    - **Find out first:** Privacy control. Confirm the preview reuses the REAL recruiter rendering, not a copy. Sohail must confirm the wording matches what the site publicly promises.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (privacy) -> P3 Implement -> P10 Security review.
    - **Manual test:** Turn visibility OFF. Have a recruiter re-run a search that matched you - you are gone. Also have them re-open a SAVED list - still gone. Turn a field's privacy off - it vanishes from the preview too.
    - **Done when:** Visibility off removes the candidate everywhere including saved results. Preview matches the real recruiter view field for field.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-019` **As a recruiter, if I am interrupted halfway I carry on where I left off, and I land somewhere useful.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Onboarding resumes at the right step after a browser close, and finishing puts the recruiter on Home with one obvious next action.
    - **Find out first:** The current step must come from what is saved, not from the browser. Coordinate with R12 - Home is built there.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Complete steps 1 and 2. CLOSE THE BROWSER at step 3. Reopen and sign in - you are on step 3 with 1 and 2 done. Finish - you land on Home, not search.
    - **Done when:** Resumes correctly every time. A progress indicator shows where you are. Finishing lands on Home.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
- [ ] `T-021` **As a recruiter opening ABTalks, I know what to do next.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Home shows my projects with new matches, what is waiting on me, and one clear action for a brand-new recruiter - each linking to the exact place that resolves it.
    - **Find out first:** Read counts from the project and pipeline work. Do not write new queries for the same numbers.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** As an established recruiter: Home tells you what needs attention and every link works. As a BRAND NEW recruiter: one obvious action, not five empty tiles.
    - **Done when:** Home answers 'what should I do next'. The new-recruiter state is designed, not empty.
- [ ] `T-078` **As a candidate, I find jobs that suit me, apply once, and see what happened.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Candidates search and filter jobs by skill, role, location, work mode and type, apply once with a friendly refusal on a repeat, and track each application's stage.
    - **Find out first:** A jobs list exists with no search and no filters. A uniqueness rule already exists in the database - catch it and turn it into a readable message rather than a server error.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Filter by one skill matching exactly one job - only that job. Apply - confirmation. Replay the apply action - friendly refusal, still ONE application. Have a recruiter move you forward - your applications list shows the new stage.
    - **Done when:** All five filters correct and run in the backend. One application per person per job. Stage and date visible to the candidate.
    - **Regression check:** MANDATORY: existing jobs still list and still accept applications.

### Zainab

- [ ] `T-030` **As a recruiter with allowance left, I unlock a candidate's contact details and see them immediately.** *(day 5 of 5)*
    - **🔴 HIGH RISK** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Unlocking spends one allowance and reveals the details. A recruiter with none left sees a clear message and NO contact details anywhere in the response.
    - **Find out first:** Confirm the existing access-deciding function is reused, not bypassed. The allowance check comes from R2.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.
    - **Manual test:** With allowance: unlock - details appear, counter drops by one. With NONE: refused. Open the browser network tab on the refused case - NO email, phone or CV link anywhere in the response.
    - **Done when:** Allowance spends correctly. The refused case leaks nothing - checked in the network response, not on screen.
    - **Regression check:** MANDATORY: a recruiter already granted contact for a candidate must still see it.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-031` **As a recruiter, I email a candidate without leaving ABTalks, and can see who I already contacted.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The recruiter writes a subject and message, sends it, the candidate receives a real email, and the history and pipeline record that it happened.
    - **Find out first:** Email sending already works elsewhere in the product. Find it and reuse it - do not add a second provider. Check how it reports success versus failure.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Unlock a candidate. Write and send. CHECK A REAL INBOX - it arrived within a minute. Try sending WITHOUT unlocking - refused. Force a failure - it shows as failed with a retry, never as sent. The candidate is now marked contacted.
    - **Done when:** A real email arrives. Sending without unlock is refused server-side. History readable. Failures visible. The pipeline moves to contacted and never moves someone backwards.
    - **Regression check:** MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.
- [ ] `T-034` **As a recruiter, I see the plans, know what I have used, and understand it when I run out.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Plans render from stored data with the current one marked, usage shows as used-out-of-total and moves after real actions, and hitting a limit explains what was blocked and where to upgrade.
    - **Find out first:** An existing plans dialog has the layout and copy. Reuse it. Show the SERVER's refusal message - do not write new copy in the browser.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open plans - three plans, real limits, yours marked. Note your search count, run one search, reload - up by one. Exhaust a limit - the message names the action and the limit, with a link to plans.
    - **Done when:** Plans from data. Usage accurate. The limit message is specific, never a generic toast.
- [ ] `T-074` **As a recruiter, when a candidate has actually done the work I want to see that, not just their word for it.** *(day 5 of 5)*
    - **🔴 HIGH RISK** · P1
    - **What needs to work:** Completing a verified activity records proof once, and the recruiter sees that skill marked as evidence-backed rather than self-declared.
    - **Find out first:** A proof table exists but NOTHING writes to it - confirm that first. Self-declared skills already make a candidate discoverable (C1); this is purely about showing stronger confidence where it is earned.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement.
    - **Manual test:** Complete a verified activity. The skill shows as evidence-backed on the recruiter's view, with a count. Trigger it twice more - still ONE record. A self-declared skill with no activity still shows, marked self-declared.
    - **Done when:** One proof record per activity. Skill strength moves once. Self-declared and evidence-backed are visibly distinct and never confused. If recording fails, the candidate's own submission still succeeds.
    - **Regression check:** MANDATORY: complete one existing challenge task and one programme mission - points, streaks and progress all still work.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-075` **As a candidate who has been on ABTalks for months, my past work should count too.** *(day 1 of 2)*
    - **🔴 HIGH RISK** · P1
    - **What needs to work:** Historic completed work is backfilled so long-standing candidates are not outranked by newer ones.
    - **Find out first:** ~15,000 historic records. A previous similar job ran 4.5 hours and died. Find the existing batched script pattern and reuse it. This RUNS on release day, with Sohail present.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P11 Database review -> P3 Implement.
    - **Manual test:** Run it against a copy. Kill it halfway. Restart - it resumes and finishes. Counts reconcile.
    - **Done when:** Completes on a copy, restartable, zero conflicts, counts reconcile. Not run against production without Sohail.
    - **Regression check:** MANDATORY: points and progress unchanged for a sample of existing candidates.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-080` **As a recruiter, I build a test and send it to the candidates I shortlisted.** *(day 1 of 3)*
    - **🔴 HIGH RISK** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a test with a title, instructions, time limit and pass mark, writes multiple-choice questions, reorders and edits them, previews it, publishes and assigns it - and each candidate is notified once.
    - **Find out first:** Question storage and result storage BOTH already exist unused - find them and use them. Do not create a second question model. Everything scoped to the recruiter's own company.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (new data + company isolation) -> P11 Database review -> P3 Implement.
    - **Manual test:** Create a test with four questions. Reorder, edit one, delete one. Reload - all stuck. Try saving a question with no correct answer - refused. Preview - it looks like the candidate's view. Publish and assign to three shortlisted candidates - exactly three assignments, no duplicates, each notified. As another company, open its id - not found.
    - **Done when:** Full builder CRUD persists. Preview reuses the real candidate screen. Assignment is one per candidate. Company isolation proven.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### shashank

- [ ] `T-024` **As a recruiter, my project remembers what kind of person I am looking for.** *(day 4 of 4)*
    - **🟡 MEDIUM** · P0 · waits on D-12
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Everything the recruiter says about the role is saved on the project and shown again, editable, when they return.
    - **Find out first:** Several of these fields already exist on the search-brief record. Ask Claude which, so you extend rather than duplicate.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Set the criteria on a project. Save. Sign out, sign back in IN A DIFFERENT BROWSER. Open the project - every criterion is exactly as you left it and editable in place.
    - **Done when:** Every criterion persists across a session and a browser change.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-025` **As a recruiter, re-running my search must not lose track of who I already looked at.** *(day 3 of 3)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Re-running a search keeps the history of when each candidate first appeared, so people I have seen are not shown as new.
    - **Find out first:** Today re-running a search DELETES all previous matches and recreates them - which is why history is lost. Confirm this before changing it. This is data-loss shaped.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (rewrites existing rows) -> P3 Implement -> P5 Regression analysis.
    - **Manual test:** Run a match. Note when candidate X first appeared. Run it again. X's first-seen date is UNCHANGED. A genuinely new candidate has a later date.
    - **Done when:** First-seen dates survive a re-run. Only genuinely new candidates are marked new.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-026` **As a recruiter, my searches stay fast and return the right people.** *(day 1 of 2)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Candidate filtering is done efficiently by the backend and stays responsive with realistic numbers. Today it loads a capped batch and filters in memory, which silently drops results.
    - **Find out first:** Ask Claude to explain how search loads and filters candidates today, and what the row cap does to results when a filter is applied. Understand it before proposing a fix.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P11 Database review -> P5 Regression analysis.
    - **Manual test:** Filter to something you know matches exactly one candidate - that candidate comes back. Time twenty searches with realistic data, before and after.
    - **Done when:** Filters return correct results at realistic volumes. Timings recorded before and after. The existing safety cap stays until the new path is proven.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: re-run three previously working searches and confirm identical results.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-028` **As a recruiter, I move candidates through my process and see who needs me.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A candidate can be moved through the hiring stages, the stage sticks, and one board shows who is waiting on the recruiter.
    - **Find out first:** A set of pipeline stages already exists in the database, unused. Find it and use it rather than inventing stage names.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Move three candidates to three stages. Sign out, sign back in - all three as you left them. The board shows how many are waiting on you.
    - **Done when:** Stages move, persist and record who changed them. The board answers 'who needs me' at a glance.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-076` **As a recruiter, I want to see why this candidate came up, and where they fall short.** *(day 1 of 3)*
    - **🟡 MEDIUM** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Opening a candidate shows their strongest signals with a count behind each, the gaps against this project's criteria, and an honest statement when there is not enough information.
    - **Find out first:** Existing scoring and match-explanation code already exists - reuse it rather than writing a scoring engine. Facts are records that exist; anything else is our judgement and must look different.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open a candidate with several verified activities - counted signals. Set a project needing AWS and 2 years, open someone with neither - exactly two gap lines. Open a brand-new candidate - it says there is not enough information and shows NO score.
    - **Done when:** Signals counted from real records. Gaps specific and correct. Empty candidates handled honestly. Self-declared and evidence-backed visually distinct. No invented score.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back.
- [ ] `T-084` **As a recruiter hiring for sales or marketing, I search for those people the same way I search for engineers.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P2
    - **What needs to work:** The product recognises the non-technical role families alongside the technical ones, with enough skills seeded that a filter returns something useful - and no coding signal affects a non-technical candidate's standing.
    - **Find out first:** Role grouping already exists but only covers engineering-shaped roles. EXTEND the rules - the existing ordering carries meaning, so do not reorder it. Search already filters on skills, so this is taxonomy, not new search.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Check a real marketing job title is recognised as marketing, not 'other'. Check three existing engineering titles still return what they did. Complete a marketing profile with NO coding links - it is not weaker than an equivalent engineering profile, and it appears in a marketing search.
    - **Done when:** The non-technical families are recognised and searchable. Existing families unchanged. Coding signals never lower a non-technical candidate.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.

### Manuvrtti

- [ ] `T-037` **As a user, notifications reach me reliably and stop when I switch them off.** *(day 6 of 6)*
    - **🟡 MEDIUM** · P0 · waits on D-9
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The notifications these September journeys need appear in the bell and, where appropriate, arrive as a real email - and switching one off genuinely stops it.
    - **Find out first:** Email sending already works - reuse it, do NOT add a second provider. Scope is only the notifications the September journeys need, not the full set.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger a notification - it appears in the bell. Mark it read - it stays read after a reload. Check a REAL inbox. Switch the preference off, trigger again - bell only, no email. Confirm test addresses are suppressed.
    - **Done when:** Bell and real email both work. Preferences honoured. Every send logged. Repeat events do not duplicate.
    - **Regression check:** MANDATORY: trigger an existing admin broadcast and confirm it still reaches the bell. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.
- [ ] `T-038` **As the team, we hear about production errors before users report them.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Errors reach an error-tracking tool and the team channel within a minute.
    - **Find out first:** Today a production error is invisible unless someone reads deployment logs. There is one logging helper - wire into that.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger a deliberate error. It appears in the tool and the channel within a minute.
    - **Done when:** Errors visible within a minute. No raw console logging introduced.
- [ ] `T-082` **As a recruiter, I am told when something needs me - and only then.** *(day 1 of 3)*
    - **🟡 MEDIUM** · P1 · waits on D-9
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The recruiter events produce a notification each, only the important ones send email, and a notification centre links straight to the thing it is about.
    - **Find out first:** Build on the shared notification helper - this is mostly configuration, not new infrastructure. Follow the candidate bell as the pattern.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger each recruiter event. Each appears once in the bell and its link opens THAT candidate, job or test - never a list. Count your emails: only the important ones. Switch one off and re-trigger - it stops, nothing else does.
    - **Done when:** Every event notifies once. Only the agreed few email. Every link opens the right thing. Preferences work per type and channel.
    - **Regression check:** MANDATORY: an existing admin broadcast still reaches the bell. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.
- [ ] `T-086` **As the project lead, I can answer what happened this week with a query instead of a guess.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P2
    - **What needs to work:** One shared helper records that something happened. It never slows down or breaks the thing the user was doing, and the recruiter analytics read these records.
    - **Find out first:** No analytics of any kind today. Keep it simple - one table and one helper, no external vendor. Each feature owner adds their own events as part of their own task.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Call it from a real action - the action is not slowed. Force it to fail internally - the user's action STILL succeeds. Walk the recruiter journey; every agreed event is recorded with the right person and time.
    - **Done when:** Never blocks, never breaks a user action. Events queryable by person and date. The analytics page reads these records.
    - **Regression check:** MANDATORY: every action you instrument still behaves exactly as before.

### Sohail

- [ ] `T-033` **As the business, a recruiter who has used up their plan must not be able to do the restricted thing - even bypassing the screen.** *(day 4 of 4)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** One shared check decides whether a recruiter may do a restricted action, and counts usage correctly when several requests arrive at once.
    - **Find out first:** Today every premium restriction is a dialog in the browser. There is NO server-side check at all. Confirm that before building.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review. Do NOT let Claude put the check only in the UI.
    - **Manual test:** Use up a limit through the UI. Then call the same action DIRECTLY with the browser bypassed - still refused. Repeat for a recruiter with allowance left - it succeeds.
    - **Done when:** Refused server-side with the client removed. Counters never over-count. The refusal is a readable message, not a crash.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen. MANDATORY: run a recruiter search that worked before and confirm the same candidates come back.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-040` **As the business, a candidate must never reach a recruiter screen, and one company must never see another's data.** *(day 1 of 2)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every recruiter and admin screen refuses candidates and signed-out visitors, and requesting another company's records by id fails.
    - **Find out first:** One recruiter screen currently requires only a login, not an approved recruiter. Check every recruiter and admin route. Sign-in and sign-out must STAY public.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.
    - **Manual test:** As a candidate, open every recruiter and admin address - all refused. Signed out, same. As company A, request company B's project, shortlist, note and candidate records by id - all refused. Confirm sign-in still works.
    - **Done when:** All refused. Each cross-company case asserted separately. Public pages still public.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

---

## Tuesday 15 September — BUILD WAVE 3

### Shallika · *designer*

- [ ] `T-011` **As the designer, I need to check what was actually built, not what was designed.** *(day 2 of 2)*
    - **🟢 LOW** · P0
    - **What needs to work:** Every feature from build wave 1 is reviewed in the running application - not from screenshots.
    - **Find out first:** Open the preview and use it. Compare against the approved design.
    - **Prompts:** No AI needed.
    - **Manual test:** For each wave-1 feature check: does it match the design, does it work on a phone, hover and focus states, loading, errors, empty states, spacing, typography, consistency, and anything confusing.
    - **Done when:** Every wave-1 feature has a recorded UI/UX SIGN-OFF of PASS or NEEDS FIX. Issues are ranked BLOCKER / MAJOR / MINOR. Minor cosmetic issues become P2 bugs - they do NOT block the release.

### Shivansh

- [ ] `T-016` **As a candidate, I control what recruiters see and can check it myself.** *(day 2 of 2)*
    - **🔴 HIGH RISK** · P0 · waits on D-8
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A candidate can turn recruiter visibility off and preview exactly what a recruiter sees - rendered by the same code the recruiter uses, so the preview cannot lie.
    - **Find out first:** Privacy control. Confirm the preview reuses the REAL recruiter rendering, not a copy. Sohail must confirm the wording matches what the site publicly promises.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (privacy) -> P3 Implement -> P10 Security review.
    - **Manual test:** Turn visibility OFF. Have a recruiter re-run a search that matched you - you are gone. Also have them re-open a SAVED list - still gone. Turn a field's privacy off - it vanishes from the preview too.
    - **Done when:** Visibility off removes the candidate everywhere including saved results. Preview matches the real recruiter view field for field.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-019` **As a recruiter, if I am interrupted halfway I carry on where I left off, and I land somewhere useful.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Onboarding resumes at the right step after a browser close, and finishing puts the recruiter on Home with one obvious next action.
    - **Find out first:** The current step must come from what is saved, not from the browser. Coordinate with R12 - Home is built there.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Complete steps 1 and 2. CLOSE THE BROWSER at step 3. Reopen and sign in - you are on step 3 with 1 and 2 done. Finish - you land on Home, not search.
    - **Done when:** Resumes correctly every time. A progress indicator shows where you are. Finishing lands on Home.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
- [ ] `T-021` **As a recruiter opening ABTalks, I know what to do next.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Home shows my projects with new matches, what is waiting on me, and one clear action for a brand-new recruiter - each linking to the exact place that resolves it.
    - **Find out first:** Read counts from the project and pipeline work. Do not write new queries for the same numbers.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** As an established recruiter: Home tells you what needs attention and every link works. As a BRAND NEW recruiter: one obvious action, not five empty tiles.
    - **Done when:** Home answers 'what should I do next'. The new-recruiter state is designed, not empty.
- [ ] `T-078` **As a candidate, I find jobs that suit me, apply once, and see what happened.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Candidates search and filter jobs by skill, role, location, work mode and type, apply once with a friendly refusal on a repeat, and track each application's stage.
    - **Find out first:** A jobs list exists with no search and no filters. A uniqueness rule already exists in the database - catch it and turn it into a readable message rather than a server error.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Filter by one skill matching exactly one job - only that job. Apply - confirmation. Replay the apply action - friendly refusal, still ONE application. Have a recruiter move you forward - your applications list shows the new stage.
    - **Done when:** All five filters correct and run in the backend. One application per person per job. Stage and date visible to the candidate.
    - **Regression check:** MANDATORY: existing jobs still list and still accept applications.

### Zainab

- [ ] `T-031` **As a recruiter, I email a candidate without leaving ABTalks, and can see who I already contacted.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The recruiter writes a subject and message, sends it, the candidate receives a real email, and the history and pipeline record that it happened.
    - **Find out first:** Email sending already works elsewhere in the product. Find it and reuse it - do not add a second provider. Check how it reports success versus failure.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Unlock a candidate. Write and send. CHECK A REAL INBOX - it arrived within a minute. Try sending WITHOUT unlocking - refused. Force a failure - it shows as failed with a retry, never as sent. The candidate is now marked contacted.
    - **Done when:** A real email arrives. Sending without unlock is refused server-side. History readable. Failures visible. The pipeline moves to contacted and never moves someone backwards.
    - **Regression check:** MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.
- [ ] `T-034` **As a recruiter, I see the plans, know what I have used, and understand it when I run out.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Plans render from stored data with the current one marked, usage shows as used-out-of-total and moves after real actions, and hitting a limit explains what was blocked and where to upgrade.
    - **Find out first:** An existing plans dialog has the layout and copy. Reuse it. Show the SERVER's refusal message - do not write new copy in the browser.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open plans - three plans, real limits, yours marked. Note your search count, run one search, reload - up by one. Exhaust a limit - the message names the action and the limit, with a link to plans.
    - **Done when:** Plans from data. Usage accurate. The limit message is specific, never a generic toast.
- [ ] `T-075` **As a candidate who has been on ABTalks for months, my past work should count too.** *(day 2 of 2)*
    - **🔴 HIGH RISK** · P1
    - **What needs to work:** Historic completed work is backfilled so long-standing candidates are not outranked by newer ones.
    - **Find out first:** ~15,000 historic records. A previous similar job ran 4.5 hours and died. Find the existing batched script pattern and reuse it. This RUNS on release day, with Sohail present.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P11 Database review -> P3 Implement.
    - **Manual test:** Run it against a copy. Kill it halfway. Restart - it resumes and finishes. Counts reconcile.
    - **Done when:** Completes on a copy, restartable, zero conflicts, counts reconcile. Not run against production without Sohail.
    - **Regression check:** MANDATORY: points and progress unchanged for a sample of existing candidates.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-080` **As a recruiter, I build a test and send it to the candidates I shortlisted.** *(day 2 of 3)*
    - **🔴 HIGH RISK** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a test with a title, instructions, time limit and pass mark, writes multiple-choice questions, reorders and edits them, previews it, publishes and assigns it - and each candidate is notified once.
    - **Find out first:** Question storage and result storage BOTH already exist unused - find them and use them. Do not create a second question model. Everything scoped to the recruiter's own company.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (new data + company isolation) -> P11 Database review -> P3 Implement.
    - **Manual test:** Create a test with four questions. Reorder, edit one, delete one. Reload - all stuck. Try saving a question with no correct answer - refused. Preview - it looks like the candidate's view. Publish and assign to three shortlisted candidates - exactly three assignments, no duplicates, each notified. As another company, open its id - not found.
    - **Done when:** Full builder CRUD persists. Preview reuses the real candidate screen. Assignment is one per candidate. Company isolation proven.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-088` **As a candidate, I can finish a mock interview and get a report I can act on.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P2
    - **What needs to work:** The journey is walked on production with a fresh account, every blocking break is fixed, and the finished report records proof and reaches the recruiter's view.
    - **Find out first:** Substantial code exists but nobody has proven it works for a NEW user. Walk it as a real user FIRST, then fix only what blocks. Do not extend the interview engine.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fresh account: open mock interviews, pick a domain, start, answer, finish, read the report, check history. Force a provider failure - readable message, no lost attempt. Then check the recruiter view of the signal.
    - **Done when:** Every blocking break closed or written off in writing. Report shows strengths, weaknesses and improvements. One proof record, visible to recruiters where privacy allows. Failure paths degrade rather than dead-end.
    - **Regression check:** MANDATORY: an existing candidate's past interview reports still open.

### shashank

- [ ] `T-026` **As a recruiter, my searches stay fast and return the right people.** *(day 2 of 2)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Candidate filtering is done efficiently by the backend and stays responsive with realistic numbers. Today it loads a capped batch and filters in memory, which silently drops results.
    - **Find out first:** Ask Claude to explain how search loads and filters candidates today, and what the row cap does to results when a filter is applied. Understand it before proposing a fix.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P11 Database review -> P5 Regression analysis.
    - **Manual test:** Filter to something you know matches exactly one candidate - that candidate comes back. Time twenty searches with realistic data, before and after.
    - **Done when:** Filters return correct results at realistic volumes. Timings recorded before and after. The existing safety cap stays until the new path is proven.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: re-run three previously working searches and confirm identical results.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-028` **As a recruiter, I move candidates through my process and see who needs me.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P0
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A candidate can be moved through the hiring stages, the stage sticks, and one board shows who is waiting on the recruiter.
    - **Find out first:** A set of pipeline stages already exists in the database, unused. Find it and use it rather than inventing stage names.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Move three candidates to three stages. Sign out, sign back in - all three as you left them. The board shows how many are waiting on you.
    - **Done when:** Stages move, persist and record who changed them. The board answers 'who needs me' at a glance.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-076` **As a recruiter, I want to see why this candidate came up, and where they fall short.** *(day 2 of 3)*
    - **🟡 MEDIUM** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Opening a candidate shows their strongest signals with a count behind each, the gaps against this project's criteria, and an honest statement when there is not enough information.
    - **Find out first:** Existing scoring and match-explanation code already exists - reuse it rather than writing a scoring engine. Facts are records that exist; anything else is our judgement and must look different.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open a candidate with several verified activities - counted signals. Set a project needing AWS and 2 years, open someone with neither - exactly two gap lines. Open a brand-new candidate - it says there is not enough information and shows NO score.
    - **Done when:** Signals counted from real records. Gaps specific and correct. Empty candidates handled honestly. Self-declared and evidence-backed visually distinct. No invented score.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back.
- [ ] `T-084` **As a recruiter hiring for sales or marketing, I search for those people the same way I search for engineers.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P2
    - **What needs to work:** The product recognises the non-technical role families alongside the technical ones, with enough skills seeded that a filter returns something useful - and no coding signal affects a non-technical candidate's standing.
    - **Find out first:** Role grouping already exists but only covers engineering-shaped roles. EXTEND the rules - the existing ordering carries meaning, so do not reorder it. Search already filters on skills, so this is taxonomy, not new search.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Check a real marketing job title is recognised as marketing, not 'other'. Check three existing engineering titles still return what they did. Complete a marketing profile with NO coding links - it is not weaker than an equivalent engineering profile, and it appears in a marketing search.
    - **Done when:** The non-technical families are recognised and searchable. Existing families unchanged. Coding signals never lower a non-technical candidate.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back. MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.

### Manuvrtti

- [ ] `T-038` **As the team, we hear about production errors before users report them.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Errors reach an error-tracking tool and the team channel within a minute.
    - **Find out first:** Today a production error is invisible unless someone reads deployment logs. There is one logging helper - wire into that.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger a deliberate error. It appears in the tool and the channel within a minute.
    - **Done when:** Errors visible within a minute. No raw console logging introduced.
- [ ] `T-082` **As a recruiter, I am told when something needs me - and only then.** *(day 2 of 3)*
    - **🟡 MEDIUM** · P1 · waits on D-9
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The recruiter events produce a notification each, only the important ones send email, and a notification centre links straight to the thing it is about.
    - **Find out first:** Build on the shared notification helper - this is mostly configuration, not new infrastructure. Follow the candidate bell as the pattern.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger each recruiter event. Each appears once in the bell and its link opens THAT candidate, job or test - never a list. Count your emails: only the important ones. Switch one off and re-trigger - it stops, nothing else does.
    - **Done when:** Every event notifies once. Only the agreed few email. Every link opens the right thing. Preferences work per type and channel.
    - **Regression check:** MANDATORY: an existing admin broadcast still reaches the bell. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.
- [ ] `T-086` **As the project lead, I can answer what happened this week with a query instead of a guess.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P2
    - **What needs to work:** One shared helper records that something happened. It never slows down or breaks the thing the user was doing, and the recruiter analytics read these records.
    - **Find out first:** No analytics of any kind today. Keep it simple - one table and one helper, no external vendor. Each feature owner adds their own events as part of their own task.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Call it from a real action - the action is not slowed. Force it to fail internally - the user's action STILL succeeds. Walk the recruiter journey; every agreed event is recorded with the right person and time.
    - **Done when:** Never blocks, never breaks a user action. Events queryable by person and date. The analytics page reads these records.
    - **Regression check:** MANDATORY: every action you instrument still behaves exactly as before.
- [ ] `T-087` **As a candidate, I add my GitHub, LeetCode and CodeChef profiles.** *(day 1 of 2)*
    - **🟡 MEDIUM** · P2
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** All three can be added, checked for a sensible format, removed and re-added - and every one is shown to a recruiter as self-reported, never as verified.
    - **Find out first:** Link storage for all three ALREADY EXISTS in the database - find it before creating anything. Nothing is fetched from those sites this month; these are declared links.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Add all three. Enter a nonsense handle - refused readably. Remove one and add it back. View as a recruiter - each clearly marked self-reported, with no score anywhere.
    - **Done when:** All three connect, validate, disconnect and reconnect. Every external signal labelled self-reported. No invented score exists anywhere.
    - **Regression check:** MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.

### Sohail

- [ ] `T-035` **As an admin, I switch a recruiter's plan on - and a payment system can later do the same.**
    - **🔴 HIGH RISK** · P0 · waits on D-4
    - **What needs to work:** One function turns a subscription on. The admin screen calls it. Nothing else can.
    - **Find out first:** No payment provider exists and none is being added. Build so a payment webhook can call the SAME function later without rework.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.
    - **Manual test:** As admin, activate a plan. As the recruiter, reload - limits are live. Confirm no other path can activate a plan.
    - **Done when:** One admin-only activation function, setting period and resetting usage. It is the only way a plan becomes active.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-040` **As the business, a candidate must never reach a recruiter screen, and one company must never see another's data.** *(day 2 of 2)*
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every recruiter and admin screen refuses candidates and signed-out visitors, and requesting another company's records by id fails.
    - **Find out first:** One recruiter screen currently requires only a login, not an approved recruiter. Check every recruiter and admin route. Sign-in and sign-out must STAY public.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.
    - **Manual test:** As a candidate, open every recruiter and admin address - all refused. Signed out, same. As company A, request company B's project, shortlist, note and candidate records by id - all refused. Confirm sign-in still works.
    - **Done when:** All refused. Each cross-company case asserted separately. Public pages still public.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-041` **As a candidate, my email, phone and CV must not leak to a recruiter who has not unlocked me.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** No recruiter screen returns contact details in its data unless that recruiter has unlocked them - checked in the raw response, not on screen.
    - **Find out first:** Data can be present in a response even when it is not displayed. Check the network tab, not the page.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.
    - **Manual test:** Open the network tab. Visit search results, a candidate card and the project view for a candidate you have NOT unlocked. Search every response for their email, phone and CV link. Zero hits.
    - **Done when:** Zero contact data in any response for a non-unlocked candidate, verified in the raw payload.
    - **Regression check:** MANDATORY: a recruiter who HAS unlocked a candidate still sees the details.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-042` **As the team, we need somewhere realistic to test, and the journey tests green before we freeze.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** A test environment with every database change applied and fresh data, and the whole test suite passing on the release branch.
    - **Find out first:** Use a copy of the database, never production.
    - **Prompts:** P11 Database review. Copy only.
    - **Manual test:** Sign in to the test environment as a recruiter, a candidate and an admin. All three work.
    - **Done when:** Test environment clean. All journey tests and existing suites green on the release branch.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-043` **As the project lead, I need to know on Tuesday evening whether we can stop building.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** The feature freeze is signed against six criteria, or it is not signed and we say why.
    - **Find out first:** Check all six honestly. A criterion that is nearly true is not true.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement
    - **Manual test:** Read the six criteria aloud with the team. Sign or don't.
    - **Done when:** Signed only when: the build is clean; journey tests green; test environment ready; no P0 knowingly unfinished without a written note; anything unfinished switched off; every journey has a named person for Saturday.
    - **⛔ Sohail owns and signs this himself.**

---

## Wednesday 16 September — BUILD WAVE 3

*Last build day. Testing has been continuous throughout.*

> **FEATURE FREEZE — 20:00 tonight.** All committed functionality must be implemented. After tonight: blocker fixes, integration fixes, UAT fixes, regression and release prep only. No scope expansion — and no committed feature quietly dropped.

### Shallika · *designer*

- [ ] `T-012` **As the designer, I need to check the whole product one final time before we ship.** *(day 1 of 2)*
    - **🟢 LOW** · P0
    - **What needs to work:** Every September journey reviewed end to end in the running application on desktop and mobile.
    - **Find out first:** This is the last chance to catch something that makes the product feel unfinished.
    - **Prompts:** None.
    - **Manual test:** Walk the recruiter journey and the candidate journey end to end, on a laptop and on a phone. Log every issue with a rank.
    - **Done when:** Both journeys signed off. Blockers fixed before release; majors fixed if time allows; minors logged for October. A minor cosmetic issue never blocks the release.

### Shivansh

- [ ] `T-079` **As a recruiter, I see who applied, move them forward, and pull the good ones into my hiring project.**
    - **🟡 MEDIUM** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter opens their job, sees applicants, moves one forward with the candidate notified, and adds an applicant to a talent project as the SAME person - no duplicate record.
    - **Find out first:** This does not exist today. Reuse the pipeline stages from R5 so an applicant and a sourced candidate share one vocabulary. Use the shared add-to-shortlist helper.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open your job's applicants. Move one to screening - the candidate sees it and gets a notification. Add them to a talent project - they appear there as the same person, with only ONE record of them. As a recruiter from ANOTHER company, request that applicant id - not found.
    - **Done when:** Applicants list, stages move, candidate notified, applicant enters the project on the same identity. Cross-company refused.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.

### Zainab

- [ ] `T-080` **As a recruiter, I build a test and send it to the candidates I shortlisted.** *(day 3 of 3)*
    - **🔴 HIGH RISK** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** A recruiter creates a test with a title, instructions, time limit and pass mark, writes multiple-choice questions, reorders and edits them, previews it, publishes and assigns it - and each candidate is notified once.
    - **Find out first:** Question storage and result storage BOTH already exist unused - find them and use them. Do not create a second question model. Everything scoped to the recruiter's own company.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (new data + company isolation) -> P11 Database review -> P3 Implement.
    - **Manual test:** Create a test with four questions. Reorder, edit one, delete one. Reload - all stuck. Try saving a question with no correct answer - refused. Preview - it looks like the candidate's view. Publish and assign to three shortlisted candidates - exactly three assignments, no duplicates, each notified. As another company, open its id - not found.
    - **Done when:** Full builder CRUD persists. Preview reuses the real candidate screen. Assignment is one per candidate. Company isolation proven.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-081` **As a candidate, I take the test without losing my answers, and both sides see the result.**
    - **🔴 HIGH RISK** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The candidate opens the test from their notification, answers within the time limit, can refresh without losing work or gaining time, submits, and it is marked automatically - with the recruiter reading a question-by-question report.
    - **Find out first:** The time limit MUST be enforced by the server, and correct answers must NEVER reach the browser before submission. Verify both in the network response, not on the screen.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (cheat vectors) -> P3 Implement -> P10 Security review.
    - **Manual test:** Open from the notification - the right test. Answer two questions. REFRESH - answers kept, timer did NOT reset. Open the network tab - NO correct answers anywhere. Wait past the limit and submit - refused. Open another candidate's test id - refused. Submit properly - the score matches a hand calculation. As the recruiter, read the report.
    - **Done when:** Server-enforced timer. No answer leakage. Refresh-safe. Deterministic marking, repeatable, no duplicate result. Recruiter report matches the candidate's answers. The result records proof for the tested skills.
    - **Regression check:** MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**
- [ ] `T-088` **As a candidate, I can finish a mock interview and get a report I can act on.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P2
    - **What needs to work:** The journey is walked on production with a fresh account, every blocking break is fixed, and the finished report records proof and reaches the recruiter's view.
    - **Find out first:** Substantial code exists but nobody has proven it works for a NEW user. Walk it as a real user FIRST, then fix only what blocks. Do not extend the interview engine.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fresh account: open mock interviews, pick a domain, start, answer, finish, read the report, check history. Force a provider failure - readable message, no lost attempt. Then check the recruiter view of the signal.
    - **Done when:** Every blocking break closed or written off in writing. Report shows strengths, weaknesses and improvements. One proof record, visible to recruiters where privacy allows. Failure paths degrade rather than dead-end.
    - **Regression check:** MANDATORY: an existing candidate's past interview reports still open.
- [ ] `T-089` **As a new candidate, I can join a cohort or a hackathon and have it count.**
    - **🟡 MEDIUM** · P2
    - **What needs to work:** Both journeys are walked on production with fresh accounts, every blocking break is fixed, and completing work records proof a recruiter can see.
    - **Find out first:** Live for months but never proven for a NEW user. Walk both as a real user FIRST. Record what duplicate submission actually does rather than assuming. Do not rebuild the infrastructure.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fresh account: find a cohort, enrol, complete an activity, submit, see it marked. Fresh participant: find a hackathon, register alone AND in a team, submit, try a duplicate, see the result. Then check a recruiter can see the resulting signal.
    - **Done when:** Both journeys complete for a genuinely new user. Proof recorded and visible to a recruiter - 'the record was written' is not enough, the recruiter view is checked.
    - **Regression check:** MANDATORY: complete one existing challenge task - points and progress still work.

### shashank

- [ ] `T-076` **As a recruiter, I want to see why this candidate came up, and where they fall short.** *(day 3 of 3)*
    - **🟡 MEDIUM** · P1
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** Opening a candidate shows their strongest signals with a count behind each, the gaps against this project's criteria, and an honest statement when there is not enough information.
    - **Find out first:** Existing scoring and match-explanation code already exists - reuse it rather than writing a scoring engine. Facts are records that exist; anything else is our judgement and must look different.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Open a candidate with several verified activities - counted signals. Set a project needing AWS and 2 years, open someone with neither - exactly two gap lines. Open a brand-new candidate - it says there is not enough information and shows NO score.
    - **Done when:** Signals counted from real records. Gaps specific and correct. Empty candidates handled honestly. Self-declared and evidence-backed visually distinct. No invented score.
    - **Regression check:** MANDATORY: run a recruiter search that worked before and confirm the same candidates come back.
- [ ] `T-083` **As a recruiter, I can see whether my hiring is actually working.**
    - **🟡 MEDIUM** · P2
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** One page showing active jobs and projects, candidates discovered, viewed, shortlisted and contacted, applications, tests assigned and completed - for my company only.
    - **Find out first:** These are straightforward counts over tables the other workstreams already write. Do NOT add new counters or a reporting layer.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Write down every number. Do a real search, view, shortlist, unlock and stage change. Re-read - each corresponding number moved and nothing else did. Sign in as a different company - none of your activity appears.
    - **Done when:** Every number reconciles against a hand count and is company-scoped. No chart a recruiter cannot act on.
    - **Regression check:** MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged.
- [ ] `T-085` **As a candidate, I can see that real recruiters are looking at me.**
    - **🔴 HIGH RISK** · P2 · waits on D-8
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** An approved recruiter opening a candidate is recorded once however many times they refresh, unauthorised viewers record nothing, and the candidate sees the count.
    - **Find out first:** Nothing like this exists. Ask Claude how a recruiter is identified as approved so unauthorised callers record nothing. Agree the candidate-facing wording with Sohail first.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail (privacy + new data) -> P3 Implement -> P10 Security review.
    - **Manual test:** As an approved recruiter, open a candidate and REFRESH FIVE TIMES - exactly one view recorded. As a candidate, as an anonymous visitor, and as a recruiter from another company - each records nothing and is refused.
    - **Done when:** One view per recruiter per candidate per window. Three unauthorised cases refused and tested explicitly. The candidate sees an accurate count.
    - **Regression check:** MANDATORY: opening a candidate profile still works normally for an approved recruiter.
    - **⛔ STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.**

### Manuvrtti

- [ ] `T-082` **As a recruiter, I am told when something needs me - and only then.** *(day 3 of 3)*
    - **🟡 MEDIUM** · P1 · waits on D-9
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** The recruiter events produce a notification each, only the important ones send email, and a notification centre links straight to the thing it is about.
    - **Find out first:** Build on the shared notification helper - this is mostly configuration, not new infrastructure. Follow the candidate bell as the pattern.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Trigger each recruiter event. Each appears once in the bell and its link opens THAT candidate, job or test - never a list. Count your emails: only the important ones. Switch one off and re-trigger - it stops, nothing else does.
    - **Done when:** Every event notifies once. Only the agreed few email. Every link opens the right thing. Preferences work per type and channel.
    - **Regression check:** MANDATORY: an existing admin broadcast still reaches the bell. MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives.
- [ ] `T-087` **As a candidate, I add my GitHub, LeetCode and CodeChef profiles.** *(day 2 of 2)*
    - **🟡 MEDIUM** · P2
    - **🎨 Approved design required before frontend work starts (see UI/UX sheet).**
    - **What needs to work:** All three can be added, checked for a sensible format, removed and re-added - and every one is shown to a recruiter as self-reported, never as verified.
    - **Find out first:** Link storage for all three ALREADY EXISTS in the database - find it before creating anything. Nothing is fetched from those sites this month; these are declared links.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Add all three. Enter a nonsense handle - refused readably. Remove one and add it back. View as a recruiter - each clearly marked self-reported, with no score anywhere.
    - **Done when:** All three connect, validate, disconnect and reconnect. Every external signal labelled self-reported. No invented score exists anywhere.
    - **Regression check:** MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload.

---

## Thursday 17 September — UAT - FIND ONLY

*Run every script. Fix nothing.*

> **Find only.** Log every problem. Fix nothing today.

### Shallika · *designer*

- [ ] `T-012` **As the designer, I need to check the whole product one final time before we ship.** *(day 2 of 2)*
    - **🟢 LOW** · P0
    - **What needs to work:** Every September journey reviewed end to end in the running application on desktop and mobile.
    - **Find out first:** This is the last chance to catch something that makes the product feel unfinished.
    - **Prompts:** None.
    - **Manual test:** Walk the recruiter journey and the candidate journey end to end, on a laptop and on a phone. Log every issue with a rank.
    - **Done when:** Both journeys signed off. Blockers fixed before release; majors fixed if time allows; minors logged for October. A minor cosmetic issue never blocks the release.
- [ ] `T-049` **As the project lead, I need Shallika to test somebody else's work with a fresh account.**
    - **🟢 LOW** · P0
    - **What needs to work:** Scripts Full UI/UX pass, both journeys executed and every failure written down.
    - **Find out first:** You are testing work you did NOT build. Follow the script exactly.
    - **Prompts:** No AI. Human testing.
    - **Manual test:** Execute each assigned script with FRESH accounts. Log every failure with a rank. DO NOT FIX ANYTHING TODAY - we need the real number first.
    - **Done when:** Every assigned script executed with fresh accounts. Every failure logged and ranked. Nothing fixed today.

### Shivansh

- [ ] `T-045` **As the project lead, I need Shivansh to test somebody else's work with a fresh account.**
    - **🟢 LOW** · P0
    - **What needs to work:** Scripts UAT-3, UAT-4, UAT-5 executed and every failure written down.
    - **Find out first:** You are testing work you did NOT build. Follow the script exactly.
    - **Prompts:** No AI. Human testing.
    - **Manual test:** Execute each assigned script with FRESH accounts. Log every failure with a rank. DO NOT FIX ANYTHING TODAY - we need the real number first.
    - **Done when:** Every assigned script executed with fresh accounts. Every failure logged and ranked. Nothing fixed today.

### Zainab

- [ ] `T-044` **As the project lead, I need Zainab to test somebody else's work with a fresh account.**
    - **🟢 LOW** · P0
    - **What needs to work:** Scripts UAT-1, UAT-2 executed and every failure written down.
    - **Find out first:** You are testing work you did NOT build. Follow the script exactly.
    - **Prompts:** No AI. Human testing.
    - **Manual test:** Execute each assigned script with FRESH accounts. Log every failure with a rank. DO NOT FIX ANYTHING TODAY - we need the real number first.
    - **Done when:** Every assigned script executed with fresh accounts. Every failure logged and ranked. Nothing fixed today.

### shashank

- [ ] `T-047` **As the project lead, I need shashank to test somebody else's work with a fresh account.**
    - **🟢 LOW** · P0
    - **What needs to work:** Scripts UAT-8, UAT-9, UAT-10 executed and every failure written down.
    - **Find out first:** You are testing work you did NOT build. Follow the script exactly.
    - **Prompts:** No AI. Human testing.
    - **Manual test:** Execute each assigned script with FRESH accounts. Log every failure with a rank. DO NOT FIX ANYTHING TODAY - we need the real number first.
    - **Done when:** Every assigned script executed with fresh accounts. Every failure logged and ranked. Nothing fixed today.

### Manuvrtti

- [ ] `T-046` **As the project lead, I need Manuvrtti to test somebody else's work with a fresh account.**
    - **🟢 LOW** · P0
    - **What needs to work:** Scripts UAT-6, UAT-7 executed and every failure written down.
    - **Find out first:** You are testing work you did NOT build. Follow the script exactly.
    - **Prompts:** No AI. Human testing.
    - **Manual test:** Execute each assigned script with FRESH accounts. Log every failure with a rank. DO NOT FIX ANYTHING TODAY - we need the real number first.
    - **Done when:** Every assigned script executed with fresh accounts. Every failure logged and ranked. Nothing fixed today.

### Sohail

- [ ] `T-048` **As the project lead, I need Sohail to test somebody else's work with a fresh account.**
    - **🟢 LOW** · P0
    - **What needs to work:** Scripts UAT-11, UAT-12 executed and every failure written down.
    - **Find out first:** You are testing work you did NOT build. Follow the script exactly.
    - **Prompts:** No AI. Human testing.
    - **Manual test:** Execute each assigned script with FRESH accounts. Log every failure with a rank. DO NOT FIX ANYTHING TODAY - we need the real number first.
    - **Done when:** Every assigned script executed with fresh accounts. Every failure logged and ranked. Nothing fixed today.
- [ ] `T-050` **As the project lead, I need to know by Wednesday evening how bad it is.**
    - **🟢 LOW** · P0
    - **What needs to work:** Every logged defect has a rank and an owner, and nobody retests their own fix.
    - **Find out first:** Triage together at end of day.
    - **Prompts:** None.
    - **Manual test:** Read every bug. Assign rank and owner.
    - **Done when:** All defects triaged and assigned. The finder is recorded for retesting.

---

## Friday 18 September — FIX + REGRESSION + SIGN-OFF

*Blockers, majors, regression, six signatures.*

> **Six signatures tonight.** Zero blockers, zero majors, UI/UX signed off, regression clean.

### Shallika · *designer*

- [ ] `T-056` **As the designer, I check the fixes did not break the experience.**
    - **🟢 LOW** · P0
    - **What needs to work:** Every UI fix from today is re-checked in the running app.
    - **Find out first:** Fixes made under time pressure are where states get dropped.
    - **Prompts:** P14 UI review.
    - **Manual test:** Re-walk every screen that changed today. Check states, spacing and mobile.
    - **Done when:** Every changed screen re-checked. New issues ranked; minors go to October.
- [ ] `T-063` **As the designer, I give the final UI/UX verdict.**
    - **🟢 LOW** · P0
    - **What needs to work:** Both September journeys signed off in the running application, on desktop and mobile.
    - **Find out first:** Last chance to catch something that makes the product feel unfinished.
    - **Prompts:** P14 UI review.
    - **Manual test:** Walk the recruiter journey and the candidate journey end to end, laptop and phone.
    - **Done when:** UI/UX SIGN-OFF recorded as PASS or NEEDS FIX per journey. Blockers must be fixed before release; minors go to October and never block it.

### Shivansh

- [ ] `T-051` **As Shivansh, I fix every blocker assigned to me.**
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Every assigned blocker is fixed and handed back to whoever found it.
    - **Find out first:** Use P4 to find the cause before changing anything.
    - **Prompts:** P4 Bug investigation -> P3 Implement -> P7 Self-review.
    - **Manual test:** Fix it, then have the ORIGINAL finder confirm it - not yourself.
    - **Done when:** Every assigned blocker fixed, confirmed by its finder, covered by a new test.
    - **Regression check:** Re-run the manual test of the feature you touched.
- [ ] `T-057` **As Shivansh, I fix the majors and re-run my scripts clean.**
    - **🟢 LOW** · P0
    - **What needs to work:** Major defects closed and every assigned script passes on a clean re-run.
    - **Find out first:** A script that passed on Thursday but not today has NOT passed.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fix majors, then re-run every script you ran on Wednesday, start to finish.
    - **Done when:** Majors closed. Every script passes on the re-run.
    - **Regression check:** Re-run the manual test of anything you touched.

### Zainab

- [ ] `T-052` **As Zainab, I fix every blocker assigned to me.**
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Every assigned blocker is fixed and handed back to whoever found it.
    - **Find out first:** Use P4 to find the cause before changing anything.
    - **Prompts:** P4 Bug investigation -> P3 Implement -> P7 Self-review.
    - **Manual test:** Fix it, then have the ORIGINAL finder confirm it - not yourself.
    - **Done when:** Every assigned blocker fixed, confirmed by its finder, covered by a new test.
    - **Regression check:** Re-run the manual test of the feature you touched.
- [ ] `T-058` **As Zainab, I fix the majors and re-run my scripts clean.**
    - **🟢 LOW** · P0
    - **What needs to work:** Major defects closed and every assigned script passes on a clean re-run.
    - **Find out first:** A script that passed on Thursday but not today has NOT passed.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fix majors, then re-run every script you ran on Wednesday, start to finish.
    - **Done when:** Majors closed. Every script passes on the re-run.
    - **Regression check:** Re-run the manual test of anything you touched.

### shashank

- [ ] `T-053` **As shashank, I fix every blocker assigned to me.**
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Every assigned blocker is fixed and handed back to whoever found it.
    - **Find out first:** Use P4 to find the cause before changing anything.
    - **Prompts:** P4 Bug investigation -> P3 Implement -> P7 Self-review.
    - **Manual test:** Fix it, then have the ORIGINAL finder confirm it - not yourself.
    - **Done when:** Every assigned blocker fixed, confirmed by its finder, covered by a new test.
    - **Regression check:** Re-run the manual test of the feature you touched.
- [ ] `T-059` **As shashank, I fix the majors and re-run my scripts clean.**
    - **🟢 LOW** · P0
    - **What needs to work:** Major defects closed and every assigned script passes on a clean re-run.
    - **Find out first:** A script that passed on Thursday but not today has NOT passed.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fix majors, then re-run every script you ran on Wednesday, start to finish.
    - **Done when:** Majors closed. Every script passes on the re-run.
    - **Regression check:** Re-run the manual test of anything you touched.

### Manuvrtti

- [ ] `T-054` **As Manuvrtti, I fix every blocker assigned to me.**
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Every assigned blocker is fixed and handed back to whoever found it.
    - **Find out first:** Use P4 to find the cause before changing anything.
    - **Prompts:** P4 Bug investigation -> P3 Implement -> P7 Self-review.
    - **Manual test:** Fix it, then have the ORIGINAL finder confirm it - not yourself.
    - **Done when:** Every assigned blocker fixed, confirmed by its finder, covered by a new test.
    - **Regression check:** Re-run the manual test of the feature you touched.
- [ ] `T-060` **As Manuvrtti, I fix the majors and re-run my scripts clean.**
    - **🟢 LOW** · P0
    - **What needs to work:** Major defects closed and every assigned script passes on a clean re-run.
    - **Find out first:** A script that passed on Thursday but not today has NOT passed.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fix majors, then re-run every script you ran on Wednesday, start to finish.
    - **Done when:** Majors closed. Every script passes on the re-run.
    - **Regression check:** Re-run the manual test of anything you touched.

### Sohail

- [ ] `T-055` **As Sohail, I fix every blocker assigned to me.**
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Every assigned blocker is fixed and handed back to whoever found it.
    - **Find out first:** Use P4 to find the cause before changing anything.
    - **Prompts:** P4 Bug investigation -> P3 Implement -> P7 Self-review.
    - **Manual test:** Fix it, then have the ORIGINAL finder confirm it - not yourself.
    - **Done when:** Every assigned blocker fixed, confirmed by its finder, covered by a new test.
    - **Regression check:** Re-run the manual test of the feature you touched.
- [ ] `T-061` **As Sohail, I fix the majors and re-run my scripts clean.**
    - **🟢 LOW** · P0
    - **What needs to work:** Major defects closed and every assigned script passes on a clean re-run.
    - **Find out first:** A script that passed on Thursday but not today has NOT passed.
    - **Prompts:** P1 Investigate -> P2 Plan -> P3 Implement
    - **Manual test:** Fix majors, then re-run every script you ran on Wednesday, start to finish.
    - **Done when:** Majors closed. Every script passes on the re-run.
    - **Regression check:** Re-run the manual test of anything you touched.
- [ ] `T-062` **As the project lead, I need to know nothing we built broke something that already worked.**
    - **🟡 MEDIUM** · P0
    - **What needs to work:** Every pre-existing journey still works: challenge submissions, programme missions, hackathon submissions, certificates, marketplace, workshop signup and points.
    - **Find out first:** These worked before September and nobody has been testing them.
    - **Prompts:** P5 Regression analysis if something has broken.
    - **Manual test:** Walk each of the seven as a real user.
    - **Done when:** All seven still work. All existing suites green.
    - **Regression check:** This IS the regression check.
- [ ] `T-064` **As the project lead, I need everyone to say out loud that their part works.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Six signatures, each meaning: I walked the journeys I own, with fresh accounts, and I am willing to be woken up about them.
    - **Find out first:** Check the exit conditions honestly before asking anyone to sign.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement
    - **Manual test:** Read the exit criteria. Collect six signatures.
    - **Done when:** Zero blockers, zero majors, every script passed on the re-run, journey tests green, regression clean, UI/UX signed off. Six signatures.
    - **⛔ Sohail owns and signs this himself.**

---

## Saturday 19 September — RELEASE DAY

*Go live and verify on production.*

> **GO LIVE.** Everyone verifies their own journeys on production. Sunday 20th is the deadline date — nobody works it.

### Shallika · *designer*

- [ ] `T-072` **As Shallika, I confirm my part works on the live site.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every journey this person owns is walked on production with fresh accounts, and the created record ids are written down.
    - **Find out first:** Production, not the test environment. Fresh accounts, not your own.
    - **Prompts:** None. Human verification.
    - **Manual test:** Walk both journeys on the live site, on a laptop and a phone. Confirm the shipped product matches what was approved.
    - **Done when:** Every journey completed on production. Record ids on the checklist. A failure here is a blocker and stops the release.
    - **Regression check:** This IS the production regression check.
    - **⛔ Owner walks it; Sohail records it.**

### Shivansh

- [ ] `T-067` **As Shivansh, I confirm my part works on the live site.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every journey this person owns is walked on production with fresh accounts, and the created record ids are written down.
    - **Find out first:** Production, not the test environment. Fresh accounts, not your own.
    - **Prompts:** None. Human verification.
    - **Manual test:** Sign up as a fresh recruiter, onboard the company, reach Home. Then as a fresh candidate: build a full profile, add self-declared skills, log out, log in, edit, remove an item, check the recruiter preview, and confirm you appear in a recruiter search.
    - **Done when:** Every journey completed on production. Record ids on the checklist. A failure here is a blocker and stops the release.
    - **Regression check:** This IS the production regression check.
    - **⛔ Owner walks it; Sohail records it.**

### Zainab

- [ ] `T-069` **As Zainab, I confirm my part works on the live site.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every journey this person owns is walked on production with fresh accounts, and the created record ids are written down.
    - **Find out first:** Production, not the test environment. Fresh accounts, not your own.
    - **Prompts:** None. Human verification.
    - **Manual test:** Unlock a candidate and send them a REAL email - confirm it arrives. Confirm the pipeline moved to contacted and the outreach history shows it.
    - **Done when:** Every journey completed on production. Record ids on the checklist. A failure here is a blocker and stops the release.
    - **Regression check:** This IS the production regression check.
    - **⛔ Owner walks it; Sohail records it.**

### shashank

- [ ] `T-068` **As shashank, I confirm my part works on the live site.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every journey this person owns is walked on production with fresh accounts, and the created record ids are written down.
    - **Find out first:** Production, not the test environment. Fresh accounts, not your own.
    - **Prompts:** None. Human verification.
    - **Manual test:** Create a talent project, set criteria, search, shortlist people from different groups, move stages. Sign out and back in FROM ANOTHER BROWSER and confirm everything survived.
    - **Done when:** Every journey completed on production. Record ids on the checklist. A failure here is a blocker and stops the release.
    - **Regression check:** This IS the production regression check.
    - **⛔ Owner walks it; Sohail records it.**

### Manuvrtti

- [ ] `T-070` **As Manuvrtti, I confirm my part works on the live site.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every journey this person owns is walked on production with fresh accounts, and the created record ids are written down.
    - **Find out first:** Production, not the test environment. Fresh accounts, not your own.
    - **Prompts:** None. Human verification.
    - **Manual test:** Trigger the September notifications - confirm the bell and a real inbox, and that a switched-off preference stays quiet. Confirm errors reach the tracking tool.
    - **Done when:** Every journey completed on production. Record ids on the checklist. A failure here is a blocker and stops the release.
    - **Regression check:** This IS the production regression check.
    - **⛔ Owner walks it; Sohail records it.**

### Sohail

- [ ] `T-065` **As the team, we can undo the release if it goes wrong.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** A snapshot of production is taken before anything changes.
    - **Find out first:** Snapshot FIRST, before any change.
    - **Prompts:** None - Sohail does this personally.
    - **Manual test:** Take it. Write down its id.
    - **Done when:** Snapshot taken and its id on the checklist before any change.
    - **⛔ Sohail only.**
- [ ] `T-066` **As the team, the database changes reach production safely and we deploy what was tested.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every change applied and confirmed, then the release branch deployed - not the main branch.
    - **Find out first:** Already rehearsed on a copy. Confirm the deployed version matches what was signed off.
    - **Prompts:** P11 Database review.
    - **Manual test:** Apply changes. Confirm each. Deploy. Compare the deployed version to the signed-off one.
    - **Done when:** Every change applied and confirmed. Deployed version matches the signed-off release branch exactly.
    - **⛔ Sohail only.**
- [ ] `T-071` **As Sohail, I confirm my part works on the live site.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** Every journey this person owns is walked on production with fresh accounts, and the created record ids are written down.
    - **Find out first:** Production, not the test environment. Fresh accounts, not your own.
    - **Prompts:** None. Human verification.
    - **Manual test:** Exhaust a plan limit and call the action directly with the browser bypassed - it must be refused. Re-run the company-isolation and contact-leak checks against production.
    - **Done when:** Every journey completed on production. Record ids on the checklist. A failure here is a blocker and stops the release.
    - **Regression check:** This IS the production regression check.
    - **⛔ Owner walks it; Sohail records it.**
- [ ] `T-073` **As the project lead, I decide whether we are live.**
    - **🔴 HIGH RISK** · P0
    - **What needs to work:** The release is declared only when every P0 journey step has a passed production check. Anything unverified is switched off, not shipped hopefully.
    - **Find out first:** Read the checklist. Count the passed checks.
    - **Prompts:** P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement
    - **Manual test:** Confirm every P0 journey row is verified. Watch errors for two hours. Sign, or switch the unverified part off.
    - **Done when:** Declared only at full P0 coverage. No new error type in the two-hour watch. Anything unverified is flagged off with its owner named. Sunday 20 September is the stated deadline date - the product is already live from Saturday.
    - **⛔ Sohail only.**

---

## Sunday 20 September — HOLIDAY

> No work. No development, design, QA, review or testing.  
> **This is the stated deadline date. The product has been live and verified since Saturday.**

---

# DELIVERY RISK - read this

The full committed product is in this plan. Nothing was deferred. But the arithmetic does not close:

| | Days |
|---|---|
| Committed scope, after every simplification | **60.4** |
| Capacity: 10 build days x 4.0 developer FTE, less overhead | **34.0** |
| **Gap** | **26.4 developer-days** |

That is roughly **2.6 additional full-time developers** for the whole window. Parallelisation cannot recover it - everyone is already scheduled at ~150%.

**Priority here is EXECUTION ORDER, not a deferral list.** Build P0 first, then P1, then P2 — so that if something is unfinished on the 19th it is the least critical work, not the most recent. That call belongs to the product lead at the Saturday 12 September gate, not to whoever runs out of time.

