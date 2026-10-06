"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

/*
 * Plan 168. The global <RouteProgress /> bar says "something is loading";
 * this says WHICH row you clicked, which is the part a sidebar needs — the
 * bar is at the top of the viewport, the recruiter is looking at the nav.
 */

/**
 * `useLinkStatus` reports the nearest `<Link>` ANCESTOR, so this has to be a
 * child of the Link. Called inside NavLink itself it would find no Link above
 * it and stay `pending: false` forever — which reads as "the hook is broken"
 * rather than "the call site is wrong". Keep it a separate component.
 */
function NavLinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="nav-pending" aria-hidden="true" />;
}

export function NavLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <NavLinkPending />
    </Link>
  );
}
