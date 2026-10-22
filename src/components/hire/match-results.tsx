"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rememberEvidence } from "@/components/hire/evidence-cache";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import {
  MatchCard,
  type MatchCardData,
  type MatchDecision,
  type MatchTriage,
} from "@/components/hire/match-card";
import { DeskMatchCard } from "@/components/hire/desk-match-card";
import { VirtualCandidateCard } from "@/components/hire/virtual-candidate-card";
import type { SampleDemand } from "@/components/hire/sample-card-notice";
import {
  MATCHES_PER_PAGE,
  clampPage,
  pageCount,
  pageItems,
} from "@/components/hire/match-pagination";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { skillHighlighted } from "@/features/hire/skill-highlight";
import type { JobSpec } from "@/lib/validations/hire";

/**
 * Show the best match, then the rest on request.
 *
 * A wall of near-identical cards makes a recruiter skim and leave; leading with
 * one and asking whether they want more is the difference between reading a
 * result and scrolling past it.
 */
const INITIAL_VISIBLE = 1;

type SortKey = "best" | "skills" | "exp-desc" | "exp-asc";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "best", label: "Best match" },
  { value: "skills", label: "Most skills matched" },
  { value: "exp-desc", label: "Experience: high to low" },
  { value: "exp-asc", label: "Experience: low to high" },
];

/** How many of the searched skills a candidate holds. */
function skillsMatched(m: MatchCardData): number {
  const have = m.evidence?.skills ?? [];
  return (m.highlightSkills ?? []).filter((n) =>
    have.some((sk) => skillHighlighted(sk, [n])),
  ).length;
}

/**
 * The list in the order the recruiter picked. Best match is the ranking as it
 * came back; the others re-order it, falling back to that ranking on a tie so
 * the order never shuffles between renders.
 */
function sortMatches<T extends MatchCardData>(list: T[], key: SortKey): T[] {
  if (key === "best") return list;
  const years = (m: T) => m.evidence?.yearsExperience ?? -1;
  return list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const d =
        key === "skills"
          ? skillsMatched(b.m) - skillsMatched(a.m)
          : key === "exp-desc"
            ? years(b.m) - years(a.m)
            : years(a.m) - years(b.m);
      return d !== 0 ? d : a.i - b.i;
    })
    .map(({ m }) => m);
}

