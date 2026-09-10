# 123 — PLAN B: entity-generic audit log

**Status: DRAFT FOR REVIEW. Not signed, not approved, not started.**
Branch `feat/talent-request-persistence` @ `58d26b63`. Investigation only — no code, no
schema, no migration, no production write.

**Acceptance bar: all 29 existing `AdminAction` writers keep working unchanged.** §3 names
every one of them. The count was obtained by search, not assumed:

```
grep -rn "adminAction.create|createMany|upsert" src/ prisma/ scripts/   →  29
grep -rn "logAdminAction|recordAdminAction|writeAdminAction" src/       →   0
```

There is no helper. Every writer calls Prisma directly, which is exactly why the schema
must stay backward compatible.

---

## 1. Current state

### 1.1 The model — [schema.prisma:644](../../prisma/schema.prisma#L644)

```prisma
model AdminAction {
  id           String   @id @default(cuid())
  adminUserId  String
  targetUserId String                      // ← REQUIRED, FK to User
  actionType   String                      // ← free string, no enum
  metadata     Json?
  reason       String?
  createdAt    DateTime @default(now())
  admin        User     @relation("AdminActor",  fields: [adminUserId],  references: [id], onDelete: Cascade)
  target       User     @relation("AdminTarget", fields: [targetUserId], references: [id], onDelete: Cascade)

  @@index([targetUserId])
  @@index([createdAt])
}
```

**There is no `entityType`, no `entityId`, no previous-state and no new-state field.**

### 1.2 Production data, read-only

```
AdminAction rows                 281
  with metadata                   55
  with reason                     171
  self-targeted (admin == target)  25
distinct actionType values        15
```

Two facts that constrain the design:

1. **`actionType` is an open set.** Production contains `MARK_DAY_COMPLETE` (1 row), which
   **no current writer emits** — a retired action whose rows remain. Any move to a Prisma
   `enum` would make 281 historical rows unreadable. `actionType` stays `String`.
2. **25 rows are self-targeted**, the fingerprint of the workaround below.

### 1.3 The actual problem, in the code's own words

