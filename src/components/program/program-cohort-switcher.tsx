"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProgramCohortStatus } from "@prisma/client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CohortSwitcherItem = {
  id: string;
  name: string;
  status: ProgramCohortStatus;
  joinCode: string;
  requiresJoinCode: boolean;
};

export function ProgramCohortSwitcher({
  cohorts,
}: {
  cohorts: CohortSwitcherItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = cohorts.filter((c) => c.status !== "ARCHIVED");
  const archived = cohorts.filter((c) => c.status === "ARCHIVED");
  const fallbackId = active[0]?.id ?? cohorts[0]?.id ?? "";
  const selectedId = searchParams.get("cohortId") ?? fallbackId;
  const selected = cohorts.find((c) => c.id === selectedId);

  const createHref = selectedId
    ? `/admin/program?create=1&cohortId=${encodeURIComponent(selectedId)}`
    : "/admin/program?create=1";

  function onChange(cohortId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("cohortId", cohortId);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cohorts yet.</p>
        ) : (
          <>
            <label
              htmlFor="cohort-switcher"
              className="text-sm text-muted-foreground"
            >
              Cohort
            </label>
            <select
              id="cohort-switcher"
              className="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm"
              value={selectedId}
              onChange={(e) => onChange(e.target.value)}
            >
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.status}
                </option>
              ))}
              {archived.length > 0 && (
                <optgroup label="Archived">
                  {archived.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · ARCHIVED
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {selected &&
              (selected.requiresJoinCode ? (
                <span className="font-mono text-xs text-muted-foreground">
                  {selected.joinCode}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Open · no code
                </span>
              ))}
          </>
        )}
      </div>
      <Link
        href={createHref}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}
      >
        Create new cohort
      </Link>
    </div>
  );
}
