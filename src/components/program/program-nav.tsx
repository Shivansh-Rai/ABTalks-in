"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Header navigation — the Design System v2 uppercase nav (globals.css). */
export function ProgramNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Program navigation"
      className="abt-header-nav min-w-0 flex-1 overflow-x-auto"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="abt-header-nav-link"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
