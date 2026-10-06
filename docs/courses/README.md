# ABTalks Learn: course system and reusable visuals

This is the guide to how `/learn` courses are built, how the diagrams,
flowcharts and interactive visuals are kept modular, and exactly how to reuse
them in a new module, a new course, or any other page of the app.

First course built on it: **Agentic AI Systems** (`/learn/agentic-ai`).

---

## 1. The idea in one picture

Every visual is split into two things that never mix:

```
  DATA (what to show)                     RENDERER (how to show it)
  src/features/courses/assets/visuals/    src/components/course/visuals/
  ─────────────────────────────────       ─────────────────────────────
  export const RAG_PIPELINE = {           <ArchitectureDiagram />
    kind: "architecture",        ──────▶   draws SVG, handles clicks,
    nodes: [...], edges: [...],            scenarios, keyboard, reset
    scenarios: [...]
  }
```

- A **renderer** knows nothing about agents, RAG or any course. It only knows
  how to draw a *kind* of visual (an architecture graph, a flow, a sequence…).
- A **config** is plain data: labels, positions, steps, explanations. No
  functions, no JSX, no CSS. It can be imported anywhere.
- `visual.tsx` is the single switch that maps `config.kind` to its renderer.

Because of that split, reusing a diagram means importing a constant. Nothing is
copied, redrawn or rebuilt.

---

## 2. Where everything lives

```
src/features/courses/                  ← content (data only, server-safe)
├── types.ts                           ← the contract: Block + every VisualConfig type
├── blocks.ts                          ← builders: h2(), p(), visual(), quiz(), …
├── references.ts                      ← shared citation library (R.react, R.rag, …)
├── registry.ts                        ← list of published courses
├── assets/visuals/                    ← ALL diagram data (the reusable assets)
│   ├── shared.ts                      ← cross-course: agent loop, tool call, RAG, workflow vs agent
│   ├── interactive.ts                 ← course hero orbit + sorting exercises
│   └── m1.ts … m8.ts                  ← every diagram used by each Agentic AI module
└── agentic-ai/                        ← one course
    ├── course.ts                      ← title, outcomes, skills, hero, module order
    └── m1-introduction.ts … m8-capstone.ts   ← prose + references to visuals

src/components/course/                 ← rendering (UI)
├── course.css                         ← scoped styles + design tokens (all under .crs)
├── course-frame.tsx                   ← sidebar, progress, sticky sections
├── course-hero.tsx                    ← green interactive header
├── block-renderer.tsx                 ← turns blocks into markup
├── quiz.tsx, code-block.tsx, module-complete.tsx, inline.tsx, …
└── visuals/                           ← the reusable renderers
    ├── visual.tsx                     ← kind → renderer switch
    ├── architecture-diagram.tsx       ├── flow-stepper.tsx
    ├── sequence-diagram.tsx           ├── comparison.tsx
    ├── decision-tree.tsx              ├── budget-packer.tsx
    ├── resilience-sim.tsx             ├── orbit-loop.tsx
    ├── classify-board.tsx
    ├── use-player.ts, step-controls.tsx   ← shared step/play/reset logic

src/app/learn/                         ← routes: /learn, /learn/[course], /learn/[course]/[module]
scripts/validate-courses.ts            ← content checker (run before every PR)
```

---

## 3. How modularity is guaranteed (not just intended)

| Guarantee | How it is enforced |
|---|---|
| Every config matches its renderer | `types.ts` defines one TypeScript type per kind (`ArchitectureVisual`, `FlowVisual`, …). Asset constants are typed, so a missing field or typo fails `tsc`. |
| Every kind has a renderer | `VisualConfig` is a discriminated union on `kind`; `visual.tsx` switches over it. Adding a kind to the union without a renderer is a visible gap in that one file. |
| Configs are portable | Configs are plain serialisable data (no functions/JSX). They cross the Server → Client boundary and can later move to JSON or a database unchanged. |
| No clashes when a visual is used twice on one page | Renderers keep their own state and generate ids with `useId()` (SVG arrow markers etc.). No global ids, no `document.getElementById` on shared names. |
| No course-specific assumptions in renderers | Renderers only read their config. Course words ("agent", "RAG") appear only in asset files and module prose. |
| Diagrams stay correct as content changes | `npx tsx scripts/validate-courses.ts` checks every course: edges/scenarios reference real nodes, boxes don't overlap or overflow, sequence actors exist, decision trees are connected, compare/classify answers exist, quiz answers are valid and spread across A–D, section ids are unique, no em dashes. Exits non-zero on any problem. |
| Consistent look everywhere | All styles are scoped under `.crs` in `course.css` using tokens (`--c-pri`, `--c-tint`, …) and the hub's clay button treatment. |
| Accessible by default | Nodes are keyboard-focusable buttons, every stepped visual has Back/Next/Reset, live regions announce changes, autoplay is disabled under `prefers-reduced-motion`. |

