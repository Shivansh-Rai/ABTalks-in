"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#about", label: "About" },
  { href: "#how", label: "How it works" },
  { href: "#programs", label: "Programs" },
  { href: "#faq", label: "FAQ" },
];

export function HubNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <div className="hub-navwrap">
      <nav className="hub-nav-pill" aria-label="Primary">
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

        <Link href="/program" className="hub-nav-cta">
          Get Started
        </Link>

        <button
          type="button"
          className="hub-navtoggle"
          aria-expanded={menuOpen}
          aria-controls="hub-mobile-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </nav>

      <div
        id="hub-mobile-nav"
        className={menuOpen ? "hub-navpanel open" : "hub-navpanel"}
      >
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={close}>
            {link.label}
          </a>
        ))}
        <Link href="/login" className="hub-btn hub-btn-ghost" onClick={close}>
          Sign in
        </Link>
        <Link
          href="/program"
          className="hub-btn hub-btn-primary"
          onClick={close}
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