[admin-notification-actions.ts:88](../../src/app/actions/admin-notification-actions.ts#L88):

> ```
> // AdminAction.targetUserId is required and FK-constrained; a broadcast
> // has no target student, so the acting admin stands in as the target.
> targetUserId: admin.userId!,
> ```

**Nine of the 29 writers record an action on something that is not a user, and put the
admin's own id in `targetUserId` to satisfy the FK.** The real entity id is buried in
`metadata` (`notificationId`, `cohortId`, …) where nothing can index or join it.

| Self-targeting writer | Real entity |
|---|---|
| `createNotification` | Notification |
| `deactivateNotification` | Notification |
| `deleteNotification` | Notification |
| `UPDATE_HACKATHON_PROBLEM` | Hackathon problem statement |
| `PROGRAM_CREATE_COHORT` | ProgramCohort |
| `PROGRAM_UPDATE_COHORT` | ProgramCohort |
| `PROGRAM_REGENERATE_JOIN_CODE` | ProgramCohort |
| `PROGRAM_SET_COHORT_STATUS` | ProgramCohort |
| `PROGRAM_PUBLISH_RESULTS` | ProgramCohort |

### 1.4 Previous / new state

**One writer already does it, ad hoc, in `metadata`:**
[admin.ts:297](../../src/features/program/admin.ts#L297) `PROGRAM_SET_COHORT_STATUS` writes
`{ cohortId, from: cohort.status, to: status }`. `TOGGLE_READY_FOR_INTERVIEW` writes
`{ newValue }` with no previous value.

**No other writer records a previous state, and the schema has nowhere to put one.**

### 1.5 Readers, retention, tests

| | |
|---|---|
| Consumers | admin surfaces read `AdminAction` for the audit trail; `@@index([targetUserId])` and `@@index([createdAt])` are the only access paths |
| Retention / cleanup | **none found** — no TTL, no cleanup job, no archival. 281 rows and growing |
| Tests | **none found** — no test file references `AdminAction` |

---

## 2. Proposed design — extend, do not replace

**A parallel audit system is not proposed.** The existing model can carry every requirement
with additive, nullable columns. Nothing is renamed, retyped or dropped.

```prisma
model AdminAction {
  id             String   @id @default(cuid())
  adminUserId    String
  targetUserId   String?                    // ← becomes NULLABLE (was required)
  /// What kind of thing this action was performed on: "User", "ProgramCohort",
  /// "Notification", "HackathonProblem". A plain string, deliberately not an enum —
  /// actionType already proves retired values outlive their writers.
  entityType     String?
  /// The id of that thing. No FK: an audit row must survive its subject's deletion,
  /// which is the whole point of an audit row.
  entityId       String?
  /// State before and after, for the actions where "what changed" is the record.
  previousState  Json?
  newState       Json?
  /// The organisation the action belongs to, where one applies.
  organizationId String?
  actionType     String
  metadata       Json?
  reason         String?
  createdAt      DateTime @default(now())

  admin  User @relation("AdminActor",  fields: [adminUserId],  references: [id], onDelete: Cascade)
  target User? @relation("AdminTarget", fields: [targetUserId], references: [id], onDelete: SetNull)

  @@index([targetUserId])
  @@index([createdAt])
  @@index([entityType, entityId, createdAt(sort: Desc)])
  @@index([organizationId, createdAt(sort: Desc)])
}
```

### Why each choice

| Field | Choice | Reason |
|---|---|---|
| `targetUserId` | required → **nullable** | This is what removes the self-target lie. All 29 writers still pass it, so none breaks; new writers may omit it. |
| `target` relation | `Cascade` → **`SetNull`** | Deleting a user currently **deletes their audit history**. An audit row that vanishes when its subject is deleted is not an audit row. ⚠️ This is a behaviour change — decision 3. |
| `entityType` / `entityId` | `String?`, **no FK** | An FK cannot point at four different tables, and an audit row must outlive its subject. |
| `previousState` / `newState` | `Json?` | Structured, indexable-by-presence, and lets `PROGRAM_SET_COHORT_STATUS` stop hiding `from`/`to` in `metadata`. |
| `organizationId` | `String?`, no FK | `Organization` exists (4 rows) but nothing in the admin path reads it; nullable keeps every writer valid. |
| `actionType` | **stays `String`** | `MARK_DAY_COMPLETE` proves the set is open. |
| `metadata` | **kept** | 55 production rows depend on it. Nothing is migrated out of it. |

### Backwards compatibility

Every added column is nullable; the one relaxation (`targetUserId` required → nullable)
**cannot break a writer that already supplies it**. All 29 continue to compile and run with
no edit. That is the acceptance bar, and it is met by construction rather than by adapters.

---

## 3. All 29 AdminAction writers

`✅` = works unchanged under the proposed schema. `➕` = works unchanged, and would
*benefit* from the new fields in a later, separate task.

| # | File | Line | actionType | Entity recorded | Fields written | Assumes a user target? | Unchanged? |
|---|---|---|---|---|---|---|---|
| 1 | `app/actions/admin-actions.ts` | 123 | `RESET_PROGRESS` | User | admin, target, reason | yes — correct | ✅ |
| 2 | `app/actions/admin-actions.ts` | 203 | `TOGGLE_READY_FOR_INTERVIEW` | User | + `metadata.newValue`, reason | yes — correct | ➕ has new state, no previous |
| 3 | `app/actions/admin-actions.ts` | 251 | `REMOVE_FROM_CHALLENGE` | User | admin, target, reason | yes — correct | ✅ |
| 4 | `app/actions/admin-actions.ts` | 376 | `REJECT_SUBMISSION` | Submission (via user) | admin, target, reason | yes — indirect | ➕ `entityId` = submission |
| 5 | `app/actions/admin-actions.ts` | 463 | `GRANT_SYNERGY` | User | + `metadata.points`, reason | yes — correct | ✅ |
| 6 | `app/actions/admin-remark-actions.ts` | 56 | `ADD_REMARK` | AdminRemark | + `metadata.remarkId`, reason | yes — the student | ➕ `entityId` = remark |
| 7 | `app/actions/admin-remark-actions.ts` | 97 | `UPDATE_REMARK` | AdminRemark | + `metadata.remarkId`, reason | yes — the student | ➕ previous/new body |
| 8 | `app/actions/admin-remark-actions.ts` | 134 | `DELETE_REMARK` | AdminRemark | + `metadata.remarkId`, reason | yes — the student | ➕ previous body |
| 9 | `app/actions/admin-notification-actions.ts` | 86 | `createNotification` | **Notification** | `metadata.{notificationId,title,audience,category}` | **NO — self-targets** | ➕ removes the workaround |
| 10 | `app/actions/admin-notification-actions.ts` | 130 | `deactivateNotification` | **Notification** | `metadata.{notificationId,title}` | **NO — self-targets** | ➕ |
| 11 | `app/actions/admin-notification-actions.ts` | 171 | `deleteNotification` | **Notification** | `metadata.{notificationId,title}` | **NO — self-targets** | ➕ |
| 12 | `app/actions/recruiter-review-actions.ts` | 162 | `RECRUITER_REVIEW_UPDATED` | RecruiterProfile | admin, target | yes — the recruiter | ➕ previous/new review |
| 13 | `app/actions/recruiter-review-actions.ts` | 212 | `RECRUITER_PROFILE_PUBLISHED` | RecruiterProfile | admin, target | yes | ➕ |
| 14 | `app/actions/recruiter-review-actions.ts` | 247 | `RECRUITER_PROFILE_UNPUBLISHED` | RecruiterProfile | admin, target | yes | ➕ |
| 15 | `app/actions/recruiter-review-actions.ts` | 282 | `RECRUITER_LINK_REGENERATED` | Share token | admin, target | yes | ➕ |
| 16 | `app/actions/admin-hackathon-actions.ts` | 39 | `UPDATE_HACKATHON_PROBLEM` | **Hackathon problem** | `metadata.problemStatementLength` | **NO — self-targets** | ➕ |
| 17 | `app/actions/admin-recruiter-actions.ts` | 73 | `PROGRAM_APPROVE_RECRUITER` | RecruiterProfile | + `metadata.recruiterProfileId` | yes — `profile.user.id` | ➕ |
| 18 | `features/hackathon/remove-participant.ts` | 99 | `REMOVE_HACKATHON_TEAM_MEMBER` | HackathonParticipant | admin, target, reason | yes — the member | ➕ |
| 19 | `features/program/projects.ts` | 319 | `PROGRAM_OVERRIDE_PROJECT_SCORE` | Project score | admin, target, reason | yes — member's user | ➕ previous/new score |
| 20 | `features/program/admin.ts` | 187 | `PROGRAM_UPDATE_COHORT` | **ProgramCohort** | admin, target | **NO — self-targets** | ➕ |
| 21 | `features/program/admin.ts` | 218 | `PROGRAM_CREATE_COHORT` | **ProgramCohort** | `metadata.{cohortId,joinCode,requiresJoinCode}` | **NO — self-targets** | ➕ |
| 22 | `features/program/admin.ts` | 258 | `PROGRAM_REGENERATE_JOIN_CODE` | **ProgramCohort** | admin, target | **NO — self-targets** | ➕ |
| 23 | `features/program/admin.ts` | 297 | `PROGRAM_SET_COHORT_STATUS` | **ProgramCohort** | `metadata.{cohortId, from, to}` | **NO — self-targets** | ➕ **already does previous/new, in metadata** |
| 24 | `features/program/admin.ts` | 327 | `PROGRAM_PUBLISH_RESULTS` | **ProgramCohort** | `metadata.cohortId` | **NO — self-targets** | ➕ |
| 25 | `features/program/admin.ts` | 688 | `PROGRAM_PROMOTE_WAITLIST` | ProgramMember | `metadata.memberId` | yes — `member.userId` | ➕ |
| 26 | `features/program/admin.ts` | 726 | `PROGRAM_DROP_MEMBER` | ProgramMember | `metadata.memberId`, reason | yes — `member.userId` | ➕ |
| 27 | `features/program/admin.ts` | 769 | `PROGRAM_UNLOCK_DAY` | ProgramDay | admin, target, reason | yes — `member.userId` | ➕ |
| 28 | `features/program/admin.ts` | 807 | `PROGRAM_GRANT_SKIP_TOKEN` | ProgramMember | `metadata.memberId`, reason | yes — `member.userId` | ➕ |
| 29 | `features/program/admin.ts` | 880 | `PROGRAM_REGENERATE_RECOMMENDATION` | ProgramMember | `metadata.memberId` | yes — `member.userId` | ➕ |

**29 of 29 work unchanged. 0 require an adapter. 9 stop lying about their target once they
adopt the new fields — which is a separate, optional follow-up per writer.**

---

## 4. Migration and backfill

### 4.1 Schema migration

Additive plus one relaxation. `NOT NULL` → `NULL` never fails on existing data:

```sql
ALTER TABLE "AdminAction"
  ADD COLUMN "entityType"     TEXT,
  ADD COLUMN "entityId"       TEXT,
  ADD COLUMN "previousState"  JSONB,
  ADD COLUMN "newState"       JSONB,
  ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AdminAction" ALTER COLUMN "targetUserId" DROP NOT NULL;
-- FK behaviour change (decision 3): CASCADE → SET NULL
ALTER TABLE "AdminAction" DROP CONSTRAINT "AdminAction_targetUserId_fkey";
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"(id) ON DELETE SET NULL;
CREATE INDEX "AdminAction_entityType_entityId_createdAt_idx"
  ON "AdminAction"("entityType","entityId","createdAt" DESC);
CREATE INDEX "AdminAction_organizationId_createdAt_idx"
  ON "AdminAction"("organizationId","createdAt" DESC);
```

**Nothing here can fail on the 281 existing rows.** No unique constraint is added, so unlike
PR #254 there is no duplicate-data pre-flight to run.

### 4.2 Backfill — optional, and deliberately partial

`entityType`/`entityId` can be derived only where `metadata` carries the id. Of 281 rows,
55 have metadata:

```sql
UPDATE "AdminAction" SET "entityType"='Notification', "entityId"=metadata->>'notificationId'
  WHERE metadata ? 'notificationId';
UPDATE "AdminAction" SET "entityType"='ProgramCohort', "entityId"=metadata->>'cohortId'
  WHERE metadata ? 'cohortId';
UPDATE "AdminAction" SET "entityType"='ProgramMember', "entityId"=metadata->>'memberId'
  WHERE metadata ? 'memberId';
UPDATE "AdminAction" SET "entityType"='AdminRemark', "entityId"=metadata->>'remarkId'
  WHERE metadata ? 'remarkId';
UPDATE "AdminAction" SET "entityType"='User', "entityId"="targetUserId"
  WHERE "entityType" IS NULL AND "adminUserId" <> "targetUserId";
```

Rows that fit no rule keep `entityType = NULL`. **A null here means "not known", and that is
the honest value** — it must not be guessed. `metadata` is never deleted, so backfill is
re-derivable if a rule is later found to be wrong.

Idempotent: every statement is keyed on the metadata shape and re-running changes nothing.

### 4.3 Before / after counts

```sql
-- before
SELECT COUNT(*) FROM "AdminAction";                                            -- 281 today
SELECT COUNT(*) FROM "AdminAction" WHERE metadata IS NOT NULL;                 --  55
SELECT COUNT(*) FROM "AdminAction" WHERE "adminUserId" = "targetUserId";       --  25
-- after
SELECT COUNT(*) FROM "AdminAction";                                            -- must still be 281
SELECT COUNT(*) FROM "AdminAction" WHERE "entityType" IS NOT NULL;             -- newly classified
SELECT COUNT(*) FROM "AdminAction" WHERE "targetUserId" IS NULL;               -- must be 0 (nothing nulls it)
```

**Invariant: the row count never changes. Backfill only fills columns.**

---

## 5. Rollback

- **Schema:** drop the five columns and the two indexes. Restoring `NOT NULL` on
  `targetUserId` is safe *only while no row has a null* — which the §4.3 check proves. Once
  a new writer omits it, that rollback is closed; **the point of no return is the first
  writer that stops supplying `targetUserId`**, not the migration itself.
- **FK behaviour:** reverting `SET NULL` → `CASCADE` is a one-line constraint swap.
- **Backfill:** reversible by `SET entityType = NULL, entityId = NULL`, because `metadata`
  is never modified.
- **Writers:** unchanged, so there is nothing to roll back in application code.

---

## 6. Security

- `entityId` has **no FK by design**. An audit row must survive its subject's deletion.
- Changing the target relation to `SetNull` is what stops user deletion erasing history —
  today `onDelete: Cascade` means deleting a user **deletes the record of what an admin did
  to them**, which is the opposite of an audit log.
- `organizationId` is the scoping key for a future org-scoped audit reader. **Nothing reads
  `Organization` or `OrganizationMember` in the admin path today** (1 write usage each,
  0 reads), so org isolation on audit is not enforceable until a reader exists.
- No writer change means no new authorization surface in this migration.

---

## 7. Tests and regression protection

There are **no existing tests referencing `AdminAction`**. Proposed:

1. **Compatibility test** — a source scan asserting all 29 call sites still pass
   `adminUserId` + `actionType`, in the style of `visibility.test.ts`.
2. **Writer census test** — assert the count of `adminAction.create` call sites equals the
   number enumerated in §3, so a new writer added without a plan update fails the build.
3. **Backfill idempotency** — run twice on a local DB, assert counts identical.
4. **Deletion survival** — delete a user on a local DB, assert the audit row survives with
   `targetUserId = NULL`.
5. Regression: `test:visibility`, `test:hire-score`, `test:sample`, `test:virtual`,
   `test:match-persistence`, `test:guest-adoption`, `npm run build`.

---

## 8. Explicitly out of scope

- Changing any of the 29 writers. They keep working; adopting the new fields is a
  **separate, per-writer task**.
- Converting `actionType` to an enum. `MARK_DAY_COMPLETE` is the argument against.
- Migrating anything out of `metadata`.
- A retention/cleanup policy — none exists; adding one is its own decision.
- An admin audit-viewer UI.
- Dropping or renaming any column.

---

## 9. Open decisions — Sohail

| # | Decision | Why it matters |
|---|---|---|
| 1 | Make `targetUserId` nullable? | It is what removes the self-target workaround for 9 writers. No writer breaks either way. |
| 2 | `previousState` / `newState` as columns, or keep using `metadata`? | `PROGRAM_SET_COHORT_STATUS` already does `from`/`to` in metadata. Columns make it uniform and queryable; metadata needs no migration. |
| 3 | **Change the target FK from `Cascade` to `SetNull`?** | Today deleting a user deletes their audit trail. Changing it is arguably a compliance fix — and it is a behaviour change on a legal-ish record, so it should be an explicit decision, not a side effect. |
| 4 | Should `organizationId` be added now, with no reader? | Adding it now is free; adding it later means a second migration. |
| 5 | Is a retention policy needed? | 281 rows and no cleanup. Not urgent; should be a conscious "no" rather than an oversight. |

## 10. Dependencies and blockers

- **D-2 is unresolved.** The board gate reads: *"If D-2 is unresolved, no migration merges."*
  This plan contains a migration, so it is gated.
- **A concrete blocker found for D-2, not previously recorded:** production
  `_prisma_migrations` holds **50 migrations, 0 unfinished, 0 with a missing folder, but
  6 with a checksum mismatch** — `20260604043632_add_synergy_and_optional_submission_proofs`,
  `20260604052219_add_synergy_and_optional_proof_urls`,
  `20260604053901_add_jobs_and_applications`, `20260902120000_candidate_resume`,
  `20260902160000_candidate_resume_enrichment`, `20260902190000_candidate_resume_merge_log`.
  `prisma migrate deploy` rejects a migration whose file changed after it was applied, so a
  child-branch rehearsal will hit these six. This is a more precise diagnosis than
  `project-context.md:939`, which attributes the block to the leftover
  `20260813000000_general_interview` folder — that folder **is** present in the repo and
  **does** match, so it is not the blocker.
- `DIRECT_URL` is unreachable and is a different endpoint from `DATABASE_URL`.

## 11. Acceptance criteria

1. All 29 writers compile and run unchanged; the census test proves the count.
2. `AdminAction` row count is identical before and after (281 today).
3. No row has `targetUserId IS NULL` immediately after migration.
4. Backfill is rerun and nothing changes.
5. Deleting a user leaves the audit row present with a null target.
6. Build and the full test list pass.

**This plan is not signed. It requires Sohail's review and the five decisions in §9.**
