"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LandingUser } from "@/features/landing/get-landing-state";
import { LandingUserMenu } from "@/components/landing/landing-user-menu";
import { NAV_LINKS } from "./landing-content";

type Props = {
  user: LandingUser | null;
  getStartedHref: string;
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function LandingNav({ user, getStartedHref }: Props) {
  const wrapRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLUListElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [activeId, setActiveId] = useState<string>(NAV_LINKS[0].id);

  useEffect(() => {
    let frame = false;

    function update() {
      frame = false;
      setStuck(window.scrollY > 24);
      const pos = window.scrollY + 140;
      let currentId: string | null = null;
      for (const link of NAV_LINKS) {
        const sec = document.getElementById(link.id);
        if (sec && sec.offsetTop <= pos) currentId = link.id;
      }
      if (currentId) setActiveId(currentId);
    }

    function onScroll() {
      if (frame) return;
      frame = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (navRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  function onAnchorClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    scrollToId(href.slice(1));
    setOpen(false);
  }

  return (
    <header
      className={stuck ? "nav-wrap is-stuck" : "nav-wrap"}
      id="navWrap"
      ref={wrapRef}
    >
      <div className="container">
        <nav className="nav" aria-label="Primary" ref={navRef}>
          <Link href="/" className="nav__logo" aria-label="ABTalks home">
            <Image
              src="/landing/abtalks-logo-mark.png"
              alt="ABTalks"
              width={561}
              height={168}
              priority
            />
          </Link>

          <ul
            className={open ? "nav__links is-open" : "nav__links"}
            id="navLinks"
            ref={linksRef}
          >
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={
                    activeId === link.id
                      ? "nav__link is-active"
                      : "nav__link"
                  }
                  onClick={(e) => onAnchorClick(e, link.href)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="nav__links-cta">
              {user ? (
                <LandingUserMenu user={user} />
              ) : (
                <Link href={getStartedHref} className="btn btn--primary btn--sm">
                  Get Started
                </Link>
              )}
            </li>
            {!user ? (
              <li className="nav__links-cta">
                <Link href="/login" className="btn btn--ghost btn--sm">
                  Sign in
                </Link>
              </li>
            ) : null}
          </ul>

          {user ? (
            <div className="nav__cta">
              <LandingUserMenu user={user} />
            </div>
          ) : (
            <Link
              href={getStartedHref}
              className="btn btn--primary btn--nav nav__cta"
            >
              Get Started
            </Link>
          )}

          <button
            className="nav__burger"
            id="navBurger"
            type="button"
            ref={burgerRef}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="navLinks"
            onClick={() => setOpen((v) => !v)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </nav>
      </div>
    </header>
  );
}