---

## 4. The visual catalogue

Each entry: what it is for, the config shape, and an asset that already uses it.

### 4.1 `architecture`: inspectable system / graph diagram
Boxes and arrows on an SVG canvas. Click a box to read its role; pick a
scenario to trace a request, failure or handoff step by step.
Use for: system architectures, pipelines, multi-agent topologies, trust
boundaries, failure propagation.

```ts
{
  kind: "architecture",
  width: 780, height: 330,                 // canvas units, not pixels (it scales)
  nodes: [
    { id: "api", label: "API", sub: "auth, quota", x: 20, y: 40, w: 140, h: 48,
      tone: "primary", detail: "Shown when the box is clicked." },
    { id: "rt", label: "Runtime", x: 180, y: 10, w: 400, h: 300, group: true },   // dashed container
  ],
  edges: [{ from: "api", to: "db", label: "query", dashed: false, elbow: "hv" }],
  scenarios: [{ name: "Happy path", steps: [
    { nodes: ["api", "db"], edges: [["api", "db"]], text: "What happens now.", tone: "success" },
  ]}],
}
```
Tones: `primary | neutral | accent | danger | success | muted`.
Examples: `RAG_PIPELINE` (shared.ts), `M8_PREPPILOT_END_TO_END_ARCHITECTURE` (m8.ts).

### 4.2 `flow`: step-by-step process with optional live state
Clickable steps with Start/Next/Autoplay; each step can carry a key/value
snapshot, and changed values are highlighted. Optional loop-back note.
Use for: loops, pipelines, recovery ladders, state machines, run traces.
```ts
{ kind: "flow", loop: { label: "…" }, stateTitle: "Breaker",
  steps: [{ label: "Closed", detail: "…", tone: "success", state: { state: "CLOSED" } }] }
```
Examples: `AGENT_LOOP` (shared.ts), `M7_CIRCUIT_BREAKER_STATES` (m7.ts).

### 4.3 `sequence`: message sequence diagram
Actors across the top, messages revealed one by one; multiple scenarios share
the same actors (e.g. happy path vs failure).
```ts
{ kind: "sequence", actors: [{ id: "user", label: "User" }],
  scenarios: [{ name: "Happy path", messages: [
    { from: "user", to: "rt", label: "request", note: "why it matters", style: "call" } ]}] }
```
Styles: `call | return | error | self`. Example: `TOOL_CALL_SEQUENCE` (shared.ts).

### 4.4 `compare`: side-by-side options with "pick a situation"
```ts
{ kind: "compare", options: [{ id: "wf", label: "Workflow", summary: "…" }],
  dimensions: [{ label: "Cost", values: { wf: "Low", agent: "Variable" } }],
  situations: [{ label: "Nightly export", best: "wf", why: "…" }] }
```
Example: `WORKFLOW_VS_AGENT` (shared.ts).

### 4.5 `decision`: decision tree
One question at a time, answer trail visible, Back / Start over.
```ts
{ kind: "decision", start: "q1", nodes: {
  q1: { question: "Is it reversible?", options: [{ label: "Yes", next: "o1" }] },
  o1: { outcome: "Automatic", text: "…", tone: "success" } } }
```
Example: `M7_WHICH_APPROVAL_TIER` (m7.ts).

### 4.6 `budget`: capacity simulator
A slider budget and items with cost and priority; required items always fit,
the rest pack by priority, squeezed items are called out.
Use for: context windows, time budgets, cost budgets.
```ts
{ kind: "budget", unit: "tokens", min: 2000, max: 32000, initial: 16000,
  items: [{ label: "Instructions", cost: 1200, priority: 10, required: true, note: "…" }] }
```
Example: `M2_CONTEXT_BUDGET_PACKER` (m2.ts).

### 4.7 `resilience`: retry / timeout / circuit breaker / fallback lab
```ts
{ kind: "resilience", dependency: "pricing-api", failureRate: 0.3 }
```
Example: `M7_RESILIENCE_LAB` (m7.ts). Reusable for System Design / Backend courses as-is.

### 4.8 `orbit`: cycle around a central actor (also the course hero)
```ts
{ kind: "orbit", center: "Agent", nodes: [{ label: "Plan", detail: "…" }] }
```
Example: `AGENTIC_HERO_ORBIT` (interactive.ts). Also used as `course.hero`.

### 4.9 `classify`: sorting exercise
Learner assigns each item to a bucket, gets instant feedback and the reason.
```ts
{ kind: "classify", buckets: [{ id: "code", label: "Plain code" }],
  items: [{ text: "…", bucket: "code", why: "…" }] }
```
Examples: `M1_CODE_WORKFLOW_OR_AGENT` … `M7_APPROVAL_TIER` (interactive.ts).

To see every available asset, open `src/features/courses/assets/visuals/` —
each export is named `<MODULE>_<TITLE>` and has a one-line comment with the
title it was shown under.

