"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { useEffect, useRef, useState } from "react";
import { canonicalSkillName, searchCanonicalSkills } from "@/lib/skill-catalog";

export type SkillOption = {
  id: string;
  name: string;
  slug: string;
  categoryName: string | null;
};

const OTHER_ID = "__other__";

const OTHER_ITEM: SkillOption = {
  id: OTHER_ID,
  name: "Other",
  slug: OTHER_ID,
  categoryName: null,
};

function isOther(item: SkillOption): boolean {
  return item.id === OTHER_ID;
}

type SearchEnvelope =
  | { ok: true; data: SkillOption[] }
  | { ok: false; message: string };

function isSearchEnvelope(value: unknown): value is SearchEnvelope {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }
  const envelope = value as { ok: unknown };
  if (envelope.ok === true && "data" in envelope) {
    return Array.isArray((envelope as { data: unknown }).data);
  }
  return envelope.ok === false;
}

function isExcluded(
  skill: SkillOption,
  excludeIds: ReadonlySet<string>,
  excludeNames: ReadonlySet<string>,
): boolean {
  if (skill.id && excludeIds.has(skill.id)) return true;
  return excludeNames.has(skill.name.toLowerCase());
}

/**
 * Typeahead over the canonical skill catalog, plus a curated empty-query list.
 *
 * Selection of catalog rows only — "Other" is a UI switch, not a skill.
 */
export function SkillCombobox({
  id,
  catalog,
  excludeIds,
  excludeNames,
  onSelect,
  onOther,
  onEnterFreeText,
  placeholder = "Search for skills",
}: {
  id?: string;
  catalog: readonly SkillOption[];
  excludeIds: readonly string[];
  excludeNames: readonly string[];
  onSelect: (skill: SkillOption) => void;
  onOther: () => void;
  /** Enter with no match: add what was typed rather than submitting the form. */
  onEnterFreeText?: (name: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SkillOption[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const queryRef = useRef("");

  const idSet = new Set(excludeIds.filter((x) => x.length > 0));
  const nameSet = new Set(excludeNames.map((n) => n.toLowerCase()));

  const q = query.trim();
  const listed: SkillOption[] = (() => {
    const known = new Map(catalog.map((s) => [s.name.toLowerCase(), s] as const));
    // The curated catalog answers first, ranked by the alias-aware matcher:
    // that is what lets "k8s" find Kubernetes and "fea" find Finite Element
    // Analysis, neither of which shares a substring with what was typed. An
    // empty query gets the popular spread rather than four hundred rows.
    const fromCatalog: SkillOption[] = searchCanonicalSkills(q, 20).map((hit) => {
      const row = known.get(hit.name.toLowerCase());
      return row
        ? { ...row, categoryName: row.categoryName ?? hit.group }
        : { id: "", name: hit.name, slug: "", categoryName: hit.group };
    });
    // Then whatever the `Skill` table knows that the catalog does not. Those
    // rows were seeded from free text and hold several spellings of one
    // technology, so they are folded onto the canonical name first.
    const fromApi = q
      ? results.map((s) => ({ ...s, name: canonicalSkillName(s.name) }))
      : [];

    const out: SkillOption[] = [];
    const seenNames = new Set<string>();
    // Rank order is the matcher's, so this must not re-sort.
    for (const s of [...fromCatalog, ...fromApi]) {
      const nameKey = s.name.toLowerCase();
      if (seenNames.has(nameKey)) continue;
      if (isExcluded(s, idSet, nameSet)) continue;
      seenNames.add(nameKey);
      out.push(s);
    }
    return out;
  })();

  const visible = [...listed, OTHER_ITEM];

  useEffect(() => {
    queryRef.current = query;
    const q = query.trim();
    if (q.length < 1) {
      abortRef.current?.abort();
      return;
    }

    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requested = query;

      fetch(`/api/skills/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (res) => {
          const json: unknown = await res.json();
          if (!isSearchEnvelope(json) || json.ok !== true) return;
          if (queryRef.current !== requested) return;
          setResults(json.data);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (err instanceof Error && err.name === "AbortError") return;
        });
    }, 200);

    return () => {
      window.clearTimeout(handle);
    };
  }, [query]);

  function choose(skill: SkillOption) {
    if (isOther(skill)) {
      onOther();
      setQuery("");
      setResults([]);
      return;
    }
    onSelect(skill);
    setQuery("");
    setResults([]);
  }

  return (
    <Autocomplete.Root
      mode="none"
      filter={null}
      items={visible}
      value={query}
      itemToStringValue={(item) => item.name}
      onValueChange={(text) => setQuery(text)}
    >
      <Autocomplete.Input
        id={id}
        placeholder={placeholder}
        autoComplete="nope"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        data-1p-ignore=""
        className="pw-skill-search"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // Without this the keypress reaches the section <form> and saves the
          // section — reporting "Skills saved" for a skill never added.
          event.preventDefault();
          event.stopPropagation();
          const typed = query.trim();
          const first = listed[0];
          if (first) {
            choose(first);
            return;
          }
          if (typed) {
            onEnterFreeText?.(canonicalSkillName(typed));
            setQuery("");
            setResults([]);
          }
        }}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          className="isolate z-50"
          sideOffset={4}
          align="start"
        >
          <Autocomplete.Popup className="pw-skill-popup relative isolate z-50 w-(--anchor-width) min-w-36 origin-(--transform-origin)">
            {listed.length === 0 && query.trim() ? (
              <div className="pw-skill-empty">
                No matching skill in the catalog
              </div>
            ) : null}
            <Autocomplete.List>
              {(item: SkillOption) => (
                <Autocomplete.Item
                  key={item.id || item.name}
                  value={item}
                  className="pw-skill-option"
                  onClick={() => choose(item)}
                >
                  <span>{item.name}</span>
                  {item.categoryName && !isOther(item) ? (
                    <span className="pw-skill-option-cat">
                      {item.categoryName}
                    </span>
                  ) : null}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
