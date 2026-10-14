"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type {
  HackathonMasterCohort,
  HackathonMasterEventOption,
} from "@/features/hackathon/get-master-students";

const FILTER_OPTIONS: { value: HackathonMasterCohort; label: string }[] = [
  { value: "all", label: "All" },
  { value: "old", label: "OLD" },
  { value: "new", label: "NEW" },
];

/**
 * Shared by the hackathon master roster and the videothon roster. Only the
 * hackathon roster spans several events, so it alone passes `eventOptions`;
 * without them the event row is not rendered.
 */
export function HackathonMasterFilters({
  eventOptions = [],
}: {
  eventOptions?: HackathonMasterEventOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCohort = useMemo((): HackathonMasterCohort => {
    const raw = searchParams.get("cohort");
    if (raw === "old" || raw === "new") return raw;
    return "all";
  }, [searchParams]);

  const currentEvent = useMemo((): string => {
    const raw = searchParams.get("event");
    if (raw && eventOptions.some((opt) => opt.value === raw)) return raw;
    return "all";
  }, [searchParams, eventOptions]);

  function push(key: "cohort" | "event", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-sm">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => push("cohort", opt.value)}
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

      {eventOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-sm">
          {eventOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => push("event", opt.value)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                currentEvent === opt.value
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
