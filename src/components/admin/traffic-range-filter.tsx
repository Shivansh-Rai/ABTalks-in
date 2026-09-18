"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Plan 151 — filter chrome for the admin GA traffic section.
 *
 * Three URL-synced controls (all in `?ga_*`):
 *   - `ga_range`  7d / 30d / 90d / 365d
 *   - `ga_device` mobile / desktop / tablet / all
 *   - `ga_country` two-letter or short name / all
 *
 * State lives entirely in the URL so the Server Component parent re-fetches
 * on any change and the view is shareable. `useTransition` keeps the UI from
 * feeling stuck while the server round-trips.
 */

const RANGE_OPTIONS: Array<{ value: GaRangeKey; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "365d", label: "1 year" },
];

const DEVICE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All devices" },
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
];

export type GaRangeKey = "7d" | "30d" | "90d" | "365d";

export function TrafficRangeFilter({
  value,
  device,
  country,
  countryOptions,
}: {
  value: GaRangeKey;
  device: string;
  country: string;
  countryOptions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(next: Record<string, string | null>) {
    const search = new URLSearchParams(params?.toString() ?? "");
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "" || value === "all") search.delete(key);
      else search.set(key, value);
    }
    const qs = search.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const hasActiveFilter =
    (device && device !== "all") || (country && country !== "all");

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Range
        </span>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-card/60 p-1">
          {RANGE_OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ ga_range: option.value })}
                className={
                  active
                    ? "rounded-md bg-[#03535F] px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-md px-3 py-1 text-xs font-medium text-foreground/70 hover:bg-muted"
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="ga-device"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Device
        </label>
        <select
          id="ga-device"
          value={device}
          onChange={(event) => update({ ga_device: event.target.value })}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {DEVICE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="ga-country"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Country
        </label>
        <select
          id="ga-country"
          value={country}
          onChange={(event) => update({ ga_country: event.target.value })}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="all">All countries</option>
          {countryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => update({ ga_device: null, ga_country: null })}
          className="text-xs font-medium text-[#03535F] underline-offset-2 hover:underline"
        >
          Clear filters
        </button>
      )}

      {isPending && (
        <span className="text-xs text-muted-foreground">Refreshing…</span>
      )}
    </div>
  );
}
