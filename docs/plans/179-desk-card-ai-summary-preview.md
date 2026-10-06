# 179 — Desk card AI Summary = sidebar preview (3 lines)

## 1. Goal

Scout result cards show the same recruiter-facing AI summary as View Details
(sidebar), clamped to three lines. Full text stays in the inspector. No Gemini
calls from the results list.

## 2. Current behavior

- Card: templated `candidateSummaryLine` + 2-line CSS clamp.
- Sidebar: Gemini via `/api/hire/candidate-summary`, else `recruiterSummary`.

## 3. Files to touch

| File | | Note |
|---|---|---|
| `docs/plans/179-desk-card-ai-summary-preview.md` | `[new]` | This plan |
| `src/components/hire/desk-match-card.tsx` | `[edit]` | Cached Gemini or `recruiterSummary`; preview ~280 chars |
| `src/components/hire/match-results.tsx` | `[edit]` | Pass `searchSpec` into desk cards |
| `src/components/hire/scout-chat.tsx` | `[edit]` | Wire active `spec` as `searchSpec` |
| `src/app/hire/hire-scout.css` | `[edit]` | `.desk-card__ai-text` line-clamp 3 |
| `docs/CHANGELOG.md` | `[edit]` | One Pending reconcile line |

## 4. Guardrails (DO NOT)

- DO NOT call `/api/hire/candidate-summary` from the results list.
- DO NOT put raw `match.rationale` on the card without `recruiterSummary`.
- DO NOT widen unlock or contact fields in the summary.
- DO NOT edit notification-locked paths.

## 5. Commit message

`fix(hire): show sidebar-style AI summary preview on desk cards (3 lines)`
