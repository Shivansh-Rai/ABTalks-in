"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

export type HistorySession = {
  id: string;
  ordinal: number;
  title: string;
  matchCount: number | null;
  /** ISO 8601 — last run if there was one, else created. */
  createdAt: string;
};

export type HistoryProject = {
  id: string;
  label: string;
  updatedAt: string;
  createdAt: string;
  sessions: HistorySession[];
};

/** Coarse on purpose — "is this stale?", not "when exactly?". */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * The Projects / History list: each project, with the searches inside it.
 *
 * Projects are expandable rather than linked-only, because the thing a
 * recruiter is usually looking for is a *search* they ran, not the project
 * that happens to contain it. The first project opens by default so the page
 * never lands as a wall of collapsed rows; the rest stay shut so a recruiter
 * with twenty projects still sees twenty names rather than two hundred lines.
 *
 * Every link goes to a route that already exists — `/hire/<id>` for a project,
 * `?session=<id>` for one of its searches. Nothing here writes.
 */
export function HireProjectsList({ projects }: { projects: HistoryProject[] }) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(projects[0] ? [projects[0].id] : []),
  );

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ul className="hire-history__list">
      {projects.map((p) => {
        const isOpen = open.has(p.id);
        const count = p.sessions.length;
        return (
          <li key={p.id} className="hire-history__project">
            <div className="hire-history__row">
              <button
                type="button"
                className="hire-history__toggle"
                onClick={() => toggle(p.id)}
                aria-expanded={isOpen}
                aria-label={
                  isOpen
                    ? `Hide searches in ${p.label}`
                    : `Show searches in ${p.label}`
                }
              >
                <ChevronDown
                  className={cn(
                    "hire-history__chevron",
                    isOpen && "is-open",
                  )}
                  aria-hidden="true"
                />
              </button>

              <Folder className="hire-history__folder" aria-hidden="true" />

              <Link href={`/hire/${p.id}`} className="hire-history__name">
                {p.label}
              </Link>

              {/* suppressHydrationWarning: server and browser read the clock a
                  few ms apart, so a relative time can straddle a boundary. */}
              <span className="hire-history__meta" suppressHydrationWarning>
                {count} {count === 1 ? "search" : "searches"} · Updated{" "}
                {ago(p.updatedAt)}
              </span>

              <Link href={`/hire/${p.id}`} className="hire-history__open">
                Open
              </Link>
            </div>

            {isOpen && (
              <div className="hire-history__searches">
                {count === 0 ? (
                  <p className="hire-history__none">
                    No searches in this project yet.
                  </p>
                ) : (
                  <ul className="hire-history__sessions">
                    {p.sessions.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/hire/${p.id}?session=${s.id}`}
                          className="hire-history__session"
                          title={s.title}
                        >
                          <Clock
                            className="hire-history__clock"
                            aria-hidden="true"
                          />
                          <span className="hire-history__stext">
                            <span className="hire-history__stitle">
                              {s.ordinal}. {s.title}
                            </span>
                            <span
                              className="hire-history__smeta"
                              suppressHydrationWarning
                            >
                              {ago(s.createdAt)}
                              {typeof s.matchCount === "number"
                                ? ` · ${s.matchCount} result${s.matchCount === 1 ? "" : "s"}`
                                : ""}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
