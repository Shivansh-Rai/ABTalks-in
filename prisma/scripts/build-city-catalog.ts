/**
 * Builds `src/lib/city-catalog.generated.ts` from the college dataset.
 *
 * The city/state vocabulary the profile needs was already in this repo, sitting
 * in `prisma/content/colleges.json` — 54,651 institutions, each carrying its
 * state, district and city. Nothing had to be typed by hand or fetched.
 *
 * WHY DISTRICT FIRST: in India a district is named after the town that runs it,
 * so the 680 district names are exactly the places a candidate would call their
 * city. The 9,499 raw `city` values are mostly the village the campus stands
 * in — "Manda Bheem Singh" is not an address anyone gives a recruiter. Cities
 * are therefore only included once enough institutions share the name to make
 * it a real urban centre, which is what pulls in the names districts miss
 * (Noida sits in Gautam Buddha Nagar, Navi Mumbai in Thane).
 *
 * Run: npx tsx prisma/scripts/build-city-catalog.ts
 * Reads one file, writes one file, touches no database.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type CollegeRow = {
  name?: string;
  state?: string | null;
  district?: string | null;
  city?: string | null;
};

/** A place needs this many institutions before its own name is worth offering. */
const CITY_MIN_COLLEGES = 10;

const ROOT = process.cwd();
const SOURCE = join(ROOT, "prisma", "content", "colleges.json");
const TARGET = join(ROOT, "src", "lib", "city-catalog.generated.ts");

/**
 * The dataset spells some states more than one way. Left side is what appears
 * in the file; right side is what the profile should show.
 */
const STATE_FIXES: Record<string, string> = {
  chhatisgarh: "Chhattisgarh",
  chattisgarh: "Chhattisgarh",
  chhattisgarh: "Chhattisgarh",
  orissa: "Odisha",
  odisha: "Odisha",
  pondicherry: "Puducherry",
  puducherry: "Puducherry",
  uttaranchal: "Uttarakhand",
  uttrakhand: "Uttarakhand",
  uttarakhand: "Uttarakhand",
  "jammu & kashmir": "Jammu & Kashmir",
  "jammu and kashmir": "Jammu & Kashmir",
  "andaman & nicobar islands": "Andaman & Nicobar Islands",
  "andaman and nicobar islands": "Andaman & Nicobar Islands",
  "dadra & nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
  "dadra and nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
  "daman & diu": "Dadra & Nagar Haveli and Daman & Diu",
  "daman and diu": "Dadra & Nagar Haveli and Daman & Diu",
  delhi: "Delhi",
  "nct of delhi": "Delhi",
};

/** Title case that leaves real casing alone where the source already has it. */
function tidyPlace(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  // ALL CAPS or all lower-case gets title-cased; mixed case is left as found.
  const uniform = trimmed === trimmed.toUpperCase() || trimmed === trimmed.toLowerCase();
  const cased = uniform
    ? trimmed
        .toLowerCase()
        .replace(/(^|[\s('/-])([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase())
    : trimmed;
  return cased;
}

function tidyState(raw: string): string {
  const tidy = tidyPlace(raw);
  return STATE_FIXES[tidy.toLowerCase()] ?? tidy;
}

/** Rejects the junk that a 54k-row scrape always carries. */
function isUsablePlace(name: string): boolean {
  if (name.length < 3 || name.length > 40) return false;
  // Must read as a place name: letters, spaces and the punctuation places use.
  if (!/^[A-Za-z][A-Za-z\s.'()&/-]*$/.test(name)) return false;
  if (/^(na|nil|none|other|others|unknown|not applicable)$/i.test(name)) return false;
  return true;
}

function main(): void {
  const rows = JSON.parse(readFileSync(SOURCE, "utf8")) as CollegeRow[];

  /** place key → { name, state, count } */
  const places = new Map<
    string,
    { name: string; state: string; count: number; isDistrict: boolean }
  >();
  const stateCounts = new Map<string, number>();

  const add = (rawName: string, rawState: string, isDistrict: boolean) => {
    const state = tidyState(rawState);
    const name = tidyPlace(rawName);
    if (!state || !name || !isUsablePlace(name)) return;
    const key = `${name.toLowerCase()}|${state.toLowerCase()}`;
    const found = places.get(key);
    if (found) {
      found.count += 1;
      found.isDistrict = found.isDistrict || isDistrict;
      return;
    }
    places.set(key, { name, state, count: 1, isDistrict });
  };

  for (const row of rows) {
    const state = (row.state ?? "").trim();
    if (!state) continue;
    stateCounts.set(tidyState(state), (stateCounts.get(tidyState(state)) ?? 0) + 1);
    if (row.district) add(row.district, state, true);
    if (row.city) add(row.city, state, false);
  }

  // A district is in because it is a district. A city has to earn its place.
  const kept = [...places.values()].filter(
    (p) => p.isDistrict || p.count >= CITY_MIN_COLLEGES,
  );

  // One name can appear in several states (Aurangabad is in both Maharashtra
  // and Bihar). Keep the busiest, so the autofill picks the likely one.
  const byName = new Map<string, (typeof kept)[number]>();
  for (const place of kept) {
    const key = place.name.toLowerCase();
    const found = byName.get(key);
    if (!found || place.count > found.count) byName.set(key, place);
  }

  // Busiest first: the search shows the bigger city when two names tie.
  const ordered = [...byName.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  const states = [...stateCounts.entries()]
    .filter(([name]) => name.length > 2)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name]) => name);

  const body = `/**
 * GENERATED — do not edit.
 *
 * Built by \`prisma/scripts/build-city-catalog.ts\` from
 * \`prisma/content/colleges.json\`. Re-run that script to refresh it.
 *
 * ${ordered.length} places, ${states.length} states.
 */

/** \`[city, state]\`, busiest first. */
export const CITY_STATE_PAIRS: readonly (readonly [string, string])[] = [
${ordered.map((p) => `  ["${p.name}", "${p.state}"],`).join("\n")}
];

export const STATE_NAMES: readonly string[] = [
${states.map((s) => `  "${s}",`).join("\n")}
];
`;

  writeFileSync(TARGET, body, "utf8");
  console.log(
    `city catalog: ${ordered.length} places, ${states.length} states -> ${TARGET}`,
  );
}

main();
