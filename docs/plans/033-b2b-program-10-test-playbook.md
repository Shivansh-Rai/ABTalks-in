# 033 — B2B Program — End-to-end Test Playbook

> Not an implementation plan — the manual verification script for plans 024–032.
> Work through phases IN ORDER; later phases assume earlier ones passed.
> Pre-flight status when written (2026-07-09): `npx tsc --noEmit` clean, all 17
> migrations applied, plans 027–032 implemented but UNCOMMITTED, program env vars
> NOT yet set (everything 404s until Phase 0 is done).

## ⚠️ Before anything
- **This is the shared production Neon DB.** Create a Neon branch snapshot named
  `pre-b2b-testing` before Phase 2. Test rows are real rows — Phase 11 cleans up.
- **Commit the working tree first**: plans 027–032 sit uncommitted.
  `git add -A && git commit -m "feat(program): missions, signals, AI layer, interview, talent portal, admin"`
- Note: `npm run build` runs `prisma migrate deploy` (no-op right now since the DB is
  up to date, but know that it touches the DB).

## Phase 0 — Setup (15 min)
1. Add to `.env.local`:
   ```
   ENABLE_PROGRAM=true
   CRON_SECRET=<any random string for local>
   GITHUB_API_TOKEN=<classic PAT, public-repo read>   # Phase 5+
   ANTHROPIC_API_KEY=<key>                             # Phase 4 (PROMPT_FORGE), 6
   OPENAI_API_KEY=<key>                                # Phase 7
   ```
   (`ENABLE_DEV_AUTH=true` already set — dev users `*@abtalks.dev`, password `test`.)
2. `npm run db:seed:program` → log should show: 4 modules, 30 days, concept questions,
   entry questions, exercises, videos, all seeded (no "skipped" lines).
3. `npm run dev`. Keep `prisma/content/program/entry-questions.json` and `days.json`
   open in an editor — you'll need the correct answers to pass gates quickly.

## Phase 1 — Flag & auth routing (10 min)
| Test | Expected |
|---|---|
| Comment out `ENABLE_PROGRAM`, restart, visit `/program`, `/talent` | Both 404; student app (`/dashboard`, `/challenge/today`) unchanged. Re-enable after. |
| Logged out → `/program` | Public landing renders |
| Logged out → `/program/dashboard` | → `/login?from=/program/dashboard` |
| Log in (fresh dev user) from that page | Back to `/program/dashboard` → bounced to `/program` (not a member) — **NOT to `/register`** |
| Log in `sneha@abtalks.dev` → student routes | Zero change to student experience |

## Phase 2 — Cohort creation (admin)
Log in `admin@abtalks.dev` → `/admin/program`:
- Create cohort: startsAt = today, endsAt = +35 days, **capacity = 3** (makes waitlist
  testable), status → `ENROLLING`.
- Try creating a second cohort → rejected (single non-ARCHIVED cohort rule).

## Phase 3 — Entry funnel (30 min)
1. `arjun@abtalks.dev` → `/program/apply`:
   - Form: repo owner ≠ githubUsername → rejected with message. Fix → submit OK.
   - For SHIP_IT/commit tests later, use a GitHub username + public repo YOU control.
2. Assessment: 20 Qs render one at a time, timer counts down. Answer from the JSON →
   pass → **ENROLLED**, dashboard link appears.
3. `priya@` and `rohan@`: repeat → both ENROLLED (capacity 3 now full).
4. `vikram@`: apply, PASS the assessment → **WAITLISTED** (capacity full).
5. `anika@`: FAIL deliberately → cooldown notice with IST time. Fast-forward:
   `UPDATE "ProgramEntryAttempt" SET "submittedAt" = now() - interval '25 hours';`
   → retake appears; fail again → "not eligible this batch"; no third attempt.
6. Timer enforcement: start an attempt, then
   `UPDATE "ProgramEntryAttempt" SET "startedAt" = now() - interval '26 minutes' WHERE "submittedAt" IS NULL;`
   → submit → graded as-is, no extension.

