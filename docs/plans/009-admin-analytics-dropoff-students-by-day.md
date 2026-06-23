# 009 — Admin analytics: day-wise drop-off student list + CSV export

## 1. Goal
Surface a per-day breakdown of **dropped-off students** in the admin
analytics page, with a CSV export of the full list. Drop-off ≠ missing:
a student is "dropped off" if their `lastSubmittedDay = N` AND they are now
≥ 3 IST days behind without catching up (or their enrollment is `ABANDONED`).
`COMPLETED` enrollments are always excluded.

The output is a single flat table sorted by `lastSubmittedDay ASC`
(earliest droppers first), filterable by domain, with a "Download CSV"
button. Read-only — no bulk actions in this plan.

**View limit:** the on-screen table renders only the **first 10 rows**
(earliest droppers after sort). The CSV export is unrestricted — it
includes every dropped-off student matching the current domain filter.
The header above the table shows `Showing 10 of N students` so the admin
knows there are more in the CSV.

## 2. Current behavior

### What exists today
- `/admin/analytics` ([src/app/admin/analytics/page.tsx](src/app/admin/analytics/page.tsx)) renders a `<AnalyticsRangeFilter>` and `<AnalyticsDashboardLoader>` (charts).
- The "Drop-off" chart in `getAnalyticsData()` ([src/features/admin/get-analytics-data.ts:157-161](src/features/admin/get-analytics-data.ts:157)) is a **milestone funnel** — counts enrollments that reached ≥ Day 1, 7, 14, 30, 45, 60. No per-day breakdown, no student list.
- `getMissingByDayCounts` / `getMissingStudentsForDay` ([src/features/admin/get-missing-by-day.ts](src/features/admin/get-missing-by-day.ts)) report **missed days** — a student can be "missing on Day 5" but back on Day 6, so this is NOT drop-off.
- CSV plumbing exists: `lib/csv.ts` exports pure `toCSV()` and DOM-side `downloadCSV()`. The existing `MissingByDayView` ([src/components/admin/missing-by-day-view.tsx:7-10](src/components/admin/missing-by-day-view.tsx:7)) uses a `useTransition` + server-action pattern to fetch+convert+download.

### Where this plan slots in
- New backend reader (separate file from the existing missing/analytics readers — different semantics, easier to reason about).
- New Client view rendered as an additional section on `/admin/analytics`, below the existing dashboard loader.
- No new server action needed for the CSV — the Server Component already loads the data and passes it to the Client view, which converts and downloads in-place using the pure `toCSV()` helper. Avoids a second DB round-trip per export click.

### Drop-off definition (from user input)
Include a row when, for an enrollment:
1. `status === "ABANDONED"` → always include, regardless of gap. OR
2. `status === "ACTIVE"` AND `(currentDay - effectiveLastDay) >= 3`, where:
   - `currentDay = getCurrentDayNumber(enrollment, enrollment.challenge)` — IST, cohort-aware.
   - `effectiveLastDay = lastSubmittedDay ?? 0` — null means they enrolled but never submitted; treat as Day 0 so currentDay ≥ 3 already triggers inclusion.
3. `status === "COMPLETED"` → always exclude.

The relaxation window (plan 004) is compatible: when a student catches up,
`lastSubmittedDay` advances (in `submit-day.ts`), the gap shrinks, and they
drop out of this list automatically. No special-case needed here.

## 3. Files to touch

| Path | Status | Note |
|---|---|---|
| `src/features/admin/get-dropoff-by-day.ts` | [new] | Server-only reader. One exported function `getDropoffStudents({ domain })` returning enriched rows with everything needed for both the table render and the CSV. Includes `currentDay` and `daysInactive` derived per-row using `getCurrentDayNumber` (cohort-aware via challenge.startsAt). |
| `src/components/admin/dropoff-students-view.tsx` | [new] | `"use client"` table view. Renders desktop table + mobile card stack (match the `MissingByDayView` responsive pattern at lines 67-...). "Download CSV" button uses `toCSV(rows)` + `downloadCSV(filename, csv)` directly from props — no server action. Domain filter dropdown updates `?dropoff_domain=...` via `useRouter`/Link so the Server parent re-fetches. |
| `src/app/admin/analytics/page.tsx` | [edit] | Read `?dropoff_domain=...` from searchParams. Call `getDropoffStudents({ domain })`. Render `<DropoffStudentsView rows={...} domain={...} />` below the existing `<AnalyticsDashboardLoader />`. Wrap in a section heading "Drop-off students (day-wise)". |
| `src/app/actions/admin-export-actions.ts` | (no edit) | Not needed — CSV is built client-side from props. Avoids a second DB query per export. |
| `src/lib/csv.ts` | (no edit) | `toCSV` + `downloadCSV` already cover the use case. |
| `prisma/schema.prisma` | (no edit) | No schema change. |

