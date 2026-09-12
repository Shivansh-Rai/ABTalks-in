"use client";

import { useCallback, useEffect, useRef } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { FieldIssue } from "@/app/actions/candidate-profile-actions";

/**
 * Puts a server validation failure under the field it is about.
 *
 * The profile used to answer every rejected save with one toast in the corner
 * of the screen. It named the entry ("Entry 2: …") because that was the only
 * way to say where the problem was, it covered whatever was behind it, and it
 * left the offending input looking perfectly fine. The schemas have always
 * known the field — this carries that through to the form.
 *
 * Two things make the error behave the way a field error should:
 *
 *  - it is placed on the exact path the schema named, so it renders under that
 *    input and nowhere else;
 *  - it is cleared the moment that field changes, because a server error is a
 *    statement about the value that was sent, not about the one being typed.
 *
 * Paths that the form does not have are reported back as unplaced, so the
 * caller can still say something rather than swallowing the failure.
 */

/** Does `path` address something this form actually holds? */
function pathExists(values: unknown, path: string): boolean {
  let cursor: unknown = values;
  for (const key of path.split(".")) {
    if (cursor === null || typeof cursor !== "object") return false;
    cursor = (cursor as Record<string, unknown>)[key];
    if (cursor === undefined) return false;
  }
  return true;
}

export type IssueSink = (issues: readonly FieldIssue[]) => number;

export function useServerFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  /** Schema field → form field, where the two spellings differ. */
  alias?: Readonly<Record<string, string>>,
): IssueSink {
  const { setError, clearErrors, getValues, watch } = form;
  /** Paths this hook put an error on, so it only clears its own. */
  const owned = useRef(new Set<string>());

  useEffect(() => {
    const subscription = watch((_values, { name }) => {
      if (!name) return;
      if (owned.current.delete(name)) clearErrors(name as Path<T>);
    });
    return () => subscription.unsubscribe();
  }, [watch, clearErrors]);

  return useCallback(
    (issues) => {
      const values = getValues();
      let placed = 0;
      for (const issue of issues) {
        const path = alias?.[issue.path] ?? issue.path;
        if (!pathExists(values, path)) continue;
        setError(
          path as Path<T>,
          { type: "server", message: issue.message },
          // Only the first one pulls the view; the rest just light up.
          placed === 0 ? { shouldFocus: true } : undefined,
        );
        owned.current.add(path);
        placed += 1;
      }
      return placed;
    },
    [alias, getValues, setError],
  );
}

/* ─── Client-side date rules ───────────────────────────────────────────────
   The same comparisons the schemas make, run as the candidate types so the
   message appears (and clears) without a round trip. Kept here, once, because
   three sections need the identical rule and a fourth will.
   ------------------------------------------------------------------------- */

/** Months since year 0, so two month/year pairs can be compared as numbers. */
function monthIndex(year: number, month: number | null, fallback: number): number {
  return year * 12 + (month ?? fallback);
}

/**
 * `null` when the pair is fine or incomplete — an unfinished date is not a
 * wrong one, and saying so while someone is still picking is noise.
 */
export function endBeforeStart(
  start: { month: number | null; year: number | null },
  end: { month: number | null; year: number | null },
  message: string,
): string | null {
  if (start.year === null || end.year === null) return null;
  const from = monthIndex(start.year, start.month, 1);
  const to = monthIndex(end.year, end.month, 12);
  return to < from ? message : null;
}

/** A date that has not happened yet, for things that can only be in the past. */
export function isFuture(month: number | null, year: number | null): boolean {
  if (year === null) return false;
  const now = new Date();
  return (
    monthIndex(year, month, 1) >
    monthIndex(now.getFullYear(), now.getMonth() + 1, 1)
  );
}
