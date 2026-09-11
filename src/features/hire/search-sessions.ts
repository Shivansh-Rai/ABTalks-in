import "server-only";

import { Prisma, type TalentMatchTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isUniqueViolation } from "@/repositories/credits";
import { jobSpecSchema, type JobSpec } from "@/lib/validations/hire";

/**
 * Search sessions inside a project (plan 133).
 *
 * A project is a `TalentRequest`: a persistent hiring container. A session is
 * one search performed inside it — its own prompt, brief, chat and results.
 * "New search" adds a session; nothing here ever rewrites another session's
 * brief, chat or results.
 *
 * What stays project-level on purpose: the shortlist. Decisions live on
 * `TalentRequestMatch` (one row per project × candidate), so a candidate
 * shortlisted while looking at session 1 is still shortlisted in session 2,
 * and never appears in another project.
 *
 * Every read here is scoped through `request.recruiterUserId`, so another
 * recruiter's project or session id is simply not found.
 */

export const SESSION_TITLE_MAX = 80;

/** The same select `dbToSpec` in hire-actions reads, for the legacy brief. */
export const REQUEST_SPEC_SELECT = {
  title: true,
  seniority: true,
  openings: true,
  mustHaveStack: true,
  niceToHaveStack: true,
  evidencePriority: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  workMode: true,
  locationCity: true,
  employmentType: true,
  noticePeriodDays: true,
  minExperience: true,
  maxExperience: true,
  requiresDegree: true,
  extra: true,
} as const satisfies Prisma.TalentRequestSelect;

type RequestSpecRow = Prisma.TalentRequestGetPayload<{
  select: typeof REQUEST_SPEC_SELECT;
}>;

const blank = (s: string | null | undefined) => {
  const t = s?.trim();
  return t ? t : undefined;
};

/** A project's stored brief as a JobSpec. Never throws: a bad row reads as empty. */
export function specFromRequestRow(row: RequestSpecRow): JobSpec {
  const parsed = jobSpecSchema.safeParse({
    title: blank(row.title),
    seniority: row.seniority,
    openings: row.openings,
    mustHaveStack: row.mustHaveStack,
    niceToHaveStack: row.niceToHaveStack,
    evidencePriority: row.evidencePriority,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: blank(row.salaryCurrency),
    salaryPeriod: row.salaryPeriod === "MONTHLY" ? "MONTHLY" : "ANNUAL",
    workMode: row.workMode,
    locationCity: row.locationCity,
    employmentType: row.employmentType,
    noticePeriodDays: row.noticePeriodDays,
    minExperience: row.minExperience,
    maxExperience: row.maxExperience,
    requiresDegree: row.requiresDegree,
    extra:
      row.extra && typeof row.extra === "object"
        ? (row.extra as Record<string, unknown>)
        : undefined,
  });
  return parsed.success ? parsed.data : {};
}

/** A session's stored brief. Never throws: a bad value reads as empty. */
export function specFromJson(value: unknown): JobSpec {
  const parsed = jobSpecSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function specToJson(spec: JobSpec): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(spec)) as Prisma.InputJsonValue;
}

/** The recruiter's opening words, trimmed to a sidebar-sized title. */
export function sessionTitleFrom(text: string | null | undefined, ordinal: number): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return `Search ${ordinal}`;
  return flat.length > SESSION_TITLE_MAX
    ? `${flat.slice(0, SESSION_TITLE_MAX - 1)}…`
    : flat;
}

/**
 * Scoring as one session saw it. Identity (source, programMemberId) and the
 * recruiter's decision stay on the project-level `TalentRequestMatch` row.
 */
export type SessionSnapshotRow = {
  candidateUserId: string;
  score: number;
  tier: TalentMatchTier;
  scoreBreakdown: unknown;
  evidence: unknown;
  rationale: string | null;
  gaps: string[];
  availabilityUnknown: boolean;
};

