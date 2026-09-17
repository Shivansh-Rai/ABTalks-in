# 150 — Admin candidate Profile/Diagnosis toggle and actions menu

**Workstream:** A2 Admin Entity Operations
**Persona:** ABTalks Platform Admin
**Owner:** Sohail (admin surface). UI/UX: Shallika. User assigned this work.
**Depends on:** T-264 candidate detail, T-265 discoverability panel

---

## 1. Goal

On `/admin/students/[id]`, switch Profile vs Diagnosis with a segmented control beside the avatar (default Profile). Collapse every admin op into a top-right **Perform admin action** dropdown that confirms with **Are you sure you want to perform this {action name}?** without weakening T-272 reason or T-217 type-`delete`.

## 2. Current behavior

The page stacks the discoverability panel and career sections. Header dumps Reset / Ready / Grant / Remove / Delete / Disable / Restore / Secure as buttons.

## 3. Files to touch

| Path | Kind | Purpose |
| --- | --- | --- |
| `src/components/admin/candidate-detail-view-switch.tsx` | **new** | Client Profile/Diagnosis switch |
| `src/components/admin/candidate-admin-actions-menu.tsx` | **new** | Dropdown + confirm dialogs |
| `src/app/admin/students/[id]/page.tsx` | **edit** | Compose switch + menu |
| `src/features/admin/admin-candidate-detail.test.ts` | **edit** | Assert labels |
| `docs/CHANGELOG.md` | **edit** | One Pending reconcile line |

No new server actions.

## 4. Server vs Client

- Page, career sections, discoverability panel: Server
- View switch and actions menu: Client; RSC children passed as props

## 5. Guardrails

- Reuse existing actions
- Do not weaken disable/secure reason ≥ 8 or delete type-`delete`
- Do not refetch the page on toggle
- Do not edit `CLAUDE.md` or `docs/project-context.md`

## 6. Verification

- Desktop and 375px: toggle beside avatar; dropdown top-right
- Default Profile; Diagnosis shows only discoverability
- Each menu item confirms with the action name
- `npm run test:admin-candidate-detail` and `npx tsc --noEmit`
