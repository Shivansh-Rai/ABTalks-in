# 037 — Program day page Figma redesign

## 1. Goal
Rebuild the Program day UI to match the Figma frames (Day 1 / Day 3): dark branded shell, mission/objectives/repo/build-steps/resources/verify sections, for **all 31 days**, using data already in the DB.

## 2. Current behavior
`src/app/program/(app)/day/[day]/page.tsx` is a single-column shell: phase header → full `briefMd` markdown → objectives/tools → videos → `MissionPanel` → `ConceptCheckPanel`.

**Existing data (verified, no new fields):**

| Figma section | Source |
|---|---|
| Phase label | `day.module` |
| Mission title + body | `briefMd` `## Mission: …` + prose until next `###` |
| Objectives + tech chips | `objectives[]`, `tools[]` |
| Your Repo Layout (optional) | `briefMd` `### Your repo layout…` + fenced code |
| Build Steps stepper | `briefMd` `### Build steps` numbered list |
| Reference Resources | `day.videos` + `LiteYoutube` |
| Let’s test your work (DATA_ROOM) | `### Submit your answers` questions in `briefMd` + `MissionPanel` answers |
| What we’ve achieved + Submit (SHIP_IT etc.) | `MissionPanel` + `shipItHints` |
| Concept check → | existing `ConceptCheckPanel` (anchor scroll) |
| Left rail day nav | `getMemberDayStates()` (already used on curriculum) |

Note: only days **1–3** currently have rich structured `briefMd`; days **4–31** are short stubs. Same shell still applies — hide optional sections when the parser finds nothing.

## 3. Files to touch
- `[new] docs/plans/037-program-day-figma-redesign.md` — this plan archived in-repo
- `[new] src/features/program/parse-brief.ts` — pure `parseBriefMd(briefMd)` → structured sections (server-safe, no Prisma)
- `[new] src/components/program/day-shell.tsx` — Client layout chrome (left rail, header CTA, build-steps stepper state)
- `[new] src/components/program/day-build-steps.tsx` — Client horizontal stepper + Next
- `[new] src/components/program/day-section-card.tsx` — shared dark card chrome (Mission / Objectives / Resources / Verify wrappers)
- `[edit] src/app/program/(app)/day/[day]/page.tsx` — compose new layout; load curriculum states; pass parsed brief + existing panels
- `[edit] src/components/program/mission-panel.tsx` — accept optional `dataRoomQuestions: string[]`; restyle to Figma verify card; DATA_ROOM heading “Let’s test your work!”; SHIP_IT heading “What we’ve achieved”; Submit/Verify button styling
- `[edit] src/components/program/concept-check-panel.tsx` — add `id="concept-check"` root; minor dark-card polish so it fits the day shell
- `[edit] src/components/program/lite-youtube.tsx` — optional className prop for resource-card chrome (play badge)
- `[new] public/program/abtalks-mark.png` — logo downloaded from Figma via MCP during implement (node `236:29` / imageRef)

No Prisma schema, seed JSON, middleware, or auth changes.

## 4. Server vs Client
- **Server:** `page.tsx` — auth, `getDayShell`, `getMissionState`, `getConceptCheckStatus`, `getMemberDayStates`, `parseBriefMd`. Pass only serializable props (strings, arrays, day states).
- **Client:** `day-shell.tsx`, `day-build-steps.tsx`, `mission-panel.tsx`, `concept-check-panel.tsx`, `lite-youtube.tsx`.
- Do **not** pass functions/icons/class instances from Server → Client.

## 5. Steps

### 5.1 Brief parser (`parse-brief.ts`)
Pure function returning:

```ts
type ParsedBrief = {
  missionTitle: string | null;   // text after "## Mission:"
  missionBodyMd: string;         // prose before first ### (or full brief fallback)
  repoLayoutMd: string | null;   // ### Your repo layout… block (incl. code fence)
  buildSteps: string[];          // top-level numbered items under ### Build steps
  submitIntroMd: string | null;  // prose under ### Submit your answers before list
  submitQuestions: string[];     // numbered questions under that heading
};
```

Rules:
- If no `## Mission` heading: `missionTitle = null`, `missionBodyMd = full briefMd`.
- Build steps: split on `/^\d+\.\s+/m` inside the Build steps section only (nested bullets stay inside the step string).
- Repo layout / submit sections optional — return `null` / `[]` when absent.
- Unit-free: keep parser small and deterministic; exercise mentally against day 1 and day 3 briefs.

