# 137 — Profile: catalog-only skills, city/state data, degree map, form fixes

## 1. Goal

Six reported issues on `/profile`, five of which come down to the same thing:
the pickers offer the wrong vocabulary. Skills offers junk from a free-text
seeded table, City and Location offer nothing at all, and Education offers a
handful of degrees with one flat department list. Plus two layout fixes.

## 2. Current behavior

| # | Issue | Cause |
|---|---|---|
| 1 | Skills dropdown lists "Tailwinf CSS", "Html CSS tailwind css javascript next js mongodb" | `skill-combobox.tsx` merges `/api/skills/search` results into the list. That route reads `Skill`, which was seeded from free-text `StudentProfile.skills`, so it holds typos and whole sentences. |
| 2 | City and State are plain text inputs | No city/state vocabulary exists in `src/lib/`. But `prisma/content/colleges.json` (54,651 rows) carries `state` / `district` / `city` — 680 district+state pairs and 9,499 city+state pairs. |
| 3 | Country, Gender and Profile Headline share a row | `basic-info-section.tsx` row 3 is `cols={3}`. |
| 4 | "You have unsaved changes" is easy to miss | `.pw-leave-pop` is a white card on a white bar, overlapping the actions row by 8px (`bottom: calc(100% - 8px)`). |
| 5 | Experience Location and Preferred locations take free text | Same missing vocabulary as #2. |
| 6 | Degree and Department lists are short and unrelated to each other | `DEGREES` (22) and `FIELDS_OF_STUDY` (17) are two flat lists; `B.E` and `B.Tech` are listed as different degrees. |

## 3. Files to touch

- `prisma/scripts/build-city-catalog.ts` `[new]` — dev-time generator; reads the colleges dataset, writes the catalog. Never runs at request time.
- `src/lib/city-catalog.generated.ts` `[new]` — its output, checked in.
- `src/lib/city-catalog.ts` `[new]` — aliases, search, `stateForCity`.
- `src/lib/candidate-vocab.ts` `[edit]` — merged degrees, per-degree departments.
- `src/components/profile/skill-combobox.tsx` `[edit]` — catalog only.
- `src/components/profile/basic-info-section.tsx` `[edit]` — city/state, row layout.
- `src/components/profile/education-section.tsx` `[edit]` — degree-aware departments.
- `src/components/profile/experience-section.tsx` `[edit]` — city suggestions.
- `src/components/profile/preferences-section.tsx` `[edit]` — city suggestions.
- `src/components/profile/profile-wizard.css` `[edit]` — the unsaved-changes bar.
- `src/features/profile/profile.test.ts` `[edit]` — assertions.

## 4. Decisions

**D1 — The city catalog is derived from data already in the repo, not typed by
hand.** `district` is the usable field: in India a district is named after its
main city, and there are 680 of them against 9,499 `city` values that are mostly
villages. So the catalog is every district, plus every `city` that carries 10 or
more colleges (a proxy for "somewhere people live and study"), which adds the
urban names districts miss — Noida, Navi Mumbai, Secunderabad. State spellings
are normalized on the way out ("Chhatisgarh" and "Chhattisgarh" are one state).

**D2 — City fills State; State never fills City.** As asked. Picking a city sets
its state; editing the state afterwards is allowed and is never undone, because
a candidate who corrects it means it.

**D3 — Renamed cities are aliases, not separate entries.** The dataset says
"Bangalore"; people type both that and "Bengaluru". One entry, both spellings
searchable, curated by hand because no dataset carries it.

**D4 — The skills list drops the API entirely.** Filtering the API results to
canonical names would leave almost nothing the catalog does not already have,
and every surviving row would be a duplicate. The catalog is the vocabulary; the
"Other" path still accepts anything typed. `/api/skills/search` and
`searchSkills()` become unused — left in place rather than deleted, because an
HTTP route can have callers this repo cannot see.

**D5 — `B.E / B.Tech` is one degree, and departments hang off the degree.**
`M.E / M.Tech` follows for the same reason. Existing rows that hold "B.E" or
"B.Tech" keep their text — no data migration — and both spellings are aliases so
the picker still finds the merged entry.

## 5. Steps

1. **City data.** Generator → `city-catalog.generated.ts`; hand-written
   `city-catalog.ts` over it with aliases, prefix-first search, `stateForCity`.
2. **Skills.** Delete the fetch, the `results` state and the envelope guard from
   the combobox; the list is `searchCanonicalSkills` plus "Other".
3. **Basic info.** City → `PwSuggest` over cities, `onPick` sets State when the
   city is known. State → `PwSuggest` over states. Rows become
   `[I am a | City | State]`, `[Country | Gender]`, `[Profile Headline]`, `[About]`.
4. **Experience / Preferences.** Location → `PwSuggest` over cities;
   Preferred locations → `PwTags` with city suggestions and canonical folding.
5. **Education.** `DEGREES` merged and extended; `DEPARTMENTS_BY_DEGREE` +
   `departmentsForDegree()`; the Department field watches the row's degree.
6. **Unsaved changes.** The pop becomes a full-width warning bar sitting
   entirely above the buttons.
7. Tests, typecheck, lint.

## 6. Guardrails (DO NOT)

- **DO NOT** read `colleges.json` at request time — it is 6 MB. The generator
  runs once and its output is committed.
- **DO NOT** make State autofill City (D2).
- **DO NOT** turn any of these pickers into a whitelist: every one of them
  still accepts free text, because a catalog is never complete.
- **DO NOT** migrate stored degree strings; the merge is a picker change.
- **DO NOT** delete `/api/skills/search` (D4).

## 7. DB safety

None. No schema, migration or seed change. The generator only reads a JSON file
already in the repo and writes a TypeScript file.

## 8. Verification

`npx tsc --noEmit`, `npx eslint`, `npm run test:profile`.

Manual: type "tail" in Skills — only Tailwind CSS; type "pun" in City — Pune,
and State becomes Maharashtra; change State by hand — City is untouched; pick
B.E / B.Tech — Department offers engineering branches, pick B.Com and it offers
commerce ones; edit a field and press Cancel — the warning bar is above the
buttons and unmissable.

## 9. Commit message

```
fix(profile): catalog-only skills, city/state vocabulary, degree-aware departments

The skills picker no longer merges rows from the free-text-seeded Skill table,
so typos and pasted sentences stop appearing beside real skills. City, State,
Experience location and Preferred locations now draw on a city/state catalog
derived from the college dataset already in the repo; picking a city fills in
its state, never the reverse. Degrees merge B.E with B.Tech (and M.E with
M.Tech), and each degree carries its own department list. Profile Headline
moves to its own row, and the unsaved-changes warning sits above the buttons
where it can be seen.
```
