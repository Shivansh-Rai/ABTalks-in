"use client";

import { useCallback, useState, type ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard-hub/dashboard-sidebar";

export type WorkshopShellUser = {
  name: string;
  email: string;
  image: string | null;
};

type Props = {
  user: WorkshopShellUser;
  /** `/workshop` is a public route — guests get a Log in link, not a user tile. */
  isAuthed: boolean;
  children: ReactNode;
};

/**
 * Workshop nav column. The sidebar is the shared ABTalks `DashboardSidebar` —
 * the same one `/dashboard`, `/marketplace` and `/hackathon` render — so this
 * route can't drift from the rest of the app.
 *
 * Unlike `DashboardShell` this adds ONLY the sidebar: the workshop keeps its
 * own cream/charcoal theme, its `abt-header` (which carries the "Reserve seat"
 * CTA) and its charcoal footer, because this is a marketing page for cold
 * traffic rather than an app surface.
 *
 * The children are NOT wrapped in a scroll container, unlike `DashboardShell`.
 * The workshop scrolls the document itself, which is what its sticky header,
 * `html { scroll-behavior: smooth }` and the `#curriculum` / `#events` /
 * `#register` hash anchors all depend on. The sidebar is `sticky top-0 h-svh`
 * on its own, so it holds position without the page needing an inner scroller.
 *
 * Client-only because `DashboardSidebar` takes an `onNavigate` callback, which
 * a Server Component cannot hand across the boundary.
 */
export function WorkshopShell({ user, isAuthed, children }: Props) {
  // Desktop-only: `DashboardSidebar`'s own column is `hidden md:flex`, and
  // `BottomNav` deliberately returns null on /workshop, so the mobile
  // marketing view stays exactly as it was. Nothing opens the drawer here.
  const [mobileOpen] = useState(false);
  const noop = useCallback(() => {}, []);

  return (
    <div className="flex min-h-svh">
      <DashboardSidebar
        user={user}
        mobileOpen={mobileOpen}
        onNavigate={noop}
        signedIn={isAuthed}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