## 4. Server vs Client
- `get-dropoff-by-day.ts` — Server (imports `@/lib/db`, no Client usage).
- `admin/analytics/page.tsx` — Server Component (existing).
- `dropoff-students-view.tsx` — Client (`"use client"`) because:
  - It triggers the DOM-only `downloadCSV()` (uses `document`, `URL.createObjectURL`).
  - It can use `useTransition` for a "Downloading…" state.
  - It uses `useRouter`/`useSearchParams` for the domain filter URL update.
- Server → Client props are all plain JSON-serializable: strings, numbers, ISO date strings, the `Domain` enum string. **Do NOT** pass `Date` instances, Prisma model objects, or React components across the boundary. Stringify dates in `get-dropoff-by-day.ts` before returning.

## 5. Steps

### Step 1 — Backend reader `get-dropoff-by-day.ts`

Create `src/features/admin/get-dropoff-by-day.ts`:

```ts
import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentDayNumber } from "@/lib/date-utils";

const DROPOFF_GAP_DAYS = 3;

type Filters = {
  domain?: Domain | "ALL";
};

export type DropoffStudentRow = {
  enrollmentId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  userType: "STUDENT" | "PROFESSIONAL" | "";
  college: string;
  organization: string;
  domain: Domain;
  status: EnrollmentStatus;
  startedAtIso: string;
  lastSubmittedDay: number | null;
  lastSubmissionDateIso: string | null;
  currentDay: number;
  daysInactive: number;
};

export async function getDropoffStudents(
  filters: Filters,
): Promise<DropoffStudentRow[]> {
  const domain =
    filters.domain && filters.domain !== "ALL" ? filters.domain : undefined;

  // Fetch ACTIVE + ABANDONED. Exclude COMPLETED at the query level.
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.ABANDONED] },
      ...(domain ? { domain } : {}),
    },
    select: {
      id: true,
      domain: true,
      status: true,
      startedAt: true,
      lastSubmittedDay: true,
      challenge: { select: { startsAt: true } },
      user: {
        select: {
          id: true,
          email: true,
          studentProfile: {
            select: {
              fullName: true,
              phone: true,
              userType: true,
              college: true,
              organization: true,
            },
          },
        },
      },
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { submittedAt: true, dayNumber: true },
      },
    },
  });

  const rows: DropoffStudentRow[] = [];

  for (const e of enrollments) {
    const currentDay = getCurrentDayNumber(
      { startedAt: e.startedAt },
      e.challenge,
    );
    const effectiveLast = e.lastSubmittedDay ?? 0;
    const gap = currentDay - effectiveLast;

    const include =
      e.status === EnrollmentStatus.ABANDONED ||
      (e.status === EnrollmentStatus.ACTIVE && gap >= DROPOFF_GAP_DAYS);

    if (!include) continue;

    const lastSub = e.submissions[0];
    rows.push({
      enrollmentId: e.id,
      userId: e.user.id,
      fullName: e.user.studentProfile?.fullName?.trim() || e.user.email,
      email: e.user.email,
      phone: e.user.studentProfile?.phone ?? "",
      userType: e.user.studentProfile?.userType ?? "",
      college: e.user.studentProfile?.college ?? "",
      organization: e.user.studentProfile?.organization ?? "",
      domain: e.domain,
      status: e.status,
      startedAtIso: e.startedAt.toISOString(),
      lastSubmittedDay: e.lastSubmittedDay,
      lastSubmissionDateIso: lastSub?.submittedAt.toISOString() ?? null,
      currentDay,
      daysInactive: gap,
    });
  }

  // Sort: lastSubmittedDay ASC (nulls = -1 first → earliest droppers), then daysInactive DESC.
  rows.sort((a, b) => {
    const av = a.lastSubmittedDay ?? -1;
    const bv = b.lastSubmittedDay ?? -1;
    if (av !== bv) return av - bv;
    return b.daysInactive - a.daysInactive;
  });

  return rows;
}
```

