# 149 — T-264: Admin candidate detail

**Workstream:** A2 Admin Entity Operations
**Persona:** ABTalks Platform Admin
**Owner:** Shivansh (candidate profile data). Admin surface: Sohail (contributor; user-assigned).
**Demo:** Demo 3
**Depends on:** T-207 (console IA), T-263 (global search hrefs already wired)

---

## 1. Goal

When an admin opens a candidate from Candidates or Global Search, `/admin/students/[id]` shows a complete read-only career record that matches the candidate's own data, plus account state. Existing challenge ops stay.

## 2. Current behavior

`/admin/students/[id]` is the old challenge student page: identity, string skill badges, submissions/quizzes, recruiter-review editor, remarks, disable/restore. It does not call `requireAdmin()` itself. `getStudentDetail` uses identity-only `getCandidateProfile`, 404s `deletedAt`, and early-returns hackathon users without a career profile.

Search and the Candidates list already link to `/admin/students/${id}`.

## 3. Files to touch

| Path | Kind | Purpose |
| --- | --- | --- |
| `src/features/admin/get-admin-candidate-detail.ts` | **new** | Assembler: fan-out existing reads |
| `src/components/admin/candidate-career-sections.tsx` | **new** | Read-only Server Component, T-207 dense console |
| `src/app/admin/students/[id]/page.tsx` | **edit** | `requireAdmin`, header, mount career sections, keep ops |
| `src/features/admin/get-student-detail.ts` | **edit** | Do not 404 on `deletedAt`; expose account timestamps |
| `src/features/admin/admin-candidate-detail.test.ts` | **new** | Source-level acceptance |
| `package.json` | **edit** | `test:admin-candidate-detail` |
| `docs/CHANGELOG.md` | **edit** | One Pending reconcile line |

No changes to search/list hrefs.

## 4. Server vs Client

| Component | Server/Client | Notes |
| --- | --- | --- |
| `page.tsx` | Server | `requireAdmin`, assembler, career sections + existing ops |
| `candidate-career-sections.tsx` | Server | No `"use client"`, no `@/app/actions/*` |
| `StudentActionPanel` / remarks / recruiter review | Client | Unchanged; serializable props only |

## 5. Steps

1. Assembler `getAdminCandidateDetail(userId)` loads User (including soft-deleted), then `Promise.all` of existing reads with the **target** userId.
2. Soft-deleted users render with a Deleted badge instead of `notFound()`. Missing User row still 404s.
3. Career sections: account, profile, skills (Self-declared / Evidence-backed), evidence, applications, assessments (no scores), programmes, notifications.
4. Page keeps challenge tabs / hackathon card / action panel below the career record.
5. Source tests + typecheck.

## 6. Guardrails for Cursor (DO NOT)

- Import `@/lib/*` from `middleware.ts`
- Create a generic entity-detail framework
- Edit Shivansh profile writers, Manuvrtti notification writers, or Zainab mock-interview writers
- Filter contact in the client
- Show assessment `scorePercent` / `passed` (T-273)
- Fake demo data
- Edit `CLAUDE.md` or `docs/project-context.md`
- Reuse `SkillsSection`, `CandidateInspector`, or other client writers

## 7. DB safety

None. No migration, no writes.

## 8. Verification

- Open a candidate from `/admin/search` and from `/admin/students`; same page, all new sections present
- Compare each career section to that candidate's `/profile`, `/jobs?tab=applications`, `/assessments`
- Empty candidate: every section shows an empty state
- Disabled candidate: account state shows Disabled + reason; ops still work
- Non-admin hitting the URL: refused by `requireAdmin`
- Challenge submissions tab still works
- `npm run test:admin-candidate-detail` and `npx tsc --noEmit`

## 9. Commit message

`feat(admin): T-264 complete candidate detail from search and candidates list`
