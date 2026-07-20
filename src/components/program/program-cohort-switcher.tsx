"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProgramCohortStatus } from "@prisma/client";

export type CohortSwitcherItem = {
  id: string;
  name: string;
  status: ProgramCohortStatus;
  joinCode: string;
};

export function ProgramCohortSwitcher({
  cohorts,
}: {
  cohorts: CohortSwitcherItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (cohorts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No cohorts yet — create one on Overview.
      </p>
    );
  }

  const active = cohorts.filter((c) => c.status !== "ARCHIVED");
  const archived = cohorts.filter((c) => c.status === "ARCHIVED");
  const fallbackId = active[0]?.id ?? cohorts[0]?.id ?? "";
  const selectedId = searchParams.get("cohortId") ?? fallbackId;
  const selected = cohorts.find((c) => c.id === selectedId);

  function onChange(cohortId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("cohortId", cohortId);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="cohort-switcher" className="text-sm text-muted-foreground">
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
      {selected && (
        <span className="font-mono text-xs text-muted-foreground">
          {selected.joinCode}
        </span>
      )}
    </div>
  );
}