---

## 5. How to reuse a visual

### 5.1 In a module of any course (most common)
```ts
// src/features/courses/system-design/m3-caching.ts
import { visual } from "../blocks";
import { M7_RESILIENCE_LAB } from "../assets/visuals/m7";
import { TOOL_CALL_SEQUENCE } from "../assets/visuals/shared";

blocks: [
  visual(
    "Resilience lab",                                   // title
    "Toggle defences, then send 20 requests.",          // what the learner can do
    M7_RESILIENCE_LAB,                                  // the reusable asset
    "Timeouts matter most when a dependency hangs.",   // what to take away
  ),
]
```
Title, instructions and caption belong to the *module*, so the same asset can
be framed differently in each course.

### 5.2 A variation without editing the original
Spread and override. The original asset is untouched:
```ts
import { M7_RESILIENCE_LAB } from "../assets/visuals/m7";
visual("Payment gateway lab", "…", { ...M7_RESILIENCE_LAB, dependency: "payments-api", failureRate: 0.1 }, "…");
```

### 5.3 On any page outside /learn
Visuals depend on the scoped stylesheet and the `.crs` wrapper (which provides
the colour tokens):
```tsx
import "@/components/course/course.css";
import { Visual } from "@/components/course/visuals/visual";
import { RAG_PIPELINE } from "@/features/courses/assets/visuals/shared";

<div className="crs" style={{ background: "transparent" }}>
  <Visual config={RAG_PIPELINE} />
</div>
```
`Visual` is a client component; the config is plain data, so it can be passed
from a Server Component.

### 5.4 Promote a module-specific asset to shared
If a second course starts using something from `m4.ts`, move the constant to
`shared.ts` (rename without the `M4_` prefix) and update the imports. Nothing
else changes.

---

## 6. How to add a new course

1. Create `src/features/courses/<slug>/` with `course.ts` and one file per module
   (copy the shape of `agentic-ai/`).
2. Write modules with the builders in `blocks.ts`:
   `h2(id, text)`, `p()`, `ul()`, `ol()`, `note()/tip()/warn()/example()`,
   `table()`, `code(lang, label, src)`, `pseudo(src)`, `visual()`, `quiz()`,
   `exercise()`, `takeaways()`, `refs()`.
   Inline text supports `**bold**`, `*italic*`, `` `code` `` and `[link](url)`.
3. Put new diagrams in `assets/visuals/<course-or-module>.ts`, never inline.
4. Add citations to `references.ts` (real sources only).
5. Register the course: one line in `registry.ts`. The dashboard tile, `/learn`
   listing, routes and static params pick it up automatically.
6. Run the checks (section 8).

Section numbers (1.1, 1.2…) are generated from `h2` order; never type numbers
into headings. Quiz answers are automatically spread across A–D; write the
correct option wherever it reads naturally and set `answer` to its index.

---

## 7. How to add a new kind of visual

Only when no existing kind can express it.

1. **Type**: add `XyzVisual` to `types.ts` and to the `VisualConfig` union.
2. **Renderer**: `src/components/course/visuals/xyz.tsx`, `"use client"`,
   props `{ config: XyzVisual }`. Rules:
   - state local to the component; `useId()` for any DOM ids;
   - no course-specific words or data inside the component;
   - keyboard reachable, visible focus, a Reset, `aria-live` for changing text;
   - reuse `useStepPlayer` + `StepControls` if it is stepped (gives reduced-motion support);
   - style with classes in `course.css` using the `--c-*` tokens.
3. **Switch**: add the `case` in `visuals/visual.tsx`.
4. **Checker**: add structural checks for the new kind to `scripts/validate-courses.ts`.
5. **First asset**: add a config in `assets/visuals/` and use it in a module.
6. Document it in section 4 of this guide.

---

## 8. Checks before every PR

```bash
npx tsx scripts/validate-courses.ts
npx tsc --noEmit
npx eslint src/features/courses src/components/course src/app/learn
```
Then open the module in the browser and click through every new visual:
Start/Next/Reset, every scenario, and a 375px-wide window.

---

## 9. Honest limitations

- **Coordinates are hand-placed.** Architecture diagrams use explicit `x/y`.
  The checker catches overlaps and out-of-bounds boxes but not every arrow
  crossing a box; eyeball new diagrams.
- **Visuals are generated SVG, not image files.** That is what makes them
  interactive and themeable, but there are no `.png/.svg` files to drop into
  slides. If a static export is needed, screenshot the rendered diagram.
- **Assets are TypeScript, not JSON/CMS.** Editing requires a code change and
  PR. Because configs are plain data, moving them to JSON or a database later
  is mechanical.
- **Progress is per browser** (localStorage), and the "skills" on a course are
  displayed, not yet written to the candidate profile.
- Wide diagrams scroll sideways on phones (with a hint) rather than reflowing.
