import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRecruiter } from "@/lib/program-auth";
import { ScoutChat } from "@/components/hire/scout-chat";
import { loadRequestMatches } from "@/features/hire/load-request-matches";
import {
  ensureLegacySession,
  getOwnedSession,
  listProjectSessions,
  listSessionMessages,
  specFromJson,
} from "@/features/hire/search-sessions";
import {
  listProjectAssessments,
  listUnassignedAssessments,
} from "@/features/hire/project-assessments";
import type { JobSpec } from "@/lib/validations/hire";

type Props = {
  params: Promise<{ requestId: string }>;
  /** Plan 133: `?session=<id>` opens that search; `?session=new` a new one. */
  searchParams: Promise<{ session?: string }>;
};

export const metadata: Metadata = {
  title: "Scout search | ABTalks Hire",
};

/**
 * One project (plan 133). Its search sessions are listed in the nav card; this
 * page shows ONE of them — the one in `?session=`, else the latest. A project
 * with no search yet (just created) opens on an empty Scout, and its first
 * search becomes Session 1.
 */
export default async function HireRequestPage({ params, searchParams }: Props) {
  const { userId } = await requireRecruiter();
  const { requestId } = await params;
  const { session: sessionParam } = await searchParams;

  let request;
  try {
    request = await prisma.talentRequest.findFirst({
      where: { id: requestId, recruiterUserId: userId },
      select: {
        id: true,
        title: true,
        name: true,
        status: true,
        alertWhenAvailable: true,
      },
    });
  } catch {
    notFound();
  }

  if (!request) notFound();

  // A project from before sessions: its search becomes Session 1 here, before
  // anything reads the list.
  await ensureLegacySession(request.id);
  const sessions = await listProjectSessions(userId, request.id);

  const wanted =
    sessionParam && sessionParam !== "new"
      ? await getOwnedSession(userId, request.id, sessionParam)
      : null;
  // An unknown or foreign id falls back to the latest, never to an error page
  // that confirms the id exists somewhere.
  const selectedId =
    sessionParam === "new" ? null : (wanted?.id ?? sessions[0]?.id ?? null);
  const selected =
    wanted ?? (selectedId ? await getOwnedSession(userId, request.id, selectedId) : null);

  const [messageRows, matchData, assessments, unassigned] = await Promise.all([
    selected ? listSessionMessages(selected.id) : Promise.resolve([]),
    loadRequestMatches(request.id, userId, { sessionId: selected?.id ?? null }),
    listProjectAssessments(userId, request.id),
    listUnassignedAssessments(userId),
  ]);

  const spec: JobSpec = selected ? specFromJson(selected.spec) : {};
  const matches = matchData?.matches ?? [];
  const projectName = request.name?.trim() || request.title;

  const messages = messageRows.map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as
      | "user"
      | "assistant",
    content: m.content,
    options: Array.isArray(m.options)
      ? (m.options as { label: string; value: string }[])
      : null,
  }));

  const summary = [spec.title, (spec.mustHaveStack ?? []).join(", "), spec.seniority]
    .filter(Boolean)
    .join(" · ");

  return (
    <ScoutChat
      // A different session is a different conversation: remount rather than
      // let one session's local state leak into the next.
      key={selected?.id ?? "new"}
      persist
      initialRequestId={request.id}
      initialSessionId={selected?.id ?? null}
      initialMessages={messages}
      initialSpec={spec}
      initialSummary={summary || selected?.title || projectName}
      projectName={projectName}
      results={matches}
      resultsCartCount={matchData?.cartCount ?? 0}
      alertWhenAvailable={request.alertWhenAvailable}
      initialSearched={Boolean(selected?.lastRunAt) || matches.length > 0}
      projectSessions={sessions.map((s) => ({
        id: s.id,
        ordinal: s.ordinal,
        title: s.title,
        matchCount: s.matchCount,
        createdAt: s.createdAt,
      }))}
      projectAssessments={assessments}
      unassignedAssessments={unassigned}
    />
  );
}