export function snapshotFromJson(value: unknown): Map<string, SessionSnapshotRow> {
  const out = new Map<string, SessionSnapshotRow>();
  if (!Array.isArray(value)) return out;
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<SessionSnapshotRow>;
    if (typeof row.candidateUserId !== "string" || typeof row.score !== "number") continue;
    out.set(row.candidateUserId, {
      candidateUserId: row.candidateUserId,
      score: row.score,
      tier: (row.tier ?? "NONE") as TalentMatchTier,
      scoreBreakdown: row.scoreBreakdown ?? {},
      evidence: row.evidence ?? {},
      rationale: typeof row.rationale === "string" ? row.rationale : null,
      gaps: Array.isArray(row.gaps) ? row.gaps.filter((g): g is string => typeof g === "string") : [],
      availabilityUnknown: row.availabilityUnknown !== false,
    });
  }
  return out;
}

type Db = Prisma.TransactionClient | typeof prisma;

async function nextOrdinal(db: Db, requestId: string): Promise<number> {
  const top = await db.talentSearchSession.findFirst({
    where: { requestId },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });
  return (top?.ordinal ?? 0) + 1;
}

/**
 * A new session in a project the caller has ALREADY verified they own.
 *
 * The ordinal is `max + 1` and unique per project, so two simultaneous "New
 * search" sends can collide; the loser takes the next number. Bounded, so a
 * pathological race fails loudly instead of spinning.
 */
