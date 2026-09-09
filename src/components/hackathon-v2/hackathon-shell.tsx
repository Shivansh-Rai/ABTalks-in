"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/workshop", label: "Workshops", icon: "workshops" },
  { href: "/marketplace", label: "Marketplace", icon: "marketplace" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/achievements", label: "Achievements", icon: "achievements" },
  { href: "/hackathon", label: "Hackathon", icon: "hackathon", active: true },
  { href: "/profile", label: "Profile", icon: "profile" },
] as const;

type Props = {
  headerCta: ReactNode;
  userName: string;
  children: ReactNode;
  onSignOut?: () => void;
};

function Icon({ name }: { name: string }) {
  switch (name) {
    case "dashboard":
      return (
        <svg className="ab-nav__icon" viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "workshops":
      return (
        <svg className="ab-nav__icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M2 3h20" />
          <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
          <path d="m7 21 5-5 5 5" />
        </svg>
      );
    case "marketplace":
      return (
        <svg className="ab-nav__icon" viewBox="0 0 24 24" aria-hidden>
          <path d="m2 7 1.5-4h17L22 7" />
          <path d="M2 7h20v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
          <path d="M4 12.5V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7.5" />
        </svg>
      );
    case "jobs":
      return (
        <svg className="ab-nav__icon" viewBox="0 0 24 24" aria-hidden>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "achievements":
      return (
        <svg className="ab-nav__icon" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      );
    case "hackathon":
      return (
        <svg className="ab-nav__icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case "profile":
      return (
        <svg className="ab-nav__icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}

export function HackathonShell({
  headerCta,
  userName,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 821px)");
    function onWide(e: MediaQueryListEvent) {
      if (e.matches) setSidebarOpen(false);
    }
    mq.addEventListener("change", onWide);
    return () => mq.removeEventListener("change", onWide);
  }, []);

  return (
    <div className="theme-abtalks-light theme-abtalks-orange ab-shell">
      <aside
        className={`ab-sidebar${sidebarOpen ? " is-open" : ""}`}
        id="ab-sidebar"
        aria-label="Main"
      >
        <div className="ab-sidebar__top">
          <Link className="ab-logo" href="/dashboard">
            AB TALKS
          </Link>
          <button
            className="ab-icon-btn ab-sidebar__close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="ab-nav" aria-label="Dashboard sections">
          <ul className="ab-nav__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  className={`ab-nav__item${
                    "active" in item && item.active ? " is-active" : ""
                  }`}
                  href={item.href}
                  aria-current={
                    "active" in item && item.active ? "page" : undefined
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ab-sidebar__foot">
          <div className="ab-sidebar__divider" />
          <div className="ab-user">
            <span className="ab-user__avatar" aria-hidden />
            <span className="ab-user__meta">
              <span className="ab-user__name">{userName || "Guest"}</span>
            </span>
          </div>
        </div>
      </aside>
      <div
        className="ab-scrim"
        onClick={() => setSidebarOpen(false)}
        hidden={!sidebarOpen}
      />

      <div className="ab-body">
        <header className="ab-header">
          <button
            className="ab-icon-btn ab-header__menu"
            type="button"
            aria-label="Open navigation"
            aria-controls="ab-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="ab-header__right">
            <Link className="ab-header__link" href="/events">
              <svg viewBox="0 0 24 24" aria-hidden>
                <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
              </svg>
              <span>Discover events</span>
            </Link>
            <button
              className="ab-icon-btn"
              type="button"
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" />
                <path d="M10.3 19a2 2 0 0 0 3.4 0" />
              </svg>
            </button>
            {headerCta}
          </div>
        </header>

        <main className="ab-content hk" id="ab-main">
          {children}
        </main>
      </div>
    </div>
  );
}
