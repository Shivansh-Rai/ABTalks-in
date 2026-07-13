# 023 — Mobile sidebar + header declutter (phones only)

## 1. Goal
On phones (< `md`, 768px) the app header is overstuffed: logo, challenge
switcher, Admin pill, Synergy chip, theme toggle, and avatar dropdown all
compete for ~375px. Move Admin, Synergy, theme toggle, profile, and logout
into a new right-side slide-in sidebar opened by a hamburger button, so the
mobile header becomes exactly: `[ABTalks logo] [Challenge switcher] [☰]`.
Desktop (`md+`) header stays pixel-identical to today.

## 2. Current behavior
- `src/components/shared/app-header.tsx` (client) renders on all app pages.
  Right cluster: ChallengeSwitcher (when ≥2 enrollments) → Jobs link
  (`hidden md:inline-flex`, already desktop-only) → Admin pill (visible on
  mobile) → `<SynergyChip />` (visible on mobile) → `<ThemeToggle />`
  (visible on mobile, hidden on /marketplace) → divider (`hidden sm:block`)
  → avatar DropdownMenu (visible on mobile; contains Profile + Our Mission
  [both `hidden md:flex`], Report an Issue, Logout).
- On mobile the avatar dropdown is therefore the ONLY place with
  "Report an Issue" and "Logout" — the new sidebar must carry both or they
  become unreachable on phones.
- Logo: `.logo-link` max-width `7.125rem`, collapsed `2.5rem`; `.logo-image`
  height `2rem` (`src/app/globals.css` ~line 267). Same size at all
  breakpoints.
- Drawer precedent: `src/components/admin/admin-mobile-nav.tsx` — useState
  `open`, Escape-key listener, fixed overlay button + fixed panel. Reuse this
  pattern (right side instead of left); do NOT add a sheet primitive or any
  new dependency.
- Synergy points come from `useSynergy()` (`@/components/shared/synergy-provider`);
  the provider already wraps every page that renders AppHeader (SynergyChip
  depends on it today).
- `signOutAction` lives in `src/app/actions/auth-actions.ts` and is already
  imported into this client component via `<form action={signOutAction}>`.

## 3. Files to touch
- `src/components/shared/mobile-sidebar.tsx` **[new]** — client component:
  hamburger trigger (`md:hidden`) + right-side slide-in drawer with profile
  block, Synergy row, Admin Panel, Dark Mode toggle, Profile, Report an
  Issue, and Logout.
- `src/components/shared/app-header.tsx` **[edit]** — hide Admin pill,
  SynergyChip, ThemeToggle, divider, and avatar dropdown below `md`; render
  `<MobileSidebar />` at the end of the right cluster.
- `src/app/globals.css` **[edit]** — mobile-only (−10%) logo sizing via a
  `max-width: 47.9375rem` media query.

Nothing else. No changes to `src/components/ui/*`, `bottom-nav.tsx`,
`theme-toggle.tsx`, `synergy-chip.tsx`, `challenge-switcher.tsx`,
`middleware.ts`, or any server file.

## 4. Server vs Client
- `app-header.tsx` — already `"use client"`; stays client.
- `mobile-sidebar.tsx` — `"use client"` (state, useTheme, useSynergy).
- No Server→Client prop changes: `MobileSidebar` receives only the existing
  plain `user` object (`AppHeaderUser`) and a boolean. No functions, icons,
  or class instances cross any boundary. `signOutAction` is a server action
  reference used in a form action — same pattern as today.

## 5. Steps

### Step 1 — `src/components/shared/mobile-sidebar.tsx` [new]
Create exactly this component (adjust imports if paths differ, nothing else):

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronRight,
  Flame,
  LogOut,
  Menu,
  Moon,
  Star,
  Sun,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOutAction } from "@/app/actions/auth-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSynergy } from "@/components/shared/synergy-provider";
import type { AppHeaderUser } from "@/components/shared/app-header";
import { playClickSound } from "@/lib/sound-pref";
import { cn } from "@/lib/utils";