Notes:
- `getCurrentDayNumber` is called per-enrollment (not batched). 1,500 enrollments × one synchronous date computation each is negligible.
- The submission `orderBy + take: 1` per-enrollment is N+1 (one query per row when fetched via include). With 1,500 enrollments this is acceptable on Neon free tier (~1.5s worst case). If perf becomes an issue, switch to a single grouped query: `prisma.submission.groupBy({ by: ["enrollmentId"], _max: { submittedAt: true } })` and join in memory. **Do NOT** preemptively optimize.
- `DROPOFF_GAP_DAYS = 3` is a module-level constant — clear single source of truth if the product wants to tune it later.
- Returned dates are ISO strings, not Date objects, so the Server→Client boundary is clean.

### Step 2 — Wire into the analytics page

In `src/app/admin/analytics/page.tsx`, replace the existing function body:

```tsx
import { AnalyticsDashboardLoader } from "@/components/admin/analytics-dashboard-loader";
import { AnalyticsRangeFilter } from "@/components/admin/analytics-range-filter";
import { DropoffStudentsView } from "@/components/admin/dropoff-students-view";
import {
  getAnalyticsData,
  type TimeRange,
} from "@/features/admin/get-analytics-data";
import { getDropoffStudents } from "@/features/admin/get-dropoff-by-day";
import { Domain } from "@prisma/client";

function parseRange(input: string | undefined): TimeRange {
  if (input === "weekly" || input === "monthly" || input === "daily") {
    return input;
  }
  return "daily";
}

function parseDomain(input: string | undefined): Domain | "ALL" {
  if (input === "SE" || input === "DS" || input === "AI" || input === "CLAUDE") {
    return input;
  }
  return "ALL";
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; dropoff_domain?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const dropoffDomain = parseDomain(params.dropoff_domain);

  const [data, dropoffRows] = await Promise.all([
    getAnalyticsData(range),
    getDropoffStudents({ domain: dropoffDomain }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Analytics</h1>
        <p className="text-muted-foreground">
          Registration, engagement, drop-off, and performance metrics.
        </p>
      </div>
      <AnalyticsRangeFilter value={range} />
      <AnalyticsDashboardLoader data={data} />

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Drop-off students (day-wise)
          </h2>
          <p className="text-sm text-muted-foreground">
            ACTIVE students who are at least 3 days behind, plus all
            ABANDONED enrollments. Sorted by last submitted day (earliest
            droppers first).
          </p>
        </div>
        <DropoffStudentsView rows={dropoffRows} domain={dropoffDomain} />
      </section>
    </div>
  );
}
```

Notes:
- `space-y-4` → `space-y-8` on the outer div to visually separate the new section from the dashboards.
- `Promise.all` keeps the page load fast — the two readers are independent.
- New `?dropoff_domain=` query param is independent of `?range=` so neither filter clobbers the other.

### Step 3 — Client view `DropoffStudentsView`

Create `src/components/admin/dropoff-students-view.tsx`:

