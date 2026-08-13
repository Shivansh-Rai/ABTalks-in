"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LandingUser } from "@/features/landing/get-landing-state";
import { LandingUserMenu } from "../landing-user-menu";

const NAV_LINKS = [
  { href: "#about", label: "About" },
  { href: "#how", label: "How it works" },
  { href: "#programs", label: "Programs" },
  { href: "#faq", label: "FAQ" },
];

type Props = {
  user: LandingUser | null;
};

export function HubNav({ user }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const close = () => setMenuOpen(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Reserves layout space; wrap is fixed so backdrop-filter can blur page content */}
      <div className="hub-nav-spacer" aria-hidden />
      <div className={scrolled ? "hub-navwrap scrolled" : "hub-navwrap"}>
        <nav className="hub-nav-pill" aria-label="Primary">
          <button
            type="button"
            className={menuOpen ? "hub-navtoggle open" : "hub-navtoggle"}
            aria-expanded={menuOpen}
            aria-controls="hub-mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="hub-navtoggle-bars" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>

          <Link href="/" className="hub-nav-logo" aria-label="ABTalks home">
            <Image
              src="/landing/abtalks-logo-mark.png"
              alt="ABTalks"
              width={561}
              height={168}
              priority
              className="hub-nav-logo-img hub-logo-mark"
            />
          </Link>

          <div className="hub-nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hub-nav-link">
                {link.label}
              </a>
            ))}
          </div>

          {user ? (
            <div className="hub-nav-profile">
              <LandingUserMenu user={user} />
            </div>
          ) : (
            <Link href="/program" className="hub-nav-cta">
              Get Started
            </Link>
          )}
        </nav>
      </div>

      {/* Outside wrap so pill overflow:hidden does not clip the menu */}
      <div
        id="hub-mobile-nav"
        className={menuOpen ? "hub-navpanel open" : "hub-navpanel"}
      >
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={close}>
            {link.label}
          </a>
        ))}
        {!user ? (
          <Link
            href="/login"
            className="hub-btn hub-btn-ghost"
            onClick={close}
          >
            Sign in
          </Link>
        ) : null}
      </div>
    </>
  );
}
