import "server-only";
import { prisma } from "@/lib/db";
import { loadRequestMatches } from "@/features/hire/load-request-matches";
import { jobSpecSchema, type JobSpec } from "@/lib/validations/hire";
import type { MatchCardData, MatchTriage } from "@/components/hire/match-card";

/**
 * Admin read-only inspection of a recruiter's talent project (T-278 / TC-A-016).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS MODULE IS A READ. IT MUST NEVER WRITE.
 *
 * It is the first admin carve-out to R1 (recruiter isolation, plan 115 §10),
 * signed on the conditions that it performs no mutation, creates no server
 * action, and leaves every recruiter-scoped predicate untouched. Adding a write
 * here — including an innocent-looking `lastViewedAt` stamp or an analytics row
 * — breaks the term the carve-out was granted on.
 *
 * The recruiter's own path is unchanged: `hire/[requestId]/page.tsx` and
 * `loadRequestMatches` keep their `recruiterUserId` predicates, so recruiter A
 * still cannot reach recruiter B's project. Admin reaches it through this
 * separate function, gated by `requireAdmin()` at the page.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The reuse trick: rather than re-implementing the query without its ownership
 * filter, resolve the OWNER first and then call `loadRequestMatches` unchanged
 * with the owner's id. The admin therefore sees byte-for-byte what the
 * recruiter sees — which is the support use case — and the loader keeps its
 * scoping for everyone else.
 */

export type InspectedMatch = MatchCardData & MatchTriage;

export type TalentProjectInspection = {
  id: string;
  /** The recruiter's own label, falling back to the Scout-captured title. */
  label: string;
  title: string;
  status: string;
  archivedAt: Date | null;
  /**
   * When the OWNING RECRUITER last opened it. Displayed, never written —
   * an admin visit must not move it, or the recruiter's "new since your last
   * visit" badges are destroyed.
   */
  lastViewedAt: Date | null;
  alertWhenAvailable: boolean;
  createdAt: Date;
  owner: {
    userId: string;
    name: string | null;
    email: string | null;
    company: string | null;
  };
  spec: JobSpec;
  /** The Scout transcript, oldest first. */
  messages: { role: string; content: string; createdAt: Date }[];
  /**
   * Triage buckets. `decision` is the ONLY pipeline state that exists:
   * `PipelineStage` / `TalentListItem` are schema-only with no reader, writer
   * or UI anywhere in `src/`, so there is nothing else to show (T-278 §3).
   */
  shortlisted: InspectedMatch[];
  rejected: InspectedMatch[];
  undecided: InspectedMatch[];
  /** Every match the recruiter can currently see, ranked. */
  matches: InspectedMatch[];
  counts: {
    total: number;
    shortlisted: number;
    rejected: number;
    undecided: number;
    viewed: number;
  };
};

/** Prisma stores "" on a draft with no role yet; jobSpecSchema rejects it. */
function blank(s: string | null | undefined): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

/**
 * One row per project, across every recruiter.
 *
 * Ordered on `@@index([status, createdAt(sort: Desc)])` (schema.prisma:1205).
 * Deliberately does NOT filter `archivedAt` — there is no index on it, and an
 * archived project is exactly the kind of thing support is asked about.
 */
export async function listTalentProjectsForAdmin(limit = 100): Promise<
  {
    id: string;
    label: string;
    status: string;
    archivedAt: Date | null;
    createdAt: Date;
    matchCount: number;
    owner: { name: string | null; email: string | null };
  }[]
> {
  const rows = await prisma.talentRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      title: true,
      status: true,
      archivedAt: true,
      createdAt: true,
      recruiter: { select: { name: true, email: true } },
      _count: { select: { matches: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    label: r.name?.trim() || r.title || "Untitled project",
    status: r.status,
    archivedAt: r.archivedAt,
    createdAt: r.createdAt,
    matchCount: r._count.matches,
    owner: { name: r.recruiter?.name ?? null, email: r.recruiter?.email ?? null },
  }));
}

/**
 * The full read-only picture of one project, or `null` if there is no such id.
 *
 * `null` becomes `notFound()` at the page — never a 403. Ids are not
 * enumerable, and a 403 would confirm that an id exists.
 */
export async function inspectTalentProject(
  requestId: string,
): Promise<TalentProjectInspection | null> {
  const request = await prisma.talentRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      recruiterUserId: true,
      name: true,
      title: true,
      status: true,
      archivedAt: true,
      createdAt: true,
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
      recruiter: {
        select: { id: true, name: true, email: true, recruiterProfile: { select: { company: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50,
        select: { role: true, content: true, createdAt: true },
      },
    },
  });
  if (!request) return null;

  // The owner's id, not the admin's. This is what makes the reuse below safe:
  // `loadRequestMatches` keeps its `recruiterUserId` filter and simply matches.
  const data = await loadRequestMatches(requestId, request.recruiterUserId);
  if (!data) return null;

  const parsed = jobSpecSchema.safeParse({
    title: blank(request.title),
    seniority: request.seniority,
    openings: request.openings,
    mustHaveStack: request.mustHaveStack,
    niceToHaveStack: request.niceToHaveStack,
    evidencePriority: request.evidencePriority,
    salaryMin: request.salaryMin,
    salaryMax: request.salaryMax,
    salaryCurrency: blank(request.salaryCurrency),
    salaryPeriod: request.salaryPeriod === "MONTHLY" ? "MONTHLY" : "ANNUAL",
    workMode: request.workMode,
    locationCity: request.locationCity,
    employmentType: request.employmentType,
    noticePeriodDays: request.noticePeriodDays,
    minExperience: request.minExperience,
    maxExperience: request.maxExperience,
    requiresDegree: request.requiresDegree,
    extra:
      request.extra && typeof request.extra === "object"
        ? (request.extra as Record<string, unknown>)
        : undefined,
  });

  const matches = data.matches;
  const shortlisted = matches.filter((m) => m.decision === "SHORTLISTED");
  const rejected = matches.filter((m) => m.decision === "REJECTED");
  const undecided = matches.filter((m) => m.decision === "UNDECIDED");

  return {
    id: request.id,
    label: data.name?.trim() || data.title || "Untitled project",
    title: data.title,
    status: data.status,
    archivedAt: data.archivedAt,
    lastViewedAt: data.lastViewedAt,
    alertWhenAvailable: data.alertWhenAvailable,
    createdAt: request.createdAt,
    owner: {
      userId: request.recruiterUserId,
      name: request.recruiter?.name ?? null,
      email: request.recruiter?.email ?? null,
      company: request.recruiter?.recruiterProfile?.company ?? null,
    },
    spec: parsed.success ? parsed.data : {},
    messages: request.messages,
    shortlisted,
    rejected,
    undecided,
    matches,
    counts: {
      total: matches.length,
      shortlisted: shortlisted.length,
      rejected: rejected.length,
      undecided: undecided.length,
      viewed: matches.filter((m) => m.viewedAt != null).length,
    },
  };
}