```tsx
"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { Domain } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DropoffStudentRow } from "@/features/admin/get-dropoff-by-day";
import { downloadCSV, toCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

type Props = {
  rows: DropoffStudentRow[];
  domain: Domain | "ALL";
};

const DOMAIN_OPTIONS: Array<{ value: Domain | "ALL"; label: string }> = [
  { value: "ALL", label: "All domains" },
  { value: "SE", label: "SE" },
  { value: "DS", label: "DS" },
  { value: "AI", label: "AI" },
  { value: "CLAUDE", label: "CLAUDE" },
];

function domainBadgeClass(domain: string): string {
  if (domain === "AI") return "border-domains-ai/50 bg-domains-ai-bg text-domains-ai";
  if (domain === "DS") return "border-domains-ds/50 bg-domains-ds-bg text-domains-ds";
  if (domain === "CLAUDE")
    return "border-orange-500/40 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200";
  return "border-domains-se/50 bg-domains-se-bg text-domains-se";
}

function statusBadgeClass(status: string): string {
  if (status === "ACTIVE") return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  if (status === "ABANDONED") return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  return "bg-muted text-muted-foreground";
}

function isoToDateOnly(iso: string | null): string {
  if (!iso) return "—";
  return iso.split("T")[0] ?? "—";
}

export function DropoffStudentsView({ rows, domain }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isDownloading, startDownload] = useTransition();

  const VIEW_LIMIT = 10;
  const visibleRows = useMemo(() => rows.slice(0, VIEW_LIMIT), [rows]);

  const csvRows = useMemo(
    () =>
      rows.map((r) => ({
        "Full Name": r.fullName,
        Email: r.email,
        Phone: r.phone,
        "User Type": r.userType,
        College: r.college,
        Organization: r.organization,
        Domain: r.domain,
        Status: r.status,
        "Started At": isoToDateOnly(r.startedAtIso),
        "Last Submitted Day": r.lastSubmittedDay ?? "",
        "Last Submission Date": isoToDateOnly(r.lastSubmissionDateIso),
        "Days Inactive": r.daysInactive,
        "Current Day": r.currentDay,
      })),
    [rows],
  );

  function handleDomainChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ALL") params.delete("dropoff_domain");
    else params.set("dropoff_domain", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleDownload() {
    startDownload(() => {
      if (csvRows.length === 0) {
        toast.error("No drop-off students to export.");
        return;
      }
      const filename = `dropoff-students_${domain.toLowerCase()}_${new Date()
        .toISOString()
        .split("T")[0]}.csv`;
      const csv = toCSV(csvRows);
      downloadCSV(filename, csv);
      toast.success(`Exported ${csvRows.length} students`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {DOMAIN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleDomainChange(opt.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                domain === opt.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent/40",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {rows.length > VIEW_LIMIT
              ? `Showing ${VIEW_LIMIT} of ${rows.length} students`
              : `${rows.length} students`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading || rows.length === 0}
          >
            <Download className="size-4" />
            {isDownloading
              ? "Downloading…"
              : rows.length > VIEW_LIMIT
              ? `Download CSV (${rows.length})`
              : "Download CSV"}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No dropped-off students for the selected domain.
        </div>
      ) : (
        <>
          {/* Mobile: card stack — capped at VIEW_LIMIT; full list lives in CSV */}
          <div className="space-y-2 md:hidden">
            {visibleRows.map((r) => (
              <div key={r.enrollmentId} className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.fullName}</p>
                  <Badge variant="outline" className={domainBadgeClass(r.domain)}>
                    {r.domain}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.email}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge className={statusBadgeClass(r.status)}>{r.status}</Badge>
                  <span className="text-muted-foreground">
                    Last day:{" "}
                    <span className="font-medium text-foreground">
                      {r.lastSubmittedDay ?? "never"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Inactive:{" "}
                    <span className="font-medium text-foreground">
                      {r.daysInactive}d
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Last Day</TableHead>
                  <TableHead>Last Submission</TableHead>
                  <TableHead className="text-right">Days Inactive</TableHead>
                  <TableHead className="text-right">Current Day</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((r) => (
                  <TableRow key={r.enrollmentId}>
                    <TableCell>
                      <div className="font-medium">{r.fullName}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={domainBadgeClass(r.domain)}>
                        {r.domain}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.lastSubmittedDay ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {isoToDateOnly(r.lastSubmissionDateIso)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.daysInactive}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.currentDay}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
```

