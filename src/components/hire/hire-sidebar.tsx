"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHireAuth } from "@/components/hire/hire-auth-provider";
import { useHireDesk } from "@/components/hire/hire-desk-context";
import {
  SubscriptionGate,
  type GateReason,
} from "@/components/hire/subscription-gate";
import type { RecruiterAccountSnapshot } from "@/features/hire/recruiter-account-types";
import { NewProjectDialog } from "@/components/hire/new-project-dialog";
import { ProjectAssessmentsList } from "@/components/hire/project-assessments-list";
import { cn } from "@/lib/utils";
import {
  ChartColumn,
  FolderKanban,
  FolderOpen,
  House,
  LifeBuoy,
  MessageSquare,
  Settings,
} from "lucide-react";

/**
 * The nav card on the left of the Scout desk (Figma 1585:76).
 *
 * The grey squares are the icon slots exactly as the design ships them. Analytics
 * has no page yet, so it is a disabled row rather than a link to nowhere.
 * "+ Create New Project" asks ScoutChat to start over through the desk context —
 * the conversation state lives there, not here.
 */
export function HireSidebar({
  account,
  unreadMessages = 0,
  projects = [],
  openProjectId = null,
}: {
  account: RecruiterAccountSnapshot | null;
  /** T-232: outreach threads where the candidate replied since this recruiter last looked. */
  unreadMessages?: number;
  /** Plan 133: the recruiter's projects, for switching. */
  projects?: { id: string; label: string }[];
  /** Plan 133: the project in the URL, if any. */
  openProjectId?: string | null;
}) {
  const pathname = usePathname();
  const { openAuth } = useHireAuth();
  const { projectName, requestNewProject, requestNewSearch, project } = useHireDesk();
  const [gate, setGate] = useState<GateReason | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  // Only the project actually in the URL. The desk context outlives the page
  // that set it, so a project left behind must not keep showing here.
  const liveProject = project && project.id === openProjectId ? project : null;

  const name = account?.fullName ?? "Guest";
  const sub = account
    ? `${account.company}’s Dashboard`
    : "Sign in to save searches";

  const who = (
    <>
      <img
        src="/hire/avatar-sidebar.png"
        alt=""
        width={45}
        height={44}
        className="hire-side__avatar"
      />
      <span className="hire-side__who">
        <span className="hire-side__name">{name}</span>
        <span className="hire-side__sub">{sub}</span>
      </span>
    </>
  );

  return (
    <aside className="hire-side" aria-label="Hire navigation">
      <nav className="hire-side__nav">
        <Link
          href="/hire"
          className={cn("hire-side__item", pathname === "/hire" && "is-current")}
          aria-current={pathname === "/hire" ? "page" : undefined}
        >
          <House className="hire-side__icon" aria-hidden="true" />
          Home
        </Link>
        <Link
          href="/hire/requests"
          className={cn(
            "hire-side__item",
            pathname === "/hire/requests" && "is-current",
          )}
        >
          <FolderKanban className="hire-side__icon" aria-hidden="true" />
          Projects
        </Link>
        {account && (
          <Link
            href="/hire/messages"
            className={cn(
              "hire-side__item",
              pathname.startsWith("/hire/messages") && "is-current",
            )}
            aria-current={pathname.startsWith("/hire/messages") ? "page" : undefined}
          >
            <MessageSquare className="hire-side__icon" aria-hidden="true" />
            Messages
            {unreadMessages > 0 && (
              <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground">
                {unreadMessages}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </Link>
        )}
        {account && (
          <Link
            href="/hire/settings"
            className={cn(
              "hire-side__item",
              pathname.startsWith("/hire/settings") && "is-current",
            )}
            aria-current={pathname.startsWith("/hire/settings") ? "page" : undefined}
          >
            <Settings className="hire-side__icon" aria-hidden="true" />
            Settings
          </Link>
        )}
        <span
          className="hire-side__item is-disabled"
          aria-disabled="true"
          title="Coming soon"
        >
          <ChartColumn className="hire-side__icon" aria-hidden="true" />
          Analytics
        </span>

        <span className="hire-side__spacer hire-side__spacer--a" aria-hidden="true" />

        <div className="hire-side__project">
          <span className="hire-side__item">
            <FolderOpen className="hire-side__icon" aria-hidden="true" />
            <span className="hire-side__label">
              {projectName || "Current Project"}
            </span>
          </span>
          {/* Plan 133: the open project's own searches. Each is a session
              inside THIS project; "+ New search" adds one, never a project. */}
          {liveProject && (
            <div className="space-y-1 py-1">
              <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Searches in this project
              </p>
              {liveProject.sessions.length === 0 ? (
                <p className="px-3 text-xs text-muted-foreground">No searches yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {liveProject.sessions.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/hire/${liveProject.id}?session=${s.id}`}
                        className={cn(
                          "block truncate rounded px-3 py-1 text-xs hover:bg-muted",
                          s.id === liveProject.activeSessionId && "bg-muted font-semibold",
                        )}
                        aria-current={s.id === liveProject.activeSessionId ? "page" : undefined}
                        title={s.title}
                      >
                        {s.ordinal}. {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="hire-side__new" onClick={requestNewSearch}>
                + New search
              </button>
              <ProjectAssessmentsList
                projectId={liveProject.id}
                assessments={liveProject.assessments}
                unassigned={liveProject.unassignedAssessments}
              />
            </div>
          )}
          <button
            type="button"
            className="hire-side__new"
            onClick={() => (account ? setNewProjectOpen(true) : requestNewProject())}
          >
            + Create New Project
          </button>
          {account && projects.length > 0 && (
            <div className="space-y-0.5 pt-1">
              <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Your projects
              </p>
              <ul className="space-y-0.5">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/hire/${p.id}`}
                      className={cn(
                        "block truncate rounded px-3 py-1 text-xs hover:bg-muted",
                        p.id === openProjectId && "bg-muted font-semibold",
                      )}
                      aria-current={p.id === openProjectId ? "page" : undefined}
                    >
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />

        <span className="hire-side__spacer hire-side__spacer--b" aria-hidden="true" />

        <Link href="/contact" className="hire-side__item">
          <LifeBuoy className="hire-side__icon" aria-hidden="true" />
          Support
        </Link>
        <button
          type="button"
          className="hire-side__upgrade"
          aria-haspopup="dialog"
          onClick={() => setGate("default")}
        >
          Upgrade →
        </button>
      </nav>

      {account ? (
        <div className="hire-side__me">{who}</div>
      ) : (
        <button
          type="button"
          className="hire-side__me"
          onClick={() => openAuth("nav")}
        >
          {who}
        </button>
      )}

      <SubscriptionGate reason={gate} onClose={() => setGate(null)} />
    </aside>
  );
}
