"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Menu } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-hub/dashboard-sidebar";

export type WorkshopShellUser = {
  name: string;
  email: string;
  image: string | null;
};

type WorkshopMobileNav = {
  menuOpen: boolean;
  openMenu: () => void;
};

const WorkshopMobileNavContext = createContext<WorkshopMobileNav | null>(null);

function useWorkshopMobileNav(): WorkshopMobileNav {
  const ctx = useContext(WorkshopMobileNavContext);
  if (!ctx) {
    throw new Error("useWorkshopMobileNav must be used inside WorkshopShell");
  }
  return ctx;
}

/** Mobile-only hamburger — opens the shared DashboardSidebar drawer. */
export function WorkshopMenuButton() {
  const { menuOpen, openMenu } = useWorkshopMobileNav();
  return (
    <button
      type="button"
      className="abt-header-icon md:hidden"
      aria-label="Open menu"
      aria-expanded={menuOpen}
      onClick={openMenu}
    >
      <Menu aria-hidden />
    </button>
  );
}

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
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMenu = useCallback(() => setMobileOpen(true), []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeMobile]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    function onWide(e: MediaQueryListEvent) {
      if (e.matches) closeMobile();
    }
    mq.addEventListener("change", onWide);
    return () => mq.removeEventListener("change", onWide);
  }, [closeMobile]);

  return (
    <WorkshopMobileNavContext.Provider
      value={{ menuOpen: mobileOpen, openMenu }}
    >
      <div className="flex min-h-svh">
        <DashboardSidebar
          user={user}
          mobileOpen={mobileOpen}
          onNavigate={closeMobile}
          signedIn={isAuthed}
        />

        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Close menu"
            onClick={closeMobile}
          />
        ) : null}

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </WorkshopMobileNavContext.Provider>
  );
}