Notes:
- `visibleRows = rows.slice(0, VIEW_LIMIT)` caps the on-screen render at 10. `csvRows` maps from the **full** `rows`, so the export is complete.
- The whole `csvRows` mapping happens in `useMemo` so it isn't rebuilt every render. Same for `visibleRows`.
- When `rows.length > VIEW_LIMIT`, the header reads `Showing 10 of N students` and the button label becomes `Download CSV (N)` so the admin sees the full count is reachable via export.
- Filename includes the selected domain and today's ISO date — keeps multiple exports distinguishable.
- Empty-state UI explicitly handles "0 dropped-off" so the page doesn't render an empty table or an inert button.
- Mobile/desktop split matches `MissingByDayView` so the look is consistent with the existing admin section.
- The phone column is part of the CSV only — not the on-screen table — to keep the visible UI compact. (Admin can still see phone via `/admin/students/[id]` if needed for context.)

## 6. Guardrails for Cursor (DO NOT)
- **DO NOT** add this as a row to the existing `getAnalyticsData` return shape or pipe it through `AnalyticsDashboardLoader`. The dashboard loader is for charts; this is a tabular view with its own filter and export. Keep them separate files and separate sections on the page.
- **DO NOT** add a server action for the CSV export. The Server Component has already loaded the rows and passed them to the Client. Re-fetching on click is a wasted query and a re-render hazard. Use `toCSV(csvRows)` + `downloadCSV(filename, csv)` directly from the Client.
- **DO NOT** include `COMPLETED` enrollments under any condition. Completing the 60-day challenge is explicitly NOT a drop-off, even if the user had gaps.
- **DO NOT** apply the 10-row `VIEW_LIMIT` to `csvRows`. The cap exists ONLY for the rendered table and card stack. The CSV is the canonical source of truth for the full list — slicing it would silently hide students from admin outreach. The pattern is: `visibleRows = rows.slice(0, VIEW_LIMIT)` for render, `csvRows` maps the full `rows`.
- **DO NOT** add a "Show more" / "Load more" / pagination control to expand the table inline. The CSV is the answer for going past 10. Adding pagination would re-introduce the complexity the cap was meant to avoid.
- **DO NOT** change the sort order or pre-slice on the server side. The Server reader returns the complete sorted list; the Client decides what to render vs. export.
- **DO NOT** harden the gap threshold (`DROPOFF_GAP_DAYS = 3`) into multiple places. It is a module-level constant in `get-dropoff-by-day.ts`; the docstring on the page section refers to "3 days" textually — leave the textual mention but do NOT introduce a second constant or env var.
- **DO NOT** wire bulk actions ("Mark as abandoned for selected") into this view. Out of scope. Admin retains per-student actions on `/admin/students/[id]`.
- **DO NOT** paginate or virtualize the table. Maximum scale (1500 students) fits comfortably in a single render and CSV. Pagination adds state complexity without user benefit at this size.
- **DO NOT** pass Date objects from the Server Component to the Client. All dates must be ISO strings (`startedAtIso`, `lastSubmissionDateIso`) per the type. Date instances cross the boundary but `next/dev` will warn in some configurations; ISO strings are the safe default.
- **DO NOT** add a sort UI in v1. Server-side ASC sort (earliest droppers first) is the product call; sortable headers can be added later if asked.
- **DO NOT** include `phone` in the on-screen table. Per project rules, phone is admin-only visibility — the CSV is admin-only too (the page is behind `requireAdmin`), so phone in CSV is fine, but the visible table stays compact.
- **DO NOT** modify or extend `getMissingByDayCounts` / `getMissingStudentsForDay`. They serve a different concept (missing single days vs. dropped-off cohort).
- **DO NOT** introduce a `prisma.enrollment.findMany({ select: { ... }, include: { ... } })` mixing `select` and `include` at the same level — Prisma disallows that combination. The Step 1 code uses `select` consistently.
- **DO NOT** call `requireAdmin()` inside `get-dropoff-by-day.ts`. The page-level admin guard (existing pattern in `src/app/admin/`) handles route protection. Adding it again in the reader makes the function unusable from contexts that have already auth-guarded.
- **DO NOT** rename `/admin/analytics` or its searchParams. Add `?dropoff_domain=`; do not touch `?range=`.

## 7. DB safety
Not applicable — pure read additions, no schema or data writes.

## 8. Verification

### Pre-flight
- `npx tsc --noEmit` passes.
- Lint passes.
- `npm run build` succeeds.

