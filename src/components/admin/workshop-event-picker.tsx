"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickerEvent {
  eventId: string;
  label: string;
  count: number;
}

interface Props {
  events: PickerEvent[];
  selected: string[];
}

/**
 * Searchable multi-select over workshop events. Replaces the tab row, which does
 * not survive a weekly workshop cadence (52 tabs a year).
 *
 * Built as a plain button + panel rather than DropdownMenu: the menu primitive
 * captures keystrokes for its own typeahead, which fights a search input placed
 * inside it.
 */
export function WorkshopEventPicker({ events, selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.label.toLowerCase().includes(q) || e.eventId.toLowerCase().includes(q),
    );
  }, [events, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const apply = (next: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete("events");
    else params.set("events", next.join(","));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggle = (eventId: string) => {
    const next = selectedSet.has(eventId)
      ? selected.filter((id) => id !== eventId)
      : [...selected, eventId];
    apply(next);
  };

  const selectedTotal = events
    .filter((e) => selectedSet.has(e.eventId))
    .reduce((n, e) => n + e.count, 0);

  const buttonLabel =
    selected.length === 0
      ? "Select workshops"
      : selected.length === 1
        ? (events.find((e) => e.eventId === selected[0])?.label ?? selected[0]!)
        : `${selected.length} workshops · ${selectedTotal} registrations`;

  return (
    <div ref={containerRef} className="relative w-full sm:max-w-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm font-medium transition-colors",
          "hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          <div className="relative border-b p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search workshops…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8"
            />
          </div>

          <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs">
            <button
              type="button"
              onClick={() => apply(filtered.map((e) => e.eventId))}
              className="font-medium text-primary hover:underline"
            >
              Select all{query ? " matching" : ""}
            </button>
            <button
              type="button"
              onClick={() => apply([])}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No workshops match “{query}”.
              </p>
            )}
            {filtered.map((e) => {
              const isSelected = selectedSet.has(e.eventId);
              return (
                <button
                  key={e.eventId}
                  type="button"
                  onClick={() => toggle(e.eventId)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent/60"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.label}</span>
                    {/* eventId shown so the value stored on every row is visible
                        and searchable, not just the display title. */}
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {e.eventId}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
