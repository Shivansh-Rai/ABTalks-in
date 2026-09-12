import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Clock, Search } from "lucide-react";
import { requireRecruiter } from "@/lib/program-auth";
import { prisma } from "@/lib/db";
import { HireProjectsList } from "@/components/hire/hire-projects-list";

export const metadata: Metadata = {
  title: "Search history | ABTalks Hire",
};

/**
 * Projects / History.
 *
 * The sidebar keeps quick access to the project you are in and the searches
 * inside it; browsing everything you have ever run belongs on a page, not in a
 * 281px rail that has to scroll to show six items. This is that page:
 * every project, each with the searches it contains, newest first.
 *
 * Read-only and additive. It creates nothing, renames nothing and deletes
 * nothing — the project and search records, and every action on them, are
 * exactly as they were. This is information architecture, not new behaviour.
 *
 * One query, not one per project: `TalentSearchSession` is included on the
 * project rows rather than fetched in a loop, so the page costs two round
 * trips regardless of how many projects the recruiter has.
 */
export default async function HireProjectsPage() {
  const { userId } = await requireRecruiter();

  const projects = await prisma.talentRequest.findMany({
    where: { recruiterUserId: userId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      sessions: {
        orderBy: { ordinal: "desc" },
        select: {
          id: true,
          ordinal: true,
          title: true,
          matchCount: true,
          lastRunAt: true,
          createdAt: true,
        },
      },
    },
  });

  const rows = projects.map((p) => ({
    id: p.id,
    label: p.name?.trim() || p.title.trim() || "Untitled project",
    // ISO across the Server→Client boundary; a Date instance does not survive it.
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    sessions: p.sessions.map((s) => ({
      id: s.id,
      ordinal: s.ordinal,
      title: s.title,
      matchCount: s.matchCount,
      createdAt: (s.lastRunAt ?? s.createdAt).toISOString(),
    })),
  }));

  const searchTotal = rows.reduce((n, p) => n + p.sessions.length, 0);

  return (
    <main className="hire-history">
      <header className="hire-history__head">
        {/* Titled to match the nav item that leads here — a link reading
            "Search history" that lands on a page headed "Projects" makes the
            reader check whether they clicked the right thing. */}
        <h1 className="hire-history__title">Search history</h1>
        <p className="hire-history__lede">
          {rows.length === 0
            ? "Every project you create keeps its own searches, shortlist and assessments."
            : `${rows.length} project${rows.length === 1 ? "" : "s"} · ${searchTotal} search${searchTotal === 1 ? "" : "es"}`}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="hire-history__empty">
          <FolderOpen className="hire-history__emptyicon" aria-hidden="true" />
          <p className="hire-history__emptyh">No projects yet</p>
          <p className="hire-history__emptyp">
            Start a search from the desk and save it as a project — its searches
            and shortlist stay together here.
          </p>
          <Link href="/hire" className="hire-history__emptycta">
            <Search className="hire-history__emptyctaicon" aria-hidden="true" />
            Go to the desk
          </Link>
        </div>
      ) : (
        <HireProjectsList projects={rows} />
      )}

      <p className="hire-history__foot">
        <Clock className="hire-history__footicon" aria-hidden="true" />
        Showing your most recent {rows.length === 100 ? "100 " : ""}projects.
        Archived projects are not listed.
      </p>
    </main>
  );
}
