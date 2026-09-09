"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WorkshopEventEditor,
  blankEvent,
  type EditableWorkshopEvent,
} from "@/components/admin/workshop-event-editor";

/**
 * Month grid for managing workshops. Click any day to add one; click an
 * existing workshop to edit it.
 *
 * Only workshop-track events appear here, because only they are rows this
 * editor can write. The challenge / cohort / hackathon entries are still in
 * code (see STATIC_EVENTS) and are deliberately not editable.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isoKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const monthLabel = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function WorkshopEventCalendar({
  events,
  todayKey,
}: {
  events: EditableWorkshopEvent[];
  /** Resolved on the server in IST so the highlight matches the user site. */
  todayKey: string;
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey.split("-").map(Number);
    return { y: y!, m: m! - 1 };
  });
  const [editing, setEditing] = useState<EditableWorkshopEvent | null>(null);
  const [isNew, setIsNew] = useState(false);

  const byDate = useMemo(() => {
    const map = new Map<string, EditableWorkshopEvent[]>();
    for (const e of events) {
      const list = map.get(e.date);
      if (list) list.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const lead = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const cells: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d += 1) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const step = (delta: number) =>
    setCursor(({ y, m }) => {
      const next = m + delta;
      if (next < 0) return { y: y - 1, m: 11 };
      if (next > 11) return { y: y + 1, m: 0 };
      return { y, m: next };
    });

  function openNew(dateKey: string) {
    setEditing(blankEvent(dateKey));
    setIsNew(true);
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          {monthLabel(cursor.y, cursor.m)}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => step(1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((day, i) => {
          if (day === null) {
            return <div key={`pad-${i}`} className="min-h-24 rounded-md" />;
          }
          const key = isoKey(cursor.y, cursor.m, day);
          const dayEvents = byDate.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={cn(
                "group min-h-24 rounded-md border p-1.5 text-left transition-colors",
                isToday ? "border-[#E05226] bg-[#E05226]/5" : "hover:bg-accent/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-medium",
                    isToday ? "text-[#E05226]" : "text-muted-foreground",
                  )}
                >
                  {day}
                </span>
                <button
                  type="button"
                  aria-label={`Add a workshop on ${key}`}
                  className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => openNew(key)}
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>

              <div className="mt-1 space-y-1">
                {dayEvents.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setEditing(e);
                      setIsNew(false);
                    }}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium text-white"
                    style={{ background: e.accent }}
                    title={`${e.title} · ${e.time}`}
                  >
                    {e.title || e.id}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Click a day to add a workshop, or a workshop to edit it. Saving updates
        the public hero, countdown, calendar and registration at once.
      </p>

      {editing ? (
        <WorkshopEventEditor
          // Remount per event so the form state resets between opens.
          key={`${editing.id}-${isNew}`}
          event={editing}
          isNew={isNew}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