### 5.2 Day page composition
Replace the current vertical stack with:

```
[dark page wrapper bg #030712]
  header: logo | red phase dot + "Phase N: {title}" | "Concept check →" (anchor #concept-check)
  grid: left rail (~320px) | main column
    left: DaySidebar — days in current module (from getMemberDayStates), lock/available/passed/skipped links
    main:
      hero strip — day title + short gradient banner (no per-day art in DB)
      Mission card — parsed title + ReactMarkdown body (highlight **bold** in brand purple)
      row: Repo Layout card (if present) | Objectives card (objectives + colored tool chips)
      Build Steps card (if steps.length) — DayBuildSteps
      Reference Resources (if videos) — 2-col LiteYoutube cards, "Reference Resources" label
      MissionPanel (verify / answers) — Figma bottom card
      ConceptCheckPanel id=concept-check
```

Keep existing program sticky nav in `layout.tsx` unchanged.

### 5.3 Build Steps stepper
Client component props: `steps: string[]`.
- Horizontal step indicators (Step 1…N); active step bold/white, others muted; dashed purple connectors.
- Content panel: render active step via `ReactMarkdown` (supports day-3 code fences). No per-step images in DB — left side of panel is typography/code, not a gray placeholder image.
- **Next →** advances step; on last step label becomes **Done** (scrolls to verify section `#mission-verify` or disables).

### 5.4 MissionPanel restyle (behavior unchanged)
- Wrap root with `id="mission-verify"`.
- New optional prop `dataRoomQuestions?: string[]` — when length matches answer inputs, label each field with the question text; else keep “Answer N”.
- Copy:
  - DATA_ROOM: title “Let’s test your work!” + `submitIntroMd` if provided (new optional `verifyIntro?: string`)
  - SHIP_IT: title “What we’ve achieved” + existing repo/hints UI; primary button “Submit” / “Verify my repo” with Figma purple inset style
- Keep verification, skip-token dialog, confetti, mentor review logic as-is.

### 5.5 Visual tokens (scoped to day shell)
Use Tailwind arbitrary values / local classes on the day wrapper only (do not change global theme):
- Page bg `#030712`; cards `rgba(5,12,33,0.89)` + border `rgba(46,57,75,0.69)` / accent `#8365E3`; titles `#968BEC`; body white; tool chips colored borders matching Figma (Python pink, VS Code orange, etc. — map by simple string hash or fixed map for known tools, default blue).
- Buttons: `#7364E6`, `rounded-[15px]`, inset shadow.
- Preserve light/dark app pages outside `/program/day/*`.

### 5.6 Assets
Download Figma logo image into `public/program/abtalks-mark.png` via Framelink MCP (`download_figma_images`, fileKey `WsqYYevAiHtqH50SOaoPlh`, node `236:29`). Skip decorative ChatGPT collage fills — replace with CSS gradient hero + day-number rail.

## 6. Guardrails for Cursor (DO NOT)
- Do **not** change Prisma schema, migrations, or `prisma/content/program/*.json`.
- Do **not** expose `missionSpec` to the client.
- Do **not** touch `/challenge/[day]` or Claude `DayPage`.
- Do **not** add `@/lib/*` imports to middleware.
- Do **not** invent new abstraction layers beyond the files listed.
- Do **not** replace MissionPanel verification logic — restyle and label only.
- When a build error contradicts this plan, stop and report the error.

## 7. DB safety
None — UI-only. No migration/seed.

## 8. Verification
Manual:
1. `/program/day/1` — Mission, Objectives, Build Steps stepper (many steps), no Repo Layout, Resources (3 videos), Let’s test your work with **real Q1–Q3 labels**, Concept check → scrolls.
2. `/program/day/3` — Mission, Repo Layout card, Objectives + 5 tool chips, Build Steps, Resources (2 videos), What we’ve achieved + Verify.
3. `/program/day/4` (stub) — shell renders; mission body = stub brief; missing sections hidden; MissionPanel still works.
4. Left rail: current module days link correctly; locked days not navigable (or redirect as today).
5. `npx tsc --noEmit` and `npm run build` pass.

Changed files: only those listed in §3.

## 9. Commit message
`restyle program day page to match Figma mission shell`

After architecturally significant UI convention (program day shell layout): append one line under `## Pending reconcile` in `docs/CHANGELOG.md`:
`2026-07-17 [convention] Program day page uses Figma dark shell + briefMd section parser; no schema change`