## Phase 4 — Daily missions (the core, 1–2 h)
As Arjun on `/program/day/1` (check `days.json` for each day's type):
1. **CODE_SPRINT**: Run visible checks (local, fast). Submit with the starter's bug →
   staggered check lines, one **red with detail**. Fix code → submit → all green →
   confetti + "Day 1 cleared — Day 2 unlocked" + **+12 pts** on dashboard/leaderboard.
   Passing on run #2 must NOT increment `cleanPassCount`; pass day 2 first-try and
   confirm it DOES.
2. **Leak check**: DevTools → Network → inspect every response on a day page and
   submit: `missionSpec`, `expected`, `answers`, `evalCases` must appear NOWHERE.
3. **URL tampering**: visit `/program/day/20` while locked → redirect to curriculum.
4. **DATA_ROOM** day: correct answer with different case / within tolerance → passes;
   outside tolerance → named check fails.
5. **SHIP_IT** day: without the required file in your repo → red check names the
   missing path; push the file → green. (Needs `GITHUB_API_TOKEN`.)
6. **PROMPT_FORGE** (M3): fast-forward
   `UPDATE "ProgramMember" SET "highestUnlockedDay" = 15 WHERE ...;`
   Weak prompt → eval cases fail with details; strong prompt → green. Submit twice
   within 15 s → rate-limit message. (Needs `ANTHROPIC_API_KEY`.)
7. **BOSS_BUILD** day 7: submit repo + writeup → single check passes, day clears,
   `ProgramProject` row `SUBMITTED` (grading is Phase 6).
8. **Skip token**: on a fresh day, submit 3 failing runs → skip offer appears (not
   before). Use it → day SKIPPED, 0 pts, next day unlocked, irreversible-warning modal
   shown. Second token works; third refused.
9. **Concept check**: one attempt only; +0–3 pts; explanations shown after; works on a
   SKIPPED day; refuses a second attempt.
10. **Freeze**: `UPDATE "ProgramCohort" SET "endsAt" = now() - interval '1 day';` →
    every mission run / concept check / project submit rejected server-side. Restore
    afterwards.
11. **Arena** (`/program/arena`): complete an exercise → badge, **no score change**.
12. Leaderboard sort + totals match dashboard breakdown exactly.

## Phase 5 — Commits cron (20 min)
1. Push a commit to the member's registered repo (authored by the registered username).
2. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/program-commits`
   → `{ ok: true, ... processed }`. Heatmap cell fills; +5 commitPoints.
3. Run the SAME curl again → commitPoints unchanged (idempotent).
4. Curl WITHOUT the header → 401/403, nothing processed.

## Phase 6 — AI layer (30 min, needs `ANTHROPIC_API_KEY`)
1. `/admin/program/projects` → "Grade with AI" on the day-7 project → score /100 +
   criteria + feedback; member `projectPoints` up; leaderboard moves.
2. Re-grade the same project → identical totals. Override to 85 + reason → effective
   score changes, `AdminAction` row exists.
3. AI Mentor: as the member, on a PASSED mission → "Get AI Mentor review" →
   strengths/improvements card; second request → "already reviewed" with stored note.
4. Generate recommendations (admin) → 2–3 sentence recs on member dashboards;
   immediate re-run → all skipped (7-day rule).
5. Failure path: set a wrong API key, restart → grade/mentor/recs return error toasts,
   no crashes, project stays SUBMITTED. Restore key.

## Phase 7 — Voice interview (45 min, needs `OPENAI_API_KEY`, laptop + mic)
1. Below day 30 → `/program/interview` shows locked card with the unlock condition.
2. Fast-forward: `UPDATE "ProgramMember" SET "highestUnlockedDay" = 30 ...;` and pass
   day 30 (or set cohort `endsAt` in the past) → "ready" state, mic check.
3. Full interview: AI greets within ~2 s, responds to your voice, follows the
   structure, 15:00 countdown visible. End after ≥3 min → "evaluating…" → 4 scores +
   summary on the page. Confirm the interview score appears NOWHERE in
   totalScore/leaderboard.
4. `/admin/program/interviews`: transcript visible; re-evaluate works; reset →
   member can retake; a completed member cannot start a second interview themselves.
5. Kill network mid-interview → partial transcript salvaged (≥3 min) or restart
   offered (max once).
6. Direct `POST /api/program/interview/session` logged out / ineligible → rejected.

## Phase 8 — Recruiter portal (45 min)
1. Fresh dev user (`dhruv@`) → `/talent/register` → form → `/talent/pending`.
2. A user WITH a StudentProfile tries `/talent/register` → clear rejection message.
3. Admin `/admin/program/recruiters` → approve → email sent (check Brevo/FROM_EMAIL —
   on local this SENDS REAL EMAIL if configured; use a test address) → AdminAction row.
4. `/talent` as approved recruiter → "results not published yet".
5. Admin → Publish results (confirm dialog) → pool renders ranked members: filters
   (search/skills/min score) work; clean-pass % shown.
6. Member profile: mission portfolio (types, verdicts, runs used), projects + AI
   feedback, interview summary, AI rec, email/LinkedIn/GitHub/resume present —
   **inspect DOM: `phone` value absent anywhere**; no entry-attempt details.
7. Shortlist + note persist; a second recruiter account cannot see the first's
   shortlist. Unapproved recruiter calling talent actions directly → rejected.

## Phase 9 — Admin ops & analytics (30 min)
- Promote `vikram@` from waitlist → refused while capacity full; drop a member → he
  vanishes from leaderboard + pool; promote now succeeds. Each op → AdminAction row.
- Unlock day + grant-skip-token actions work and are audited.
- Overview analytics render with your handful of members (score histogram, module
  progress, engagement line, mission funnel, at-risk list showing the stuck/behind
  members you created).
- CSV exports download with sensible columns. Content viewer shows 30 days.

## Phase 10 — Cross-cutting
- Mobile 390 px: landing, apply, assessment, day page (panes stack, Python size
  warning), dashboard, talent pool.
- Light AND dark theme on every new surface.
- `npm run build` completes clean (remember: runs `prisma migrate deploy`, currently a
  no-op).
- Vercel (after push): program env vars added in dashboard settings, cron shows as
  registered, voice interview works over HTTPS, Google OAuth (not dev auth) covers
  apply→enroll and recruiter registration.

## Phase 11 — Cleanup
- Archive the test cohort; delete test `ProgramMember` rows (cascades cover
  submissions/commits/projects/interview) and test `RecruiterProfile` rows.
- ⚠️ `npm run db:cleanup:test` predates the program tables — deleting the `@abtalks.dev`
  Users cascades through program rows too (FK onDelete: Cascade), which is acceptable,
  but the script's counts won't mention them. Extending cleanup.ts is a follow-up task.
- Reset any DB values you fast-forwarded (endsAt, highestUnlockedDay) if keeping the cohort.

## Bug triage rule
When something fails: capture URL + action + exact error (browser console + terminal),
check the matching plan's §6 guardrails first (most likely miss), fix via Cursor with a
small scoped prompt, re-run ONLY the failed phase step, then continue.
