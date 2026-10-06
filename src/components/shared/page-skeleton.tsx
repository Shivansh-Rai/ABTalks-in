import { Skeleton } from "@/components/ui/skeleton";

/*
 * Plan 168. The body of every segment `loading.tsx`, so those files stay three
 * lines each.
 *
 * Server component by design: a `loading.tsx` renders before hydration, and
 * marking this `"use client"` would ship a bundle for markup that never
 * changes.
 */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10" aria-busy="true">
      <span role="status" className="sr-only">
        Loading
      </span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
