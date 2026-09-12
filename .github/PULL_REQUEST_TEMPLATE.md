## Summary

<!-- 1–3 sentences: what changed and why. -->

## Governance

Every PR fills this section. Auto-labels (`module:*` / `primary:*`) come from changed files; this block is the human declaration. If they disagree, fix the map in `scripts/pr-module-labels.mjs` or split the PR.

### Domain / module

Tick **every** module this PR belongs to. The **first ticked box** is the intended primary domain.

- [ ] `search` — Candidate search and ranking
- [ ] `profile` — Candidate profile, skills, resume, preferences
- [ ] `assessments` — Candidate-side assessments
- [ ] `evidence` — Skill evidence
- [ ] `credits` — Credits, ledger, contact unlock, plans
- [ ] `outreach` — Recruiter outreach and hire messages
- [ ] `mock-interviews` — Mock interviews
- [ ] `recruiter-onboarding` — Recruiter registration, profile, company identity
- [ ] `talent` — Talent projects and talent pool
- [ ] `pipeline` — Shortlist, reject, review panel, hiring pipeline
- [ ] `recruiter-assessments` — Recruiter assessment builder, assign, results
- [ ] `recruiter-analytics` — Recruiter demand / hire analytics
- [ ] `jobs` — Jobs and applications
- [ ] `notifications` — In-app notifications and delivery
- [ ] `analytics` — Product analytics events and UTM
- [ ] `auth` — Authentication and recruiter work-email gate
- [ ] `admin` — Platform admin
- [ ] `security` — Isolation, rate limits, audit
- [ ] `config` — Platform configuration and feature flags
- [ ] `infra` — CI, tooling, shared infrastructure
- [ ] `database` — Prisma schema, migrations, repositories/legacy
- [ ] `ui` — Design system, shared UI primitives
- [ ] `challenge` — 60-day challenge, quiz, enrollment
- [ ] `program` — AI cohort / Databricks / DS Architect / Power BI
- [ ] `hackathon` — Hackathon
- [ ] `workshop` — Workshop and cohort-application funnels
- [ ] `marketplace` — Marketplace
- [ ] `dashboard` — Candidate dashboard hub
- [ ] `synergy` — Synergy points
- [ ] `certificate` — Certificates
- [ ] `legal` — Legal, privacy, cookies, DSAR
- [ ] `landing` — Marketing / landing / explore
- [ ] `docs` — Docs, plans, changelog, Cursor rules

**Primary owner of that domain:**

- [ ] Sohail
- [ ] Shivansh
- [ ] Zainab
- [ ] Shashank
- [ ] Manuvrtti
- [ ] Shallika

**My role:**

- [ ] Primary owner
- [ ] Contributor (owner named above still owns the module)

### Cross-domain and shared files

- [ ] This PR stays inside one domain
- [ ] This PR crosses domain boundaries (list owners and files below)

Cross-domain files / why:

<!-- Required if the second box is ticked. -->

Shared / platform files touched (auth, middleware, admin-auth, recruiter isolation, schema, hire-actions, hire-chrome, hire-scout.css, rate-limit, email, CLAUDE.md, package.json, .github):

- [ ] None
- [ ] Yes — paths:

### Sohail review

Required when the PR touches authentication, authorization, recruiter isolation, schema/database conventions, middleware, rate limits, platform config, or cross-domain contracts.

- [ ] Not required
- [ ] Required — requested from Sohail because:

### UI engineering (if any visual/motion change)

Owning layer: TOKEN / PRIMITIVE / SYSTEM / FEATURE / PAGE

Shared components / tokens changed:

Responsive states verified: desktop / tablet / 375px / reduced-motion

- [ ] N/A (no UI)

### Test evidence

Commands run:

What was **not** tested:

### Self-audit (do not skip)

1. Domain of this change:
2. Owner who should review:
3. Cross-domain? If yes, who approved?
4. Shared/platform files:
5. Sohail review needed?
6. Broader than the task title? If yes, split or explain:
7. Unrelated files in this PR:
8. Test evidence adequate for Demo 1?
9. Does this collide with another developer’s in-flight architecture (hire CSS, schema, assessments, auth)?
10. Greatest regression risk if this merges:

## Test plan

- [ ]
- [ ]