### Manual test matrix
| Scenario | Expected |
|---|---|
| Open `/admin/analytics` as admin | Page renders the existing dashboards as before. New "Drop-off students (day-wise)" section appears below. |
| Seeded test data: Karan (Day 45, broken streak), Anika (Day 30 ACTIVE), Meera (Day 60 COMPLETED), Vikram (Day 15, recently submitted), an ABANDONED test user | Drop-off table includes Karan (if his gap ≥ 3), the ABANDONED user (always), excludes Meera (COMPLETED), excludes Vikram (recently active). |
| A student with `lastSubmittedDay = null` (enrolled, never submitted), now Day 5 currentDay | Included with `effectiveLastDay = 0`, gap = 5, displayed as "Last Day: —" / "never" on mobile. |
| A student with `lastSubmittedDay = 5`, currentDay = 7 | NOT included (gap = 2 < 3). |
| A student with `lastSubmittedDay = 5`, currentDay = 8 | Included (gap = 3). |
| Same student then backfills Day 6 via relaxation flow | `lastSubmittedDay` advances to 6 (or 7 if they also do today). On next page load, their gap shrinks and they drop out of the list (or stay if still ≥ 3 behind). |
| Click a domain chip (e.g. "AI") | URL updates to `?dropoff_domain=AI`, server re-fetches, table filters to AI students only. Other domains' counts disappear. |
| Click "All domains" chip | URL clears `?dropoff_domain`, table shows all four domains. |
| Click "Download CSV" with rows present | Browser downloads `dropoff-students_all_<date>.csv` (or domain-specific). Open in Excel/Sheets — header row matches the documented column set, each data row has matching values. **CSV row count = `rows.length`, NOT 10.** |
| Click "Download CSV" with zero rows | Button is disabled. Toast/error suppressed (empty state shown above). |
| Drop-off list has > 10 students (e.g., 47) | On-screen table renders exactly 10 rows (earliest droppers). Header reads "Showing 10 of 47 students". Button reads "Download CSV (47)". CSV download has all 47 rows. |
| Drop-off list has ≤ 10 students | Header reads "N students" (no "Showing X of Y" phrasing). Button reads "Download CSV". CSV matches the visible table. |
| Filter to a domain with > 10 droppers then back to "All domains" | View limit re-applies to the new filtered set; CSV still exports the new filtered set in full. |
| 1,500-student stress | Server reader returns in < 1.5s on Neon free tier (warm). Table renders in browser without jank. CSV download is instant (client-side). |
| Mobile viewport (390px) | Card stack shows each dropped-off student with name, domain badge, status badge, last day, days inactive. Desktop table is hidden. Download button still works. |
| Non-admin visits `/admin/analytics` | Redirected by the existing admin route guard. (No new auth wiring in this plan.) |

### Files that should have changed
- `src/features/admin/get-dropoff-by-day.ts` (new)
- `src/components/admin/dropoff-students-view.tsx` (new)
- `src/app/admin/analytics/page.tsx` (edit — imports, searchParams, Promise.all, section render)

Nothing else. If `git diff --name-only` shows changes to `prisma/`, `src/app/actions/`, `src/lib/csv.ts`, `get-missing-by-day.ts`, or the analytics dashboards, STOP and review.

## 9. Commit message

```
feat(admin): day-wise drop-off student list + CSV on analytics

New section on /admin/analytics that surfaces dropped-off students by
their last submitted day. Definition: ACTIVE enrollments where
(currentDay - lastSubmittedDay) >= 3, plus all ABANDONED enrollments.
COMPLETED enrollments are always excluded. Catch-ups via the relaxation
window (plan 004) automatically remove students from the list on the
next page load.

Single flat table sorted by lastSubmittedDay ASC (earliest droppers
first), filterable by domain via chips. The on-screen view is capped at
10 rows (the most concerning); the "Download CSV" button exports the
FULL list (name/email/phone/college/org/domain/last day/last submission
date/days inactive/current day/status). Header reads "Showing 10 of N
students" when the list overflows the cap.

Pure read additions. No schema change. No server action for the export
— Server Component loads rows once, Client converts and downloads from
props.
```
