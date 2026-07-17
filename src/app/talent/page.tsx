import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { requireRecruiter } from "@/lib/program-auth";
import {
  getPublishedCohort,
  getTalentPool,
} from "@/features/talent-pool/pool";
import { PoolFilters } from "@/components/talent/pool-filters";
import { MemberCard } from "@/components/talent/member-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<{
    q?: string;
    skills?: string;
    minYears?: string;
    minScore?: string;
    page?: string;
  }>;
};

export default async function TalentPoolPage({ searchParams }: Props) {
  await requireRecruiter();
  const session = await auth();
  const params = await searchParams;
  const cohort = await getPublishedCohort();

  if (!cohort) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Talent pool
        </h1>
        <p className="text-sm text-muted-foreground">
          Cohort results have not been published yet. You&apos;ll be able to
          browse ranked graduates once the program team publishes results.
        </p>
      </div>
    );
  }

  const skills = params.skills
    ? params.skills.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const poolResult = await getTalentPool(session!.user!.id, {
    q: params.q,
    skills,
    minYears: params.minYears ? Number(params.minYears) : undefined,
    minScore: params.minScore ? Number(params.minScore) : undefined,
    page: params.page ? Number(params.page) : 1,
  });

  if (!poolResult.ok) {
    return (
      <p className="text-sm text-muted-foreground">{poolResult.message}</p>
    );
  }

  const pool = poolResult.data;

  const totalPages = Math.max(1, Math.ceil(pool.total / pool.pageSize));
  const page = pool.page;

  function pageHref(targetPage: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.skills) sp.set("skills", params.skills);
    if (params.minYears) sp.set("minYears", params.minYears);
    if (params.minScore) sp.set("minScore", params.minScore);
    sp.set("page", String(targetPage));
    return `/talent?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Talent pool
        </h1>
        <p className="text-sm text-muted-foreground">
          {pool.cohortName} · {pool.total} graduates ranked by verified performance
        </p>
      </header>

      <Suspense fallback={<div className="h-24 rounded-xl border" />}>
        <PoolFilters />
      </Suspense>

      {pool.members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No members match your filters.
        </p>
      ) : (
        <div className="grid gap-4">
          {pool.members.map((member) => (
            <MemberCard key={member.memberId} member={member} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageHref(page + 1)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
