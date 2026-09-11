# ABTalks — Demo Contract

Three demos: **Saturday 12**, **Tuesday 15** and **Saturday 19 September 2026**.

Everything listed under a demo is implemented, integrated and testable on that date. If it is listed, you can
go and use it.

---

## The product contract

**1 · Candidate discovery is automatic.** An active candidate with a usable profile is recruiter-searchable
immediately. There is no visibility switch, no opt-in, no opt-out and no candidate field hide/show. The platform
decides which profile fields a recruiter sees. Protected contact details — email, phone and protected contact
information — stay behind the recruiter's paid unlock. ABTalks may internally suppress a fraudulent, abusive,
suspended or deleted account; that is platform moderation, not candidate consent.

**2 · Every recruiter works alone.** A recruiter is one independent user who owns their own workspace, projects,
credits, jobs, candidates, pipeline, assessments, outreach and analytics. Two recruiters on the same company
email domain stay independent, and neither can see the other's hiring data. Multi-user company hiring is
Phase 2 / Contact Sales and is not part of September.

**3 · Three personas.** Candidate · Recruiter · ABTalks Platform Admin.

**4 · Recruiter sign-in is work email only.** Personal domains — gmail.com, yahoo.com, hotmail.com,
outlook.com — are refused, with no exception path and no Google, LinkedIn or Microsoft sign-in. Candidate
authentication is separate and unchanged.

**5 · Money.** A recruiter starts with **$200**. A contact unlock costs **$10**. Unlocking the same candidate
again is **free**. Both values change without a deployment. Credits belong to the individual recruiter.

**6 · Notifications** are in-app and selective email only.

**7 · Release rule.** A committed capability that is not verified by 19 September is a release blocker.

---

## Before you start

Use the test environment and create a fresh account. If something listed here does not work, it is a bug.

---

# Demo 1 — Saturday 12 September

Everything below is complete by end of day 11 September.

## Candidate

- Your profile keeps education, experience, projects, certifications and achievements - sign out, sign in on another browser, nothing is lost.
- You are findable without doing anything - register, add React, Next.js and Node.js by hand, change no settings, and a recruiter searching React finds you.
- There is no visibility switch and no field hide/show to look for - discovery is automatic and the platform decides which fields a recruiter sees.
- Say what you are open to - full-time, internship, freelance, part-time, contract - and recruiters filter on it.
- See every company that unlocked your contact details, export your own data, and delete your account yourself - immediately, with no admin approval.
- Take an assessment - MCQ, multi-select, subjective and file upload - close the browser halfway and reopen on another device; every answer is still there.
- Jobs - browse, filter, apply once, and track what happened; a second application to the same job is refused.

## Recruiter

- Sign up with a company email - gmail.com, yahoo.com, hotmail.com and outlook.com are refused, and there is no exception path.
- Register and set up your own independent workspace - a second person on the same company domain gets their own separate workspace, not yours.
- Your recruiter and company details persist and belong to you alone.
- You start with $200 of credits, held on your own account.
- Unlock with the cost shown first - the dialog states the cost, your balance and what you will have left before you confirm; unlocking the same person again is free.
- A retried or duplicated unlock never charges you twice, and an unlock you cannot afford is refused.
- Plans and limits - what you get, what you have used, and a readable message when you run out.
- Email a candidate from inside ABTalks - and their reply comes back to you, not to a shared inbox.
- A hiring project that remembers everything - name it, set criteria, search, view four candidates, shortlist two, reject one, then sign in from a different browser and find it exactly as you left it.
- Search on role, skill, experience, location and opportunity type, with fast paginated results.
- Search matches how people type - React, ReactJS and React.js find the same people.
- Hire beyond engineering - search sales, marketing, HR, finance, operations, business development, product, design and business analyst the same way, with no GitHub penalty.
- Re-running a search flags only genuinely new people.
- Read a candidate beside your results - resizable panel, next and previous, and closing returns you exactly where you were.
- Move people through the pipeline - stages hold across refresh and device.
- Build a real test - sections, four question types, duration and pass mark.
- Publish and assign the test, then see who started, who completed and how they scored.
- Post a job - title, description, skills, location, work mode and type - and control when it goes live, closes and reopens.

## ABTalks Platform Admin

