"use client";

/**
 * The input on /admin/search, with live suggestions.
 *
 * The mechanics here are a deliberate port of `shared/college-combobox.tsx`
 * rather than a shared abstraction: debounce, abort, stale-response guard.
 * Twenty duplicated lines are cheaper than a primitive two unrelated surfaces
 * have to agree on.
 *
 * The control stays inside the page's `<form action="/admin/search">`, so the
 * Search button and a bare Enter still perform the ordinary GET submit. The
 * dropdown is a shortcut past that, never a replacement for it.
 */

import { Autocomplete } from "@base-ui/react/autocomplete";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type {
  AdminSuggestGroup,
  AdminSuggestItem,
} from "@/features/admin/search-admin-console";
import { cn } from "@/lib/utils";

type Props = {
  defaultValue?: string;
};

/** Matches the floor in `suggestAdminConsole`; below it, we do not ask. */
const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

const INPUT_CLASS =
  "h-12 min-w-[16rem] flex-1 rounded-lg border border-[#D2D2D2] bg-white px-4 text-base";

type SuggestEnvelope =
  | { ok: true; data: AdminSuggestGroup[] }
  | { ok: false; message: string };

function isSuggestEnvelope(value: unknown): value is SuggestEnvelope {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }
  const envelope = value as { ok: unknown };
  if (envelope.ok === true && "data" in envelope) {
    return Array.isArray((envelope as { data: unknown }).data);
  }
  return envelope.ok === false;
}

export function AdminSearchBox({ defaultValue = "" }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [groups, setGroups] = useState<AdminSuggestGroup[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const queryRef = useRef(defaultValue);
  const highlightedRef = useRef<AdminSuggestItem | null>(null);
  const visibleGroups = value.trim().length < MIN_CHARS ? [] : groups;

  useEffect(() => {
    queryRef.current = value;
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      abortRef.current?.abort();
      return;
    }

    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requested = value;

      fetch(`/api/admin/search/suggest?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (res) => {
          const json: unknown = await res.json();
          if (!isSuggestEnvelope(json) || json.ok !== true) return;
          // The answer to a question that has already moved on is noise.
          if (queryRef.current !== requested) return;
          setGroups(json.data);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (err instanceof Error && err.name === "AbortError") return;
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value]);

  return (
    <Autocomplete.Root
      // The server has already filtered; a second client-side filter would
      // hide correct rows whose match is in a field we do not render.
      mode="none"
      filter={null}
      items={visibleGroups}
      value={value}
      itemToStringValue={(item: AdminSuggestItem) => item.title}
      onItemHighlighted={(item: AdminSuggestItem | undefined) => {
        highlightedRef.current = item ?? null;
      }}
      onValueChange={(text, details) => {
        // `onValueChange` hands back a string, so the pressed row is recovered
        // from the highlight ref.
        if (details.reason === "item-press") {
          const item = highlightedRef.current;
          if (item) {
            router.push(item.href);
            return;
          }
        }
        setValue(text);
      }}
    >
      <Autocomplete.Input
        name="q"
        placeholder="Name, email, job title, company…"
        aria-label="Search candidates, recruiters, jobs and assessments"
        autoComplete="nope"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore=""
        className={INPUT_CLASS}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          className="isolate z-50"
          sideOffset={4}
          align="start"
        >
          <Autocomplete.Popup
            className={cn(
              "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <Autocomplete.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
              {value.trim().length >= MIN_CHARS
                ? "No matches — press Enter to search anyway"
                : null}
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(group: AdminSuggestGroup) => (
                <Autocomplete.Group
                  key={group.value}
                  items={group.items}
                  className="py-1"
                >
                  <Autocomplete.GroupLabel className="px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.value}
                  </Autocomplete.GroupLabel>
                  <Autocomplete.Collection>
                    {(item: AdminSuggestItem) => (
                      <Autocomplete.Item
                        key={item.id}
                        value={item}
                        className="relative flex w-full cursor-default flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                      >
                        <span className="font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.meta}
                        </span>
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.Collection>
                </Autocomplete.Group>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
