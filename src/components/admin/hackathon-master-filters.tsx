"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { HackathonMasterCohort } from "@/features/hackathon/get-master-students";

const FILTER_OPTIONS: { value: HackathonMasterCohort; label: string }[] = [
  { value: "all", label: "All" },
  { value: "old", label: "OLD" },
  { value: "new", label: "NEW" },
];

export function HackathonMasterFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCohort = useMemo((): HackathonMasterCohort => {
    const raw = searchParams.get("cohort");
    if (raw === "old" || raw === "new") return raw;
    return "all";
  }, [searchParams]);

  function setCohort(cohort: HackathonMasterCohort) {
    const params = new URLSearchParams(searchParams.toString());
    if (cohort === "all") params.delete("cohort");
    else params.set("cohort", cohort);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-sm">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setCohort(opt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            currentCohort === opt.value
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
