"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Award,
  Bot,
  Briefcase,
  ClipboardCheck,
  Grid3X3,
  LogIn,
  LogOut,
  Menu,
  MoreVertical,
  Presentation,
  Store,
  User,
  Zap,
} from "lucide-react";
import { signOutAction } from "@/app/actions/auth-actions";
import { cn } from "@/lib/utils";
import {
  NAV_ITEMS,
  SIDEBAR_BRAND_ROW_CLASS,
  SIDEBAR_FOOTER_ROW_CLASS,
  SIDEBAR_WIDTH_CLASS,
  HUB_NAV_ACTIVE_CLASS,
  HUB_NAV_IDLE_CLASS,
  type NavIconKey,
} from "./nav-items";

const ICON_MAP: Record<
  NavIconKey,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  grid: Grid3X3,
  presentation: Presentation,
  store: Store,
  briefcase: Briefcase,
  award: Award,
  zap: Zap,
  user: User,
  clipboard: ClipboardCheck,
  bot: Bot,
};

const SIDEBAR_COLLAPSED_WIDTH_CLASS = "w-[72px]";

type DashboardSidebarProps = {
  user: { name: string; email: string; image: string | null };
  mobileOpen: boolean;
  onNavigate: () => void;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /**
   * False on the public routes that render this sidebar to signed-out
   * visitors (`/hackathon`). Every other DashboardShell route is gated by
   * middleware, so it stays true and nothing about them changes.
   */
  signedIn?: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function DashboardSidebar({
  user,
  mobileOpen,
  onNavigate,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  signedIn = true,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const displayName = user.name.trim() || user.email || "User";
  const isCollapsed = collapsible && collapsed;

  // Hover-to-expand + hover-away-to-collapse, gated by a manual-mode latch.
  //
  //   - collapsed rail hovered for 700ms → auto-expand (marks expandedViaHover)
  //   - mouse leaves an auto-expanded rail → auto-collapse ~200ms later
  //   - ANY button click (expand or collapse) trips manualModeRef; while it's
  //     on, no hover handler does anything. Manual mode stays on until the
  //     next button click, so a click-driven state persists until the user
  //     clicks again — no accidental re-open on hover, no auto-collapse on
  //     mouse-move.
  //
  // Timers are always cleared on the opposite event, on manual toggle, on
  // collapsed-state changes, and on unmount.
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandedViaHoverRef = useRef(false);
  // Session-scoped only — never persisted, so a page refresh always resets
  // the sidebar back into hover-driven mode regardless of the last click.
  const manualModeRef = useRef(false);

  function clearExpandTimer() {
    if (expandTimerRef.current !== null) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }
  function clearCollapseTimer() {
    if (collapseTimerRef.current !== null) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearExpandTimer();
      clearCollapseTimer();
    };
  }, []);

  function handleRailEnter() {
    clearCollapseTimer();
    if (manualModeRef.current) return;
    if (!collapsible || !onToggleCollapse || !isCollapsed) return;
    clearExpandTimer();
    expandTimerRef.current = setTimeout(() => {
      expandTimerRef.current = null;
      expandedViaHoverRef.current = true;
      onToggleCollapse();
    }, 700);
  }
  function handleRailLeave() {
    clearExpandTimer();
    // Any full exit clears the manual-mode latch, so the very next re-entry
    // is treated as a fresh session — hover can auto-expand again without
    // requiring a page refresh. The refresh reset still holds separately.
    const wasManual = manualModeRef.current;
    manualModeRef.current = false;
    if (wasManual) return;
    if (
      !collapsible ||
      !onToggleCollapse ||
      isCollapsed ||
      !expandedViaHoverRef.current
    )
      return;
    clearCollapseTimer();
    collapseTimerRef.current = setTimeout(() => {
      collapseTimerRef.current = null;
      expandedViaHoverRef.current = false;
      onToggleCollapse();
    }, 200);
  }

  // Button-driven toggle. Trips the manual-mode latch so hover handlers stop
  // firing until the next button click, and clears any pending hover timers.
  const handleManualToggle = onToggleCollapse
    ? () => {
        clearExpandTimer();
        clearCollapseTimer();
        expandedViaHoverRef.current = false;
        manualModeRef.current = true;
        onToggleCollapse();
      }
    : undefined;

  function renderNav(compact: boolean) {
    return (
      <nav
        className={cn("flex-1 space-y-1 py-4", compact ? "px-2" : "px-4")}
        aria-label="Main"
      >
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const Icon = ICON_MAP[icon];
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={compact ? label : undefined}
              aria-label={compact ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "abt-nav-item",
                // px-3/gap-2.5 rather than px-4/gap-3: the 250px column leaves
                // 154px for the label at px-4, and "Events And Workshops" needs
                // ~144px at 14px — close enough that it wrapped to a second
                // line and made that row taller than the rest. This buys 10px.
                compact ? "justify-center px-2" : "gap-2.5 px-3",
                active ? HUB_NAV_ACTIVE_CLASS : HUB_NAV_IDLE_CLASS,
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {/* `whitespace-nowrap` so a long label can never wrap this row to
                  two lines; `truncate` keeps the failure mode contained to an
                  ellipsis inside the column rather than text spilling out. */}
              <span
                className={cn(
                  "min-w-0 truncate whitespace-nowrap",
                  compact && "sr-only",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  function renderFooter(compact: boolean) {
    // A signed-out visitor has no name, no avatar and nothing to sign out of —
    // showing the tile would render a stranger back to themselves as "User".
    if (!signedIn) {
      return (
        <div
          className={cn(
            "mt-auto",
            compact
              ? "flex shrink-0 flex-col items-center gap-3 border-t border-[#E0E0E0] p-3"
              : "flex shrink-0 flex-col justify-center border-t border-[#E0E0E0] p-4",
          )}
        >
          <Link
            href="/login"
            onClick={onNavigate}
            title={compact ? "Log in" : undefined}
            aria-label={compact ? "Log in" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border border-[#E0E0E0] text-sm font-medium text-[#4B4B4B] transition-[border-color,background-color,color] duration-200 ease-[var(--ease-spark)] hover:border-[#03535F] hover:bg-[#03535F]/10 hover:text-[#03535F]",
              compact ? "size-9 p-0" : "w-full px-3 py-2",
            )}
          >
            <LogIn className="size-4" aria-hidden />
            <span className={cn(compact && "sr-only")}>Log in</span>
          </Link>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "mt-auto",
          compact
            ? "flex shrink-0 flex-col items-center gap-3 border-t border-[#E0E0E0] p-3"
            : SIDEBAR_FOOTER_ROW_CLASS,
        )}
      >
        <div
          className={cn(
            "flex items-center",
            compact ? "justify-center" : "gap-3",
          )}
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="size-9 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E9E9E9] text-xs font-semibold text-[#353535]"
              aria-hidden
            >
              {initials(displayName)}
            </span>
          )}
          {!compact ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-black">
                {displayName}
              </p>
              <p className="truncate text-xs text-[#4B4B4B]">{user.email}</p>
            </div>
          ) : null}
        </div>
        <form action={signOutAction} className={cn(!compact && "mt-3")}>
          <button
            type="submit"
            title={compact ? "Sign out" : undefined}
            aria-label={compact ? "Sign out" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border border-[#E0E0E0] text-sm font-medium text-[#4B4B4B] transition-[border-color,background-color,color] duration-200 ease-[var(--ease-spark)] hover:border-[#03535F] hover:bg-[#03535F]/10 hover:text-[#03535F]",
              compact ? "size-9 p-0" : "w-full px-3 py-2",
            )}
          >
            <LogOut className="size-4" aria-hidden />
            <span className={cn(compact && "sr-only")}>Sign out</span>
          </button>
        </form>
      </div>
    );
  }

  const expandedContent = (
    <>
      <div className={cn(SIDEBAR_BRAND_ROW_CLASS, "justify-between gap-2")}>
        <Link href="/dashboard" onClick={onNavigate}>
          <Image
            src="/abtalks-logo.png"
            alt="ABTalks"
            width={120}
            height={32}
            className="h-8 w-auto brightness-0"
          />
        </Link>
        {collapsible && handleManualToggle ? (
          <button
            type="button"
            onClick={handleManualToggle}
            aria-expanded={!isCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="hidden size-8 items-center justify-center rounded-md text-[#4B4B4B] transition-colors duration-200 ease-[var(--ease-spark)] hover:bg-[#03535F]/10 hover:text-[#03535F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F] md:inline-flex"
          >
            <MoreVertical className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {renderNav(false)}
      {renderFooter(false)}
    </>
  );

  const collapsedContent = (
    <>
      <div className="flex h-[55px] shrink-0 items-center justify-center border-b border-[#E9E9E9]">
        {handleManualToggle ? (
          <button
            type="button"
            onClick={handleManualToggle}
            aria-expanded={false}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="group relative flex size-9 items-center justify-center rounded-md text-black transition-colors duration-200 ease-[var(--ease-spark)] hover:bg-[#03535F]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]"
          >
            <span
              aria-hidden
              className="relative block h-6 w-[28px] overflow-hidden transition-opacity duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:opacity-0 group-focus-visible:opacity-0"
            >
              <Image
                src="/abtalks-logo.png"
                alt=""
                width={120}
                height={32}
                className="absolute left-0 top-1/2 h-6 w-auto max-w-none -translate-y-1/2 brightness-0"
              />
            </span>
            <Menu
              aria-hidden
              className="absolute size-4 text-[#03535F] opacity-0 transition-opacity duration-200 ease-[var(--ease-spark)] group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </button>
        ) : (
          <Link
            href="/dashboard"
            onClick={onNavigate}
            aria-label="ABTalks dashboard"
            className="relative block h-6 w-[28px] overflow-hidden"
          >
            <Image
              src="/abtalks-logo.png"
              alt=""
              width={120}
              height={32}
              className="absolute left-0 top-1/2 h-6 w-auto max-w-none -translate-y-1/2 brightness-0"
            />
          </Link>
        )}
      </div>
      {renderNav(true)}
      {renderFooter(true)}
    </>
  );

  const desktopWidth = isCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH_CLASS
    : SIDEBAR_WIDTH_CLASS;

  return (
    <>
      <aside
        onMouseEnter={handleRailEnter}
        onMouseLeave={handleRailLeave}
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col overflow-hidden border-r border-[#E9E9E9] bg-white md:flex",
          "transition-[width] duration-[420ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width]",
          desktopWidth,
        )}
      >
        <div className="relative h-full w-full">
          <div
            aria-hidden={isCollapsed}
            className={cn(
              "absolute inset-0 flex flex-col overflow-y-auto transition-[opacity] duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              isCollapsed
                ? "pointer-events-none opacity-0"
                : "opacity-100 delay-[140ms]",
            )}
          >
            {expandedContent}
          </div>
          <div
            aria-hidden={!isCollapsed}
            className={cn(
              "absolute inset-0 flex flex-col overflow-y-auto transition-[opacity] duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              isCollapsed
                ? "opacity-100 delay-[140ms]"
                : "pointer-events-none opacity-0",
            )}
          >
            {collapsedContent}
          </div>
        </div>
      </aside>

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-y-auto border-r border-[#E9E9E9] bg-white transition-transform duration-200 md:hidden",
          SIDEBAR_WIDTH_CLASS,
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {expandedContent}
      </aside>
    </>
  );
}