- Recruiter isolation - paste recruiter A's project URL as recruiter B and get 'not found'.
- Admin access is a database role - granted, scoped and revoked with no deployment.
- Inspect a talent project read-only.

*Live but not a screen:* Notifications deliver in-app and selectively by email, deduplicated, with a delivery record · GA4 in production only, behind the cookie consent choice · Every protected action is enforced server-side, not by hiding a button · Protected contact details never reach a recruiter before a successful unlock · Rate limiting on the money and personal-data paths · Production error tracking live and reporting · A backup restore that has actually been rehearsed, with written steps · Search load-tested against a realistic candidate pool.

---

# Demo 2 — Tuesday 15 September

Everything below is complete by end of day 14 September.

## Candidate

- Your other profiles - GitHub, LeetCode and CodeChef - labelled self-reported.
- Cohorts and hackathons - enrol, take part, finish, and it becomes evidence on your profile.
- Past cohort and hackathon work already counts as evidence.
- Mock interviews - the first three are free and you can see how many remain; the fourth costs Synergy Points at a rate ABTalks can change without a deployment; a failed interview costs nothing.
- A mock interview report that is specific and actionable rather than a score out of ten.
- Honest career guidance about getting ready for your next job, with no invented statistics.
- Relevant cohorts, hackathons and challenges suggested from your own profile.
- Job alerts - when a matching job is published you are told once, and editing or re-publishing that same job never tells you again.
- Know when you are looked at - one notification per recruiter per 24 hours, in-app and by email.
- Privacy wording at the moments you make a decision, matching what the product actually does.

## Recruiter

- See what you spent - every unlock with who it was on, when and how much.
- Proven versus claimed - both candidates appear, the labels differ, the evidence names its source, and the evidence-backed one ranks higher.
- Analytics on your own real activity - searches, views, shortlists, unlocks, outreach, jobs and assessments.
- Applicants join the same pipeline as people you sourced by searching - one hub, not two inboxes.
- Told when something needs you - a new application, a candidate reply, a completed assessment, a pipeline action, or a system issue affecting you.

## ABTalks Platform Admin

- Assessment integrity - fullscreen exits, tab switches, copy/paste and page-leave recorded; camera only with consent; nothing claims eye tracking or second-monitor detection.
- Sensitive actions leave a record - who, what, before, after, why.

*Live but not a screen:* Analytics events verified with no personal data in them · UTM attribution working and every event verified in DebugView.

---

# Demo 3 / Release — Saturday 19 September

All implementation complete by end of day 16 September. Everything above, verified on the live site, plus:

## ABTalks Platform Admin

- Global admin search across people, recruiters, jobs, projects and assessments.
- Candidate detail page - compare it against what the candidate sees themselves.
- 'Why isn't this candidate showing up?' - every real condition, naming the blocker in plain words, never mentioning consent because that is not a thing.
- Recruiter detail and company identity - compare it against what the recruiter sees themselves.
- 'Why can't this recruiter unlock?' - plan, credits, previous unlocks and the real reason.
- 'Why didn't this email arrive?' - every message sent, with failures explained readably.
- Fix a credit problem - adjust a balance with a mandatory reason, and a ledger line and an audit entry appear.
- Support mode (View As) - a permanent banner, audited entry and exit, dangerous actions refused, and no session ever created as the target user.
- Disable, restore and secure an account safely - no operator ever sees or sets a password.
- 'What happened to this candidate's assessment?' - real attempt, result, integrity signals and failures.
- 'Why does this candidate have an evidence-backed label?' - the real source activity and when it was earned.
- Trace what happened to a job applicant without touching the database.
- Programmes, cohorts, hackathons and mock interviews administered from the same console.
- Change business values without a deploy - starting credits, unlock cost, free mock allowance and mock point cost.

*Live but not a screen:* The team can run routine support from the console, without touching the database · All three personas verified together on one environment · All seven pre-September journeys still work.

---

## Three things that changed, so nobody logs them as bugs

**No visibility switch and no field hide/show for candidates.** Discovery is automatic and the platform decides
which fields a recruiter sees. Contact details stay behind the paid unlock.

**No company team.** No Company Admin, no Owner, no colleague invitation, no shared workspace and no shared
credits. Every recruiter works alone. Multi-user hiring is Phase 2 / Contact Sales.

**No Google login for recruiters and no exception.** Company email only. Candidate sign-in is unaffected.

