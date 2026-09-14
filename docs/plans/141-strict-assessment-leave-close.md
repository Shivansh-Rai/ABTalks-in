# Plan 141 — Strict assessment leave-close + clipboard toast removal

**Follow-up to:** `docs/plans/140-t219-assessment-integrity-signals.md` (T-219).
**Owner module:** Candidate assessments (Shivansh). Contributor: Sohail workspace.
**User decisions (2026-09-14):** (1) Block leave until Submit; once they leave the attempt is closed — **no continue later**. (2) Screenshots **out of scope**.

---

## 0. Plan 140 verification (do not re-implement 140)

| Check | Result |
|---|---|
| §3 file list + D-1–D-4 + guardrails in code | **PASS** |
| Offline tests / tsc / build (prior session) | **PASS** |
| Migration applied to DB behind local `.env.local` | **FAIL / blocked** — `P2022` `RecruiterAssessment.strictMode` missing; needs Neon **child** + `migrate deploy` (ops) |
| Manual §8 browser evidence | **Not done** (blocked by DB) |
| T-279 privacy copy | Out of 140 scope |

**Verdict:** Plan 140 is **implemented in code**. Local create/`/assessments` failures are **schema-not-migrated**, not missing T-219 features.

---

## 1. Goal

For **strict** attempts only (`rules.strictMode === true` and stage `taking`):

1. Remove the copy/cut/paste **toast**; keep `preventDefault` + event recording.
2. Candidate cannot navigate to `/assessments` (or elsewhere in-app) without **Submit**.
3. Any real leave (tab close, hard navigation, crash recovery reopen) **finalizes** the attempt as `SUBMITTED` — **no resume**. Non-strict (legacy) behaviour unchanged.
4. Do **not** add screenshot blocking or claims.

---

## 2–9

See Cursor plan `strict_leave_close` / implementation in this change set.

### Known limits (not fixed)

- Virtual/black camera still reports “live”
- Spoofed `Sec-CH-UA-Mobile` / DevTools
- Screenshots / OS snip / phone photo
- Context menu / select / Ctrl+P (plan 140 forbids blocking context menu)

### Commit message

```
fix(assessments): strict attempts end on leave; drop clipboard toast (plan 141)

Strict STARTED attempts cannot resume after leave: in-app nav is blocked until
Submit, and pagehide keepalive force-finalizes (incomplete allowed). Clipboard
stays blocked and recorded without a warning toast. Screenshots unchanged.
```
