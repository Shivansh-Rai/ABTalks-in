"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/talent", label: "Talent pool" },
  { href: "/talent/shortlist", label: "Shortlist" },
];

const HIDE_NAV = ["/talent/register", "/talent/pending"];

export function TalentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !HIDE_NAV.some((p) => pathname === p);

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <Link
            href={showNav ? "/talent" : "/program"}
            className="font-display text-base font-semibold tracking-tight"
          >
            ABTalks <span className="text-primary">Talent</span>
          </Link>
          {showNav && (
            <nav className="flex gap-4 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-muted-foreground hover:text-foreground",
                    pathname === item.href && "font-medium text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