export async function createSession(input: {
  requestId: string;
  title: string | null;
  spec?: JobSpec;
}): Promise<{ id: string; ordinal: number }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const ordinal = await nextOrdinal(prisma, input.requestId);
    try {
      return await prisma.talentSearchSession.create({
        data: {
          requestId: input.requestId,
          ordinal,
          title: sessionTitleFrom(input.title, ordinal),
          spec: specToJson(input.spec ?? {}),
        },
        select: { id: true, ordinal: true },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Could not allocate a search session number");
}

/**
 * Files a project's pre-session data under Session 1 (plan 133, D-1).
 *
 * Runs only when the project has NO session yet but does have history —
 * a project from before sessions existed, or one written by a path that does
 * not know about sessions (guest adoption, sample demand). It never invents a
 * session for an empty project: a new, named project has none until its first
 * search.
 *
 * Idempotent. The unique `(requestId, ordinal)` means two callers racing here
 * create one Session 1; the loser reads the winner's.
 */
export async function ensureLegacySession(requestId: string): Promise<string | null> {
  const existing = await prisma.talentSearchSession.findFirst({
    where: { requestId },
    select: { id: true },
  });
  if (existing) return null;

  const project = await prisma.talentRequest.findUnique({
    where: { id: requestId },
    select: {
      ...REQUEST_SPEC_SELECT,
      name: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      messages: {
        where: { role: "user" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
      _count: { select: { messages: true, matches: true } },
      matches: {
        orderBy: { score: "desc" },
        select: {
          candidateUserId: true,
          score: true,
          tier: true,
          scoreBreakdown: true,
          evidence: true,
          rationale: true,
          gaps: true,
          availabilityUnknown: true,
        },
      },
    },
  });
  if (!project) return null;
  if (project._count.messages === 0 && project._count.matches === 0) return null;

  const snapshot: SessionSnapshotRow[] = project.matches.map((m) => ({
    candidateUserId: m.candidateUserId,
    score: m.score,
    tier: m.tier,
    scoreBreakdown: m.scoreBreakdown,
    evidence: m.evidence,
    rationale: m.rationale,
    gaps: m.gaps,
    availabilityUnknown: m.availabilityUnknown,
  }));
  const searched = project.matches.length > 0 || project.status !== "DRAFT";

  try {
    const session = await prisma.$transaction(
      async (tx) => {
        const created = await tx.talentSearchSession.create({
          data: {
            requestId,
            ordinal: 1,
            title: sessionTitleFrom(
              project.messages[0]?.content ?? project.name ?? project.title,
              1,
            ),
            spec: specToJson(specFromRequestRow(project)),
            resultCandidateIds: snapshot.map((s) => s.candidateUserId),
            resultSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            matchCount: searched ? snapshot.length : null,
            lastRunAt: searched ? project.updatedAt : null,
            createdAt: project.createdAt,
          },
          select: { id: true },
        });
        await tx.talentRequestMessage.updateMany({
          where: { requestId, sessionId: null },
          data: { sessionId: created.id },
        });
        return created;
      },
      { maxWait: 20_000, timeout: 20_000 },
    );
    return session.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return null;
  }
}

/** A session, only if it sits in a project this recruiter owns. */
export async function getOwnedSession(
  recruiterUserId: string,
  requestId: string,
  sessionId: string,
) {
  return prisma.talentSearchSession.findFirst({
    where: { id: sessionId, requestId, request: { recruiterUserId } },
    select: {
      id: true,
      ordinal: true,
      title: true,
      spec: true,
      resultCandidateIds: true,
      resultSnapshot: true,
      overallGap: true,
      matchCount: true,
      lastRunAt: true,
    },
  });
}

export type SessionSummary = {
  id: string;
  ordinal: number;
  title: string;
  matchCount: number | null;
  /** ISO string. */
  createdAt: string;
};

/** Every session in a project this recruiter owns, newest first. */
export async function listProjectSessions(
  recruiterUserId: string,
  requestId: string,
): Promise<SessionSummary[]> {
  const rows = await prisma.talentSearchSession.findMany({
    where: { requestId, request: { recruiterUserId } },
    orderBy: { ordinal: "desc" },
    select: { id: true, ordinal: true, title: true, matchCount: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** A session's own chat, oldest first. */
export async function listSessionMessages(sessionId: string, take = 100) {
  return prisma.talentRequestMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take,
    select: { role: true, content: true, options: true },
  });
}

/** Saves what one run of this session returned, without touching any other session. */
export async function recordSessionRun(input: {
  sessionId: string;
  rows: SessionSnapshotRow[];
  overallGap: string;
  matchCount: number;
}): Promise<void> {
  await prisma.talentSearchSession.update({
    where: { id: input.sessionId },
    data: {
      resultCandidateIds: input.rows.map((r) => r.candidateUserId),
      resultSnapshot: input.rows as unknown as Prisma.InputJsonValue,
      overallGap: input.overallGap,
      matchCount: input.matchCount,
      lastRunAt: new Date(),
    },
    select: { id: true },
  });
}

/**
 * Every candidate that any session of this project is showing. An UNDECIDED
 * project match outside this set belongs to no search any more and may go;
 * one inside it must stay, or reopening an older session would lose results.
 */
export async function candidatesInAnySession(requestId: string): Promise<Set<string>> {
  const rows = await prisma.talentSearchSession.findMany({
    where: { requestId },
    select: { resultCandidateIds: true },
  });
  return new Set(rows.flatMap((r) => r.resultCandidateIds));
}

/**
 * Drop UNDECIDED project matches that no session of this project shows any
 * more. SHORTLISTED and REJECTED rows are never touched (T-044 / T-149), and a
 * candidate still shown by ANY session stays, so reopening an older search
 * never finds its results gone. Call after `recordSessionRun`.
 */
export async function pruneUndecidedOutsideSessions(requestId: string): Promise<number> {
  const stillShown = [...(await candidatesInAnySession(requestId))];
  const removed = await prisma.talentRequestMatch.deleteMany({
    where: {
      requestId,
      decision: "UNDECIDED",
      ...(stillShown.length > 0 ? { candidateUserId: { notIn: stillShown } } : {}),
    },
  });
  return removed.count;
}

/**
 * "New project" (plan 133): a named, persistent project, created now — before
 * any search. It has no session until something is searched in it.
 */
export async function createProject(
  recruiterUserId: string,
  name: string,
): Promise<{ id: string }> {
  return prisma.talentRequest.create({
    data: {
      recruiterUserId,
      status: "DRAFT",
      // The role is unanswered until the first search asks for it.
      title: "",
      name: name.trim(),
    },
    select: { id: true },
  });
}