type Props = {
  user: AppHeaderUser;
  isMarketplace: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

const ROW_CLASS =
  "focus-spark flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted";

export function MobileSidebar({ user, isMarketplace }: Props) {
  const [open, setOpen] = useState(false);
  const { points } = useSynergy();
  const { resolvedTheme, setTheme } = useTheme();

  const label = user.name?.trim() || user.email || "User";
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="focus-spark inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card transition-colors hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/40 animate-in fade-in-0 duration-200"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-[70] flex w-[85vw] max-w-xs flex-col overflow-y-auto border-l border-border/60 bg-card p-4 shadow-xl animate-in slide-in-from-right duration-200">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="focus-spark inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile block */}
            <div className="mb-4 flex items-center gap-3">
              <Avatar className="size-12 ring-2 ring-border/80">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback>{initials(label)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {label}
                  </span>
                  {user.isAdmin ? (
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Admin
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </div>

            {/* Synergy */}
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
                <Star className="size-3.5 text-amber-500" aria-hidden />
                Synergy
              </div>
              <Link
                href="/marketplace"
                onClick={() => setOpen(false)}
                className="focus-spark flex items-center justify-between rounded-lg border border-primary/20 bg-linear-to-r from-primary/15 to-violet-500/15 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:from-primary/25 hover:to-violet-500/25"
              >
                <span className="inline-flex items-center gap-2">
                  <Flame className="size-4" aria-hidden />
                  <span className="tabular-nums">
                    {points ?? "…"} Points
                  </span>
                </span>
                <ChevronRight className="size-4 opacity-60" aria-hidden />
              </Link>
            </div>

            {/* Menu rows */}
            <nav className="space-y-1">
              {user.isAdmin ? (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className={ROW_CLASS}
                >
                  <Wrench className="size-4 text-muted-foreground" aria-hidden />
                  Admin Panel
                </Link>
              ) : null}
              {!isMarketplace ? (
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setTheme(isDark ? "light" : "dark");
                  }}
                  className={cn(ROW_CLASS, "text-left")}
                >
                  {isDark ? (
                    <Sun className="size-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <Moon className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  {isDark ? "Light Mode" : "Dark Mode"}
                </button>
              ) : null}
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className={ROW_CLASS}
              >
                <User className="size-4 text-muted-foreground" aria-hidden />
                Profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "mailto:team@abtalks.in?subject=ABTalks Issue Report&body=Please describe the issue you're experiencing:%0D%0A%0D%0A";
                }}
                className={cn(ROW_CLASS, "text-left")}
              >
                <AlertCircle
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                Report an Issue
              </button>
            </nav>

            {/* Logout pinned to bottom */}
            <div className="mt-auto border-t border-border/60 pt-3">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="focus-spark flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="size-4" aria-hidden />
                  Logout
                </button>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
```

Notes locked in (do not re-decide):
- `import type { AppHeaderUser }` from app-header is type-only — erased at
  build time, no runtime circular import. Do not duplicate the type.
- Drawer content renders only while `open` — the theme label can never
  hydration-mismatch, so NO `mounted` guard is needed here.
- Overlay `z-[60]` / panel `z-[70]` intentionally sit above the sticky
  header (`z-50`).
- Dark Mode row is hidden on /marketplace (marketplace forces dark), same
  rule the header applies to `ThemeToggle` today.
- Per the reference image: profile block on top (avatar + name + Admin badge
  + email), Synergy section, Admin Panel, theme toggle, Profile, Logout in
  red at the bottom. Image's "Settings" and in-sidebar challenge switcher
  are intentionally EXCLUDED. "Report an Issue" is added so mobile keeps a
  path to it once the avatar dropdown is desktop-only.

### Step 2 — `src/components/shared/app-header.tsx` [edit]
All edits are inside the right-hand `<div className="flex shrink-0 items-center gap-2">`:

1. Add import: `import { MobileSidebar } from "@/components/shared/mobile-sidebar";`
2. Admin pill `<Link href="/admin" …>`: change its className's
   `inline-flex` → `hidden md:inline-flex` (rest of the classes unchanged).
3. Wrap `<SynergyChip />` → `<div className="hidden md:block"><SynergyChip /></div>`.
4. Wrap the theme toggle:
   `{!isMarketplace ? <div className="hidden md:block"><ThemeToggle /></div> : null}`.
5. Divider span: `hidden sm:block` → `hidden md:block`.
6. Wrap the entire `<DropdownMenu>…</DropdownMenu>` (avatar menu) in
   `<div className="hidden md:block">…</div>`.
7. After that wrapper, as the last child of the right cluster, add:
   `<MobileSidebar user={user} isMarketplace={isMarketplace} />`.
8. Touch nothing else — ChallengeSwitcher block, Jobs link, logo `<Link>`,
   scroll-collapse logic, and all dropdown contents stay byte-identical.

### Step 3 — `src/app/globals.css` [edit]
Immediately after the existing `.dark .logo-image { … }` rule (inside the
same `@layer` block), add a phone-only −10% override:

```css
@media (max-width: 47.9375rem) {
  .logo-link {
    max-width: 6.4rem; /* 7.125rem − 10% */
  }
  .logo-link[data-collapsed="true"] {
    max-width: 2.25rem; /* 2.5rem − 10% */
  }
  .logo-image {
    height: 1.8rem; /* 2rem − 10% */
  }
}
```

`47.9375rem` = 767px, i.e. strictly below Tailwind's `md` (48rem), matching
every `md:`/`md:hidden` split used in Steps 1–2. Desktop logo size unchanged.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT touch `src/components/ui/*` (shadcn/Base UI primitives), including
  adding a new "sheet" primitive. The drawer is hand-rolled per the existing
  `admin-mobile-nav.tsx` pattern.
- DO NOT install any dependency (no vaul, no radix, nothing).
- DO NOT modify `theme-toggle.tsx`, `synergy-chip.tsx`,
  `challenge-switcher.tsx`, `bottom-nav.tsx`, or any file outside the three
  listed in §3.
- DO NOT change desktop (`md+`) behavior or markup — every removal is a
  responsive-class hide, not a deletion.
- DO NOT remove the Logout/Report-an-Issue items from the avatar dropdown —
  desktop still uses them.
- DO NOT use `<Button asChild>` / `<Button render={…}>` anywhere (Base UI
  semantics); links use plain `<Link>` with utility classes as shown.
- DO NOT touch `middleware.ts`, `auth.config.ts`, `auth.ts`, or anything in
  the edge import path.
- DO NOT add `requireRole`/`requireAdmin` anywhere — `/admin` is already
  protected server-side; the sidebar link is just a link.
- No new abstraction files beyond `mobile-sidebar.tsx`; keep helpers inline.
- Confirm the files were actually written and the build passes before
  reporting done.

## 7. DB safety
Not applicable — no schema or data changes.

## 8. Verification
- `npm run build` (and typecheck) passes clean.
- Only these files changed: `src/components/shared/mobile-sidebar.tsx` (new),
  `src/components/shared/app-header.tsx`, `src/app/globals.css`.
- Mobile (375px viewport, e.g. devtools iPhone SE), logged in as a test user
  with 2 enrollments (`npm run db:seed` users):
  - Header shows exactly: logo (visibly smaller), challenge switcher,
    hamburger — no Admin pill, no synergy chip, no theme toggle, no avatar;
    nothing overlaps the logo, no horizontal scroll.
  - Hamburger opens right-side drawer: avatar/name/Admin badge/email,
    Synergy points row → /marketplace, Admin Panel (admin user only),
    Dark/Light Mode toggles theme live, Profile → /profile, Report an Issue
    opens mailto, red Logout at bottom signs out.
  - Overlay click, X, and Escape all close it; navigating closes it.
  - On /marketplace the Dark Mode row is absent.
  - Non-admin test user: no Admin badge, no Admin Panel row.
- Desktop (≥768px): header identical to before this change, including logo
  size, avatar dropdown, synergy chip, theme toggle; hamburger never renders.

## 9. Commit message
`feat(mobile): declutter header into slide-in sidebar with logout (phones only)`
