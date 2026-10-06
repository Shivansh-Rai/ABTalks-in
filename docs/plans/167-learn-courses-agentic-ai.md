# 167 — Learn: modular course system + Agentic AI Systems course

## 1. Goal
Ship a text-first, diagram-rich course reader inside the ABTalks shell (GeeksforGeeks-style,
free, fully open to signed-in candidates), built as a reusable course foundation, with
"Agentic AI Systems" (8 modules) as the first course migrated from the HTML prototype.

## 2. Current behavior
- No course/learn surface exists. Dashboard (`src/app/dashboard/page.tsx`) renders hub
  sections (ContinueJourney, CareerGuidance, OtherChallenges, Roadmaps …).
- The prototype is a single HTML file: global `flow` stepper engine, inline SVGs with shared
  ids, `pick` explainers, per-module quiz data, copy buttons, theme toggle, drawer TOC.

## 3. Files to touch
- `src/features/courses/types.ts` [new] block + visual config types
- `src/features/courses/registry.ts` [new] course lookup
- `src/features/courses/agentic-ai/course.ts` [new] course metadata + module order
- `src/features/courses/agentic-ai/m1..m8-*.ts` [new] module content
- `src/components/course/*` [new] shell, renderer, quiz, code, callout, exercise, css
- `src/components/course/visuals/*` [new] reusable visuals
- `src/app/learn/[course]/page.tsx`, `src/app/learn/[course]/[module]/page.tsx` [new]
- `src/components/dashboard-hub/learn-courses.tsx` [new] dashboard tile
- `src/app/dashboard/page.tsx` [edit] render `<LearnCourses />` after ContinueJourney

## 4. Server vs Client
Pages + `LearnCourses` + `CourseLayout` = Server. `BlockRenderer` = Server that mounts client
islands (visuals, quiz, code copy, progress, theme). Only plain JSON data crosses the
boundary — no functions/icons.

## 5. Steps
Types → visual components → reader components → content → routes → dashboard tile → typecheck.

## 6. Guardrails
- No middleware edits (auth enforced in page via `auth()` + redirect to `/login`).
- No Prisma/schema changes; progress in localStorage (per-viewer convenience).
- No notification paths touched.

## 7. DB safety — N/A

## 8. Verification
`npx tsc --noEmit`, eslint on new files; browse `/dashboard`, `/learn/agentic-ai`,
each module; exercise every visual, quiz, reset, theme, mobile width.

## 9. Commit message
feat(learn): modular course reader + Agentic AI Systems course
