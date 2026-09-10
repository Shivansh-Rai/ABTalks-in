import { CalendarDays } from "lucide-react";
import WorkshopLogo from "@/components/workshop/WorkshopLogo";
import { NotificationBellButton } from "@/components/shared/notification-bell-button";

/**
 * /workshop header — the shared Design System v2 global header (55px, white
 * frosted glass, uppercase navigation, clay CTA), defined in globals.css.
 *
 * The design system is light-only, so the old charcoal bar and its theme
 * toggle are gone. Logged-out traffic gets "Login/Sign Up"; a signed-in
 * visitor has nothing to log into, so the same slot becomes the seat CTA.
 */
export default function WorkshopHeader({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <header className="abt-header z-50">
      <div className="abt-header-inner">
        <WorkshopLogo />

        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          {/* Jumps to the calendar on this page — this header only renders on
              /workshop, so the hash stays on-page and scrolls smoothly. */}
          <a
            href="#events"
            aria-label="Discover events"
            className="abt-header-nav-link"
          >
            <CalendarDays aria-hidden />
            <span className="hidden sm:inline">Discover events</span>
          </a>

          {/* Only for signed-in visitors: skipping it for anonymous traffic
              saves the feed fetch entirely. */}
          {isSignedIn && <NotificationBellButton className="abt-header-icon" />}

          <a
            href={isSignedIn ? "#register" : "/login?from=%2Fworkshop%23register"}
            className="abt-header-cta"
          >
            {isSignedIn ? "Reserve seat" : "Login/Sign Up"}
          </a>
        </div>
      </div>
    </header>
  );
}