export function MatchResults({
  matches,
  cartCount,
  viewAllHref,
  samples,
  sampleDemand,
  desk = false,
  onOpen,
  onDecision,
  requestId,
  selectedRef,
  searchSpec = null,
  totalFound = null,
}: {
  /**
   * Desk only: how many candidates the pool holds for this search. When it is
   * larger than `matches`, the pager says the list is the top slice of it.
   */
  totalFound?: number | null;
  matches: (MatchCardData & Partial<MatchTriage>)[];
  /**
   * Server-rendered, and correct after every toggle because the shortlist
   * action revalidates the /hire layout. A local delta on top of it counted
   * each change twice once that revalidation started working.
   */
  cartCount: number;
  /**
   * When set, only the leading card is shown and the rest live on that page.
   * Omit it to render the whole list — which is what that page then does.
   */
  viewAllHref?: string;
  /**
   * Illustrative cards for an empty search. Rendered only when there are no
   * real matches, in a separate list, so they can never read as results.
   */
  samples?: MatchCardData[];
  sampleDemand?: SampleDemand;
  desk?: boolean;
  onOpen?: (match: MatchCardData & Partial<MatchTriage>) => void;
  onDecision?: (
    match: MatchCardData & Partial<MatchTriage>,
    decision: MatchDecision,
  ) => void;
  requestId?: string | null;
  selectedRef?: string;
  /** Active Scout search — keys the desk card AI summary session cache. */
  searchSpec?: JobSpec | null;
}) {
  // Seeded from the server once, then owned here. Reading it from the prop on
  // every render double-counted: the toggle moved it, and the refresh that
  // followed moved it again.
  const [count, setCount] = useState(cartCount);
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLUListElement>(null);
  // The whole list, never the visible page: the evidence cache backs the
  // inspector, which must still open a candidate the recruiter paged past.
  useEffect(() => {
    rememberEvidence(matches);
  }, [matches]);
  // Back to page 1 whenever the underlying result set changes — a new search, a
  // search-tab switch, the "Hide rejected" toggle.
  //
  // Two deliberate choices. The key is the refs, not the array: `scout-chat`
  // rebuilds `matches` with .map() on every render, so anything keyed on the
  // array itself would fire forever. And the reset is an adjustment during
  // render rather than an effect — React re-runs this component before
  // committing, with no cascading render and no flash of the wrong page.
  const refsKey = useMemo(
    () => matches.map((m) => m.candidateRef).join("|"),
    [matches],
  );
  const [seenRefsKey, setSeenRefsKey] = useState(refsKey);
  const [sort, setSort] = useState<SortKey>("best");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  if (seenRefsKey !== refsKey) {
    setSeenRefsKey(refsKey);
    setPage(1);
    setPicked(new Set());
  }

  // Desk only: the order the recruiter picked, and the best-match position of
  // each candidate so "Top match" stays on the real top match under any sort.
  const ordered = desk ? sortMatches(matches, sort) : matches;
  const bestRankOf = useMemo(
    () => new Map(matches.map((m, i) => [m.candidateRef, i + 1])),
    [matches],
  );
  // Bulk actions write project decisions, so they exist only in a project.
  const bulk = desk && Boolean(onDecision && requestId);

  // Paging applies to the FULL list only. The `viewAllHref` branch is a
  // different product decision — one card plus a link to the rest — and its
  // "View N more" count must keep meaning "what this link hides", not "what is
  // on the other pages".
  const paged = !viewAllHref && matches.length > MATCHES_PER_PAGE;
  const totalPages = paged ? pageCount(matches.length) : 1;
  const current = clampPage(page, totalPages);
  const start = paged ? (current - 1) * MATCHES_PER_PAGE : 0;
  const visible = viewAllHref
    ? matches.slice(0, INITIAL_VISIBLE)
    : paged
      ? ordered.slice(start, start + MATCHES_PER_PAGE)
      : ordered;
  const selectableOnPage = bulk
    ? visible.filter((m) => Boolean(m.candidateUserId))
    : [];
  const pagePicked =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((m) => picked.has(m.candidateRef));

  function togglePick(ref: string, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(ref);
      else next.delete(ref);
      return next;
    });
  }

  function togglePage(on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const m of selectableOnPage) {
        if (on) next.add(m.candidateRef);
        else next.delete(m.candidateRef);
      }
      return next;
    });
  }

  /** Shortlist or reject every picked candidate, then clear the selection. */
  function decideAll(decision: MatchDecision) {
    if (!onDecision) return;
    for (const m of matches) {
      if (picked.has(m.candidateRef)) onDecision(m, decision);
    }
    setPicked(new Set());
  }
  const hidden = viewAllHref ? matches.length - visible.length : 0;
  const showSamples = matches.length === 0 && (samples?.length ?? 0) > 0;

  function goTo(next: number) {
    setPage(clampPage(next, totalPages));
    // In the click handler rather than an effect on `page`: the refsKey reset
    // above also moves `page`, and scrolling there would yank the desk around
    // after every search.
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={desk ? "scout-results" : "space-y-4"}>
      {showSamples && samples!.some((m) => m.isVirtual) && sampleDemand?.spec && (
        <VirtualCandidateCard
          spec={sampleDemand.spec}
          talentRequestId={sampleDemand.requestId ?? null}
          alreadyRequested={sampleDemand.alreadyRecorded ?? false}
        />
      )}

      {showSamples && !samples!.some((m) => m.isVirtual) && (
        <div className="space-y-3">
          <h3 className={desk ? "scout-results__h" : "font-display text-lg font-semibold"}>
            What a match would look like
          </h3>
          <ul className={desk ? "scout-results" : "space-y-4"}>
            {samples!.map((m) => (
              <li key={m.candidateRef}>
                {desk ? (
                  <DeskMatchCard
                    match={m}
                    selected={selectedRef === m.candidateRef}
                    onOpen={() => onOpen?.(m)}
                    sampleDemand={sampleDemand}
                    searchSpec={searchSpec}
                  />
                ) : (
                  <MatchCard
                    match={m}
                    variant="sample"
                    sampleDemand={sampleDemand}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Desk: one white panel, a row per candidate divided by hairlines, the
          pager as the panel's footer. Elsewhere: the separate cards as before. */}
      <div className={desk ? "desk-list" : "space-y-4"}>
      {desk && visible.length > 0 && (
        <div className={cn("desk-list__bar", picked.size > 0 && "is-bulk")}>
          {bulk && selectableOnPage.length > 0 && (
            <label className="desk-list__pick">
              <input
                type="checkbox"
                checked={pagePicked}
                onChange={(ev) => togglePage(ev.target.checked)}
              />
              <span className="sr-only">Select everyone on this page</span>
            </label>
          )}
          {picked.size > 0 ? (
            <div className="desk-list__bulk" role="group" aria-label="Bulk actions">
              <span className="desk-list__count" aria-live="polite">
                {picked.size} selected
              </span>
              <button
                type="button"
                className="desk-row__btn desk-row__btn--primary"
                onClick={() => decideAll("SHORTLISTED")}
              >
                Shortlist {picked.size}
              </button>
              <button
                type="button"
                className="desk-row__btn desk-row__btn--ghost"
                onClick={() => decideAll("REJECTED")}
              >
                Reject {picked.size}
              </button>
              <button
                type="button"
                className="desk-row__btn desk-row__btn--quiet"
                onClick={() => setPicked(new Set())}
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="desk-list__count">
              Showing {start + 1}&ndash;{start + visible.length} of{" "}
              {totalFound != null && totalFound > matches.length
                ? `the top ${matches.length}`
                : matches.length}
            </span>
          )}
          {matches.length > 1 && (
            <label className="desk-list__sort">
              <span>Sort by</span>
              <select
                value={sort}
                onChange={(ev) => {
                  setSort(ev.target.value as SortKey);
                  setPage(1);
                }}
              >
                {SORTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {visible.length > 0 && (
        <ul ref={listRef} className={desk ? "desk-list__rows" : "space-y-4"}>
          {visible.map((m, i) => (
            <li key={m.candidateRef}>
              {desk ? (
                <DeskMatchCard
                  match={m}
                  rank={start + i + 1}
                  bestRank={bestRankOf.get(m.candidateRef)}
                  checked={picked.has(m.candidateRef)}
                  onCheck={
                    bulk ? (on) => togglePick(m.candidateRef, on) : undefined
                  }
                  selected={selectedRef === m.candidateRef}
                  onOpen={() => onOpen?.(m)}
                  onDecision={
                    onDecision ? (decision) => onDecision(m, decision) : undefined
                  }
                  requestId={requestId}
                  searchSpec={searchSpec}
                  onCartToggle={(inCart) =>
                    setCount((c) => Math.max(0, c + (inCart ? 1 : -1)))
                  }
                />
              ) : (
                <MatchCard
                  match={m}
                  rank={start + i + 1}
                  onCartToggle={(inCart) =>
                    setCount((c) => Math.max(0, c + (inCart ? 1 : -1)))
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {paged && (
        <nav className="scout-pager" aria-label="Search results pages">
          <button
            type="button"
            className="scout-pager__step"
            disabled={current === 1}
            aria-label="Previous page"
            onClick={() => goTo(current - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          {pageItems(current, totalPages).map((item, i) =>
            item === "gap" ? (
              <span key={`gap-${i}`} className="scout-pager__gap" aria-hidden="true">
                &hellip;
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={cn(
                  "scout-pager__n",
                  item === current && "is-current",
                )}
                aria-current={item === current ? "page" : undefined}
                aria-label={`Page ${item}`}
                onClick={() => goTo(item)}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            className="scout-pager__step"
            disabled={current === totalPages}
            aria-label="Next page"
            onClick={() => goTo(current + 1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <span className="scout-pager__count">
            {start + 1}&ndash;{Math.min(start + MATCHES_PER_PAGE, matches.length)} of{" "}
            {desk && totalFound != null && totalFound > matches.length
              ? `top ${matches.length}`
              : matches.length}
          </span>
        </nav>
      )}
      </div>

      {viewAllHref && hidden > 0 && (
        <Link
          href={viewAllHref}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed",
            "bg-card/50 py-3 text-sm font-medium shadow-card transition-all duration-300",
            "hover:border-primary/45 hover:bg-card hover:shadow-card-hover",
          )}
        >
          View {hidden} more
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}

      {/* Desk chrome already has the Shortlist bar. Don't duplicate it. */}
      {!desk && count > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold">{count}</span>{" "}
            {count === 1 ? "candidate" : "candidates"} in your cart — send
            one request for all of them.
          </p>
          <Link
            href="/talent/shortlist"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <ShoppingCart className="size-3.5" aria-hidden="true" />
            Review &amp; request
          </Link>
        </div>
      )}
    </div>
  );
}
