import Image from "next/image";
import Link from "next/link";
import type { LandingUser } from "@/features/landing/get-landing-state";
import { LandingUserMenu } from "@/components/landing/landing-user-menu";
import { WHATSAPP_INVITE } from "@/components/landing/site/landing-content";
import { LaunchCountdown } from "./launch-countdown";
import {
  CLAUDE_LAUNCH_AT,
  CLAUDE_LAUNCH_LABEL,
  LAUNCH_FOOTER_LINKS,
  LAUNCH_HERO,
  LAUNCH_POINTS,
  LAUNCH_TRACKS,
} from "./launch-content";
import "@/components/landing/site/landing.css";
import "./launch.css";

/**
 * Plan 191, TEMPORARY — the launch one-pager that stands in for the full
 * marketing landing while `LANDING_ONE_PAGER` is on.
 *
 * Server Component. It reuses `landing.css` for the ABTalks tokens and button
 * classes (hence the `.abtalks-landing` wrapper) and adds only its own layout
 * on top, so nothing in `components/landing/site/**` had to change to put this
 * page up — flip the flag off and that landing is back, untouched.
 *
 * The recruiter product does not appear here at all: no hire desk, no talent
 * pool, no recruiter onboarding. Middleware redirects those routes to / for
 * everyone but admins while this page is live.
 */
export function LaunchOnePager({
  user,
  getStartedHref,
  claudeHref,
}: {
  user: LandingUser | null;
  getStartedHref: string;
  claudeHref: string;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="abtalks-landing launch">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="launch__nav">
        <div className="container launch__nav-inner">
          <Link href="/" className="launch__logo" aria-label="ABTalks home">
            <Image
              src="/landing/abtalks-logo-mark.png"
              alt="ABTalks"
              width={561}
              height={168}
              priority
            />
          </Link>

          {user ? (
            <LandingUserMenu user={user} />
          ) : (
            <div className="launch__nav-cta">
              <Link href="/login" className="btn btn--ghost btn--sm">
                Sign in
              </Link>
              <Link href={getStartedHref} className="btn btn--clay btn--nav">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </header>

      <main id="main">
        <section className="launch__hero">
          <div className="container launch__hero-inner">
            <p className="launch__eyebrow">
              <span className="launch__dot" aria-hidden="true" />
              {LAUNCH_HERO.eyebrow}
            </p>

            <h1 className="launch__headline">{LAUNCH_HERO.headline}</h1>

            <p className="launch__date-prefix">{LAUNCH_HERO.datePrefix}</p>
            <LaunchCountdown
              targetIso={CLAUDE_LAUNCH_AT}
              label={CLAUDE_LAUNCH_LABEL}
            />

            <p className="launch__body">{LAUNCH_HERO.body}</p>

            <div className="launch__actions">
              <Link href={claudeHref} className="btn btn--primary btn--lg">
                Get Started
              </Link>
              {user ? null : (
                <Link href="/login" className="btn btn--ghost btn--lg">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="launch__points" aria-label="What the challenge is">
          <div className="container launch__grid">
            {LAUNCH_POINTS.map((point) => (
              <article className="launch__card" key={point.title}>
                <h2 className="launch__card-title">{point.title}</h2>
                <p className="launch__card-body">{point.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="launch__tracks" aria-label="Open right now">
          <div className="container">
            <h2 className="launch__section-title">Open right now</h2>
            <ul className="launch__track-list">
              {LAUNCH_TRACKS.map((track) => (
                <li key={track.href}>
                  <Link href={track.href} className="launch__track">
                    <span className="launch__track-title">{track.title}</span>
                    <span className="launch__track-note">{track.note}</span>
                    <span className="launch__track-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <a
              href={WHATSAPP_INVITE}
              className="btn btn--whatsapp btn--lg launch__whatsapp"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join the community on WhatsApp
            </a>
          </div>
        </section>
      </main>

      <footer className="launch__footer">
        <div className="container launch__footer-inner">
          <span className="launch__copy">
            © ABTalksOnAI {year} All rights reserved.
          </span>
          <ul className="launch__footer-links">
            {LAUNCH_FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
