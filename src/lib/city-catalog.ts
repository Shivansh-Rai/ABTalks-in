/**
 * City and state vocabulary for the profile.
 *
 * The data underneath is generated from `prisma/content/colleges.json`, which
 * has been in this repo all along — 54,651 institutions, each stamped with its
 * state and district. See `prisma/scripts/build-city-catalog.ts`.
 *
 * This file is the half a dataset cannot supply: which spellings are the same
 * place. A scrape of Indian institutions holds both "Bangalore" and
 * "Bengaluru", both "Trichy" and "Tiruchirappalli", and offering a candidate
 * two entries for one city is worse than offering neither.
 *
 * **A city knows its state. A state never picks a city.** Filling in the state
 * from a chosen city saves a field; guessing a city from a state would put
 * words in the candidate's mouth.
 */
import { CITY_STATE_PAIRS, STATE_NAMES } from "./city-catalog.generated";

export { STATE_NAMES };

/**
 * Old, local and renamed spellings, folded onto the name to display.
 *
 * Left side is what someone might type (or what the dataset happens to hold);
 * right side is what the profile shows. Where the dataset carries both, the
 * two rows become one entry under the name on the right.
 */
const CITY_RENAMES: Record<string, string> = {
  bangalore: "Bengaluru",
  "bangalore rural": "Bengaluru",
  "bangalore urban": "Bengaluru",
  mysore: "Mysuru",
  mangalore: "Mangaluru",
  belgaum: "Belagavi",
  shimoga: "Shivamogga",
  hubli: "Hubballi",
  gulbarga: "Kalaburagi",
  bellary: "Ballari",
  tumkur: "Tumakuru",
  trivandrum: "Thiruvananthapuram",
  trichy: "Tiruchirappalli",
  gurgaon: "Gurugram",
  allahabad: "Prayagraj",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  poona: "Pune",
  cochin: "Kochi",
  pondicherry: "Puducherry",
  baroda: "Vadodara",
  tuticorin: "Thoothukudi",
  simla: "Shimla",
  gauhati: "Guwahati",
  banaras: "Varanasi",
  benares: "Varanasi",
};

/** Typed shorthands that are not renames — nobody types Visakhapatnam twice. */
const CITY_NICKNAMES: Record<string, string> = {
  vizag: "Visakhapatnam",
  blr: "Bengaluru",
  hyd: "Hyderabad",
  ncr: "Delhi",
  "new delhi": "Delhi",
  "greater noida": "Noida",
  secunderabad: "Hyderabad",
};

export type CityEntry = {
  city: string;
  state: string;
  /** Lower-cased spellings that should find this entry. */
  aliases: string[];
};

/** Display name → entry, with every spelling of it folded in. */
const BY_CITY = new Map<string, CityEntry>();
/** Any spelling (lower-cased) → display name. */
const BY_SPELLING = new Map<string, string>();

for (const [rawCity, state] of CITY_STATE_PAIRS) {
  const display = CITY_RENAMES[rawCity.toLowerCase()] ?? rawCity;
  const key = display.toLowerCase();
  const existing = BY_CITY.get(key);
  if (existing) {
    // A second spelling of somewhere already known: keep the entry, remember
    // the spelling. The first pair wins the state because the generated file
    // is ordered by how many institutions back it.
    if (rawCity.toLowerCase() !== key) existing.aliases.push(rawCity.toLowerCase());
  } else {
    BY_CITY.set(key, {
      city: display,
      state,
      aliases: rawCity.toLowerCase() === key ? [] : [rawCity.toLowerCase()],
    });
  }
  BY_SPELLING.set(rawCity.toLowerCase(), display);
  BY_SPELLING.set(key, display);
}

// Renames whose old name is all the dataset had ("Allahabad" with no
// "Prayagraj" row) are already displayed under the new name by the loop above.
// These two maps only need to make the typed spelling resolve.
for (const [typed, display] of Object.entries({
  ...CITY_RENAMES,
  ...CITY_NICKNAMES,
})) {
  const entry = BY_CITY.get(display.toLowerCase());
  if (!entry) continue;
  if (!BY_SPELLING.has(typed)) BY_SPELLING.set(typed, entry.city);
  if (typed !== entry.city.toLowerCase() && !entry.aliases.includes(typed)) {
    entry.aliases.push(typed);
  }
}

const CITY_ENTRIES: readonly CityEntry[] = [...BY_CITY.values()];

/** Display names, busiest city first (the generated order). */
export const CITY_NAMES: readonly string[] = CITY_ENTRIES.map((c) => c.city);

/** The state a city sits in, or null when the catalog has never heard of it. */
export function stateForCity(raw: string): string | null {
  const display = BY_SPELLING.get(raw.trim().toLowerCase());
  if (!display) return null;
  return BY_CITY.get(display.toLowerCase())?.state ?? null;
}

/** Fold a typed city onto its display spelling, or return it trimmed. */
export function canonicalCityName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return BY_SPELLING.get(trimmed.toLowerCase()) ?? trimmed;
}

export function isKnownCity(raw: string): boolean {
  return BY_SPELLING.has(raw.trim().toLowerCase());
}

/**
 * Prefix matches first, then anything containing the query, then the old
 * spellings. Ties keep the generated order, which is busiest-first — typing
 * "ban" should reach Bengaluru before Bandipora.
 */
export function searchCities(query: string, limit = 12): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return CITY_NAMES.slice(0, limit);

  // An old spelling is as good a way in as the current one — "ban" has to
  // reach Bengaluru, which no longer contains those letters. So a match on an
  // alias sits in the same tier as a match on the name, and the tiers keep the
  // generated order, which is busiest city first.
  const exact: string[] = [];
  const prefix: string[] = [];
  const contains: string[] = [];

  for (const entry of CITY_ENTRIES) {
    const spellings = [entry.city.toLowerCase(), ...entry.aliases];
    if (spellings.some((s) => s === q)) exact.push(entry.city);
    else if (spellings.some((s) => s.startsWith(q))) prefix.push(entry.city);
    else if (spellings.some((s) => s.includes(q))) contains.push(entry.city);
  }

  return [...exact, ...prefix, ...contains].slice(0, limit);
}

/** Same shape for the state field, which has no folding to do. */
export function searchStates(query: string, limit = 12): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return STATE_NAMES.slice(0, limit);
  const prefix = STATE_NAMES.filter((s) => s.toLowerCase().startsWith(q));
  const contains = STATE_NAMES.filter(
    (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q),
  );
  return [...prefix, ...contains].slice(0, limit);
}
