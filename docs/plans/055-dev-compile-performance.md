# 055 — Fix slow dev compiles (React Compiler in dev + iCloud-synced project dir)

> **STATUS: DONE (Aug 4, 2026).** Both fixes applied and measured.
>
> - Step 1 — `reactCompiler` gated to production in `next.config.ts`. ✅
> - Step 3 — project moved out of iCloud; it now lives at
>   `/Users/shashank/Downloads/ABtalksapp` (not `~/Desktop`). Paths in §2(b)
>   and §5 below describe the **old** location and are kept for history. ✅
>
> Measured after the fix (cold start, no `.next`):
>
> | | Before | After |
> |---|---|---|
> | `✓ Ready` | 27.9 s | **326 ms** |
> | `GET /` | ~2 min | **3.5 s** |
> | `GET /login` | ~2 min | **519 ms** |
> | `GET /dashboard` | ~2 min | **2.2 s** |
>
> Two changes landed alongside this plan but were **not part of it** (both
> uncommitted at time of writing):
>
> - `next.config.ts` — added `turbopack: { root: process.cwd() }`. §5 Step 1 and
>   §6 assumed this block already existed; it did not. It stops Turbopack from
>   picking `/Users/shashank` (stray `package-lock.json`) as the workspace root.
> - `src/auth.config.ts` — added explicit `secret: process.env.AUTH_SECRET` so
>   Edge middleware always receives it. Still edge-clean (no `@/lib/*` imports).

## 1. Goal
Dev server currently takes ~2 minutes to compile each route on first visit,
making local iteration unusable. Gate `reactCompiler` to production builds only
so dev compiles are fast, and move the project out of the iCloud-synced Desktop
folder so file watching and cache writes stop fighting iCloud.

## 2. Current behavior

Measured on this machine (Aug 4, 2026), Next 16.2.4 + Turbopack, Node v22.13.1:

- `✓ Ready in 27.9s` — server boot is fine.
- Static assets are instant: `/favicon.ico` and `/_next/static/*` return
  HTTP 200 in 10–25 ms. The server itself is healthy.
- Any route matched by `middleware.ts` logs `○ Compiling / ...` and takes
  ~2 minutes to produce a page. Every subsequent new route pays it again.

Two independent causes were confirmed, and one already-fixed third:

**(a) `reactCompiler: true` — `next.config.ts:26` (primary)**
React Compiler runs a Babel pass over every component before Turbopack can
serve. Current app size:
- 65 routes, 7 layouts
- 455 `.ts`/`.tsx` files, 61,774 LOC
- **169 `"use client"` components** — every one goes through the compiler
This cost is paid on every cold dev compile and buys nothing during local
development. Production builds compile once, ahead of time, so keeping it on
for `next build` costs nothing at runtime.

**(b) Project lives in iCloud-synced Desktop (secondary)**
`~/Library/Mobile Documents/com~apple~CloudDocs/Desktop` is a symlink to
`/Users/shashank/Desktop`, so `/Users/shashank/Desktop/ABtalksapp` is inside
iCloud's sync scope. iCloud continuously syncs 238 MB of `node_modules` and the
constantly-rewritten `.next` cache. No files were evicted/dataless at time of
diagnosis, so this is not the primary cause — but it adds sustained I/O and
FSEvents contention, and it makes an interrupted build far more likely to leave
a corrupt cache.

**(c) Corrupt Turbopack cache — ALREADY FIXED, no action needed**
Before this plan, requests deadlocked entirely: `○ Compiling middleware ...`
and `○ Compiling / ...` never completed, process sat at 0.0% CPU with RSS
shrinking (80 MB → 41 MB) and all `tokio-runtime-worker` threads parked in
`__psynch_cvwait`. Caused by killing the dev server mid-compile, which left a
corrupt 221 MB `.next` graph. Resolved by `rm -rf .next`. Recorded here only so
the symptom is recognisable if it recurs — the fix is always `rm -rf .next`.

## 3. Files to touch
- `next.config.ts` `[edit]` — gate `reactCompiler` behind `NODE_ENV`.

No other file changes. Item (b) is an environment/filesystem change, not code —
see step 3 below, and it is optional.

