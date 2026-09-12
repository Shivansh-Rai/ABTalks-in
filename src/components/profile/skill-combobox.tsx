"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { useState } from "react";
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
 * **The catalog is the only source.** This used to merge results from
 * `/api/skills/search`, which reads the `Skill` table — and that table was
 * seeded from free-text `StudentProfile.skills`, so it holds typos ("Tailwinf
 * CSS") and whole pasted stacks ("Html CSS tailwind css javascript next js
 * mongodb"). Those appeared beside real skills and were indistinguishable from
 * them. Anything genuinely missing still goes in through "Other", which is a UI
 * switch rather than a skill.
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
    const out: SkillOption[] = [];
    const seenNames = new Set<string>();
    // Rank order is the matcher's, so this must not re-sort.
    for (const s of fromCatalog) {
      const nameKey = s.name.toLowerCase();
      if (seenNames.has(nameKey)) continue;
      if (isExcluded(s, idSet, nameSet)) continue;
      seenNames.add(nameKey);
      out.push(s);
    }
    return out;
  })();

  const visible = [...listed, OTHER_ITEM];

  function choose(skill: SkillOption) {
    if (isOther(skill)) {
      onOther();
      setQuery("");
      return;
    }
    onSelect(skill);
    setQuery("");
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