## 4. Server vs Client
Not applicable. `next.config.ts` is build configuration — it is neither a Server
nor a Client component, and no Server→Client prop passing is involved. No
component boundaries change. React Compiler output is behaviourally identical
to un-compiled React (it only adds memoization), so gating it in dev does not
change rendering semantics — only dev-build speed.

## 5. Steps

### Step 1 — gate `reactCompiler` to production (`next.config.ts`)
Replace the single line:

```ts
  reactCompiler: true,
```

with:

```ts
  // React Compiler runs a Babel pass over all 169 client components, which
  // costs ~2 min per route on cold dev compiles. Production builds compile
  // once ahead of time, so keep it on there and skip it in dev.
  reactCompiler: process.env.NODE_ENV === "production",
```

Leave everything else in the file exactly as-is — in particular do NOT touch
the existing `turbopack.root` block or `allowedDevOrigins`. Both were verified
working during diagnosis (the Turbopack trace referenced only
`/Users/shashank/Desktop`, confirming the workspace root fix is effective).

### Step 2 — restart dev cleanly
```bash
rm -rf .next
npm run dev
```
`.next` must be removed because it holds compiler-tagged artifacts from the
previous setting.

### Step 3 — (OPTIONAL, do not run unattended) move project out of iCloud
Only if Step 1 does not bring compiles to an acceptable speed. This is a
developer-machine change, not a repo change — confirm with the user first.

```bash
# verify clean/pushed first
git status
mkdir -p ~/dev
mv ~/Desktop/ABtalksapp ~/dev/ABtalksapp
cd ~/dev/ABtalksapp
rm -rf .next
npm run dev
```
`~/dev` is outside iCloud's sync scope. Nothing in the repo references an
absolute path, so no config edits are needed after the move. Reopen the folder
in the editor at its new location.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT change any file other than `next.config.ts`. This plan is one line.
- DO NOT remove or alter the `turbopack: { root: process.cwd() }` block — it
  prevents Turbopack from picking `/Users/shashank` (which has a stray
  `package-lock.json`) as the workspace root.
- DO NOT remove `allowedDevOrigins` / `localNetworkHosts()` — LAN/phone testing
  depends on it.
- DO NOT set `reactCompiler: false` outright. It must stay enabled for
  production builds; only dev is being gated.
- DO NOT touch `middleware.ts` or `src/auth.config.ts`. Both were read during
  diagnosis and are edge-clean (only `next-auth`, `next/server`, `@/auth.config`)
  — they are NOT the cause and must keep their current imports.
- DO NOT add `NODE_ENV` to `.env.local`. Next sets it automatically; setting it
  manually breaks `next dev`.
- DO NOT introduce a new config helper/abstraction file for a one-line ternary.
- DO NOT run `npm install` or delete `node_modules` — the install was verified
  healthy (`swc-darwin-arm64`, `libquery_engine-darwin-arm64`,
  `lightningcss-darwin-arm64` all match this arm64 Mac).

## 7. DB safety
Not applicable — no schema, migration, or data changes.

## 8. Verification
1. `rm -rf .next && npm run dev` → expect `✓ Ready` in roughly the same ~28s
   (boot was never the problem).
2. Open `http://localhost:3000/`. The terminal must show `○ Compiling / ...`
   followed by **`✓ Compiled`**. Target: seconds, not ~2 minutes.
3. Click through to `/login` and `/dashboard`. Each first visit compiles once;
   all should be dramatically faster than the current ~2 min baseline.
4. Confirm React still behaves correctly — no hydration errors in the browser
   console (React Compiler only adds memoization; disabling it in dev must not
   change behaviour).
5. Production parity: `npm run build` must still succeed with React Compiler
   active. Note this runs `prisma migrate deploy` first — only run it when a
   migration against the configured database is acceptable.
6. Exactly one file should differ: `git diff --stat` shows `next.config.ts`
   only, one line changed.

## 9. Commit message
```
perf(dev): gate reactCompiler to production builds

React Compiler ran a Babel pass over all 169 client components on every
cold dev compile, costing ~2 min per route. Production builds compile
ahead of time, so keep it enabled there and skip it in dev.
```
