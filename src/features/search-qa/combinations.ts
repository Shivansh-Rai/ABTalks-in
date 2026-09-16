/**
 * Which searches to run.
 *
 * Not the cartesian product: eight filter dimensions with a handful of values
 * each is millions of specs, almost all of them redundant. Instead:
 *
 *   SINGLE      every implemented filter × representative, boundary, sentinel
 *               and zero-match values
 *   MULTI_VALUE several values inside one filter (skills AND, tracks OR)
 *   PAIR        every pair of dimensions × two representative values each
 *   TRIPLE      the high-risk three-way combinations recruiters actually use
 *   COMPLEX     a greedy strength-2 covering array with 5+ filters per spec
 *   RANDOM      seeded, reproducible 3–6 filter specs
 *
 * Values come from the live population (top claimed skills, top preferred
 * cities), so the searches are ones real candidates can answer.
 *
 * PURE.
 */
import type { AppliedFilter, FilterValue } from "@/features/search-qa/filter-registry";
import type { CaseKind, SpecCase } from "@/features/search-qa/compare";

export type ValueStats = {
  /** Most-claimed skill names among eligible candidates, most common first. */
  skills: string[];
  /** Most-stated preferred cities, most common first. */
  cities: string[];
  /** Enabled tracks with at least one loaded candidate. */
  tracks: string[];
};

/** Tokens that exercise the documented matcher edge cases. */
export const SEARCH_TEXT_TOKENS = [
  "react",
  "REACT",
  "React.js",
  "reactjs",
  "node",
  "Node.js",
  "nextjs",
  "Next.js",
  "c++",
  "C#",
  "machine learning",
  "golang",
  "k8s",
  "UI/UX",
  "java",
  "sql",
  "qa-zero-match-skill",
] as const;

/** Deterministic PRNG (mulberry32) — the same seed always yields the same specs. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dimension = { id: string; values: FilterValue[] };

function dimensions(stats: ValueStats): Dimension[] {
  const skills = stats.skills.length ? stats.skills : ["Python", "React"];
  const cities = stats.cities.length ? stats.cities : ["Bengaluru", "Delhi"];
  return [
    { id: "mustHaveStack", values: [[skills[0]!], [skills[1] ?? skills[0]!]] },
    { id: "workMode", values: ["REMOTE", "HYBRID"] },
    { id: "locationCity", values: [cities[0]!, cities[1] ?? "Bengaluru"] },
    { id: "employmentType", values: ["FULL_TIME", "INTERNSHIP"] },
    { id: "openToWork", values: [true] },
    { id: "salaryMax", values: [1_000_000, 300_000] },
    { id: "noticePeriodDays", values: [30, 90] },
  ];
}

let counter = 0;
function mk(
  kind: CaseKind,
  filters: AppliedFilter[],
  extra: Partial<Pick<SpecCase, "tracks" | "minEvidenceDays" | "rankOnly" | "criticality">> = {},
): SpecCase {
  counter += 1;
  return {
    id: `${kind.toLowerCase()}-${String(counter).padStart(3, "0")}`,
    kind,
    filters,
    tracks: extra.tracks ?? [],
    minEvidenceDays: extra.minEvidenceDays ?? 0,
    rankOnly: extra.rankOnly,
    criticality: extra.criticality ?? "SECONDARY",
  };
}

export type CaseOptions = {
  seed?: number;
  randomCount?: number;
  /** Lite mode (admin page): singles and named pairs only. */
  lite?: boolean;
};

export function buildCases(stats: ValueStats, opts: CaseOptions = {}): SpecCase[] {
  counter = 0;
  const out: SpecCase[] = [];
  const skills = stats.skills.length ? stats.skills : ["Python", "React", "JavaScript"];
  const cities = stats.cities.length ? stats.cities : ["Bengaluru", "Delhi"];
  const core = { criticality: "CORE" as const };

  /* SINGLE */
  out.push(mk("SINGLE", [], core));
  for (const s of skills.slice(0, 5)) out.push(mk("SINGLE", [{ id: "mustHaveStack", value: [s] }], core));
  for (const t of opts.lite ? SEARCH_TEXT_TOKENS.slice(0, 6) : SEARCH_TEXT_TOKENS) {
    out.push(mk("BOUNDARY", [{ id: "mustHaveStack", value: [t] }]));
  }
  for (const w of ["REMOTE", "HYBRID", "ONSITE", "FLEXIBLE"]) out.push(mk("SINGLE", [{ id: "workMode", value: w }], core));
  for (const c of [...cities.slice(0, 3), "Bengaluru", "Bangalore", "Delhi"]) {
    out.push(mk("SINGLE", [{ id: "locationCity", value: c }], core));
  }
  out.push(mk("BOUNDARY", [{ id: "locationCity", value: "Any" }]));
  out.push(mk("BOUNDARY", [{ id: "locationCity", value: "Atlantis" }]));
  for (const e of ["FULL_TIME", "INTERNSHIP", "PART_TIME", "CONTRACT", "FREELANCE"]) {
    out.push(mk("SINGLE", [{ id: "employmentType", value: e }], core));
  }
  out.push(mk("SINGLE", [{ id: "openToWork", value: true }], core));
  for (const b of [0, 300_000, 1_000_000]) out.push(mk(b === 0 ? "BOUNDARY" : "SINGLE", [{ id: "salaryMax", value: b }]));
  for (const n of [0, 30, 180]) out.push(mk(n === 30 ? "SINGLE" : "BOUNDARY", [{ id: "noticePeriodDays", value: n }]));
  for (const t of stats.tracks) out.push(mk("SINGLE", [], { tracks: [t], criticality: "CORE" }));
  for (const d of [10, 30, 60]) out.push(mk(d === 30 ? "SINGLE" : "BOUNDARY", [], { minEvidenceDays: d }));

  /* MULTI_VALUE */
  if (skills.length >= 2) out.push(mk("MULTI_VALUE", [{ id: "mustHaveStack", value: skills.slice(0, 2) }], core));
  if (skills.length >= 3) out.push(mk("MULTI_VALUE", [{ id: "mustHaveStack", value: skills.slice(0, 3) }]));
  if (stats.tracks.length >= 2) out.push(mk("MULTI_VALUE", [], { tracks: stats.tracks.slice(0, 2) }));

  /* PAIR — the named, high-traffic ones first */
  const s0 = [skills[0]!];
  const named: [AppliedFilter[], Partial<Pick<SpecCase, "tracks" | "rankOnly">>][] = [
    [[{ id: "mustHaveStack", value: s0 }, { id: "locationCity", value: cities[0]! }], {}],
    [[{ id: "mustHaveStack", value: s0 }, { id: "workMode", value: "REMOTE" }], {}],
    [[{ id: "mustHaveStack", value: s0 }, { id: "employmentType", value: "INTERNSHIP" }], {}],
    [[{ id: "mustHaveStack", value: s0 }, { id: "openToWork", value: true }], {}],
    [[{ id: "mustHaveStack", value: s0 }], { rankOnly: [{ id: "experience", value: ["0", "2"] }] }],
    [[{ id: "mustHaveStack", value: s0 }], { tracks: ["HACKATHON"] }],
    [[{ id: "mustHaveStack", value: s0 }], { tracks: ["PROGRAM"] }],
    [[{ id: "locationCity", value: cities[0]! }], { rankOnly: [{ id: "experience", value: ["2", "5"] }] }],
    [[{ id: "locationCity", value: cities[0]! }, { id: "workMode", value: "HYBRID" }], {}],
  ];
  for (const [filters, extra] of named) out.push(mk("PAIR", filters, { ...extra, criticality: "CORE" }));
  if (opts.lite) return out;

  const dims = dimensions(stats);
  for (let i = 0; i < dims.length; i++) {
    for (let j = i + 1; j < dims.length; j++) {
      for (const a of dims[i]!.values) {
        for (const b of dims[j]!.values) {
          out.push(mk("PAIR", [{ id: dims[i]!.id, value: a }, { id: dims[j]!.id, value: b }]));
        }
      }
    }
  }

  /* TRIPLE */
  out.push(mk("TRIPLE", [
    { id: "mustHaveStack", value: s0 },
    { id: "locationCity", value: cities[0]! },
    { id: "employmentType", value: "FULL_TIME" },
  ], core));
  out.push(mk("TRIPLE", [{ id: "mustHaveStack", value: s0 }, { id: "workMode", value: "REMOTE" }], {
    rankOnly: [{ id: "experience", value: ["1", "3"] }], criticality: "CORE",
  }));
  out.push(mk("TRIPLE", [{ id: "mustHaveStack", value: s0 }, { id: "locationCity", value: cities[0]! }], {
    rankOnly: [{ id: "experience", value: ["0", "2"] }], tracks: ["PROFILE", "HACKATHON"], criticality: "CORE",
  }));

  /* COMPLEX — greedy strength-2 covering array over the dimensions */
  for (const row of coveringRows(dims)) {
    out.push(mk("COMPLEX", row, { rankOnly: [{ id: "seniority", value: "JUNIOR" }, { id: "niceToHaveStack", value: [skills[2] ?? "Git"] }] }));
  }

  /* RANDOM */
  const rand = seeded(opts.seed ?? 20260915);
  for (let n = 0; n < (opts.randomCount ?? 30); n++) {
    const chosen = [...dims].sort(() => rand() - 0.5).slice(0, 3 + Math.floor(rand() * 4));
    const filters = chosen.map((d) => ({ id: d.id, value: d.values[Math.floor(rand() * d.values.length)]! }));
    const tracks = rand() < 0.25 && stats.tracks.length ? [stats.tracks[Math.floor(rand() * stats.tracks.length)]!] : [];
    out.push(mk("RANDOM", filters, { tracks }));
  }
  return out;
}

/** Rows of (dimension=value) that together cover every value pair across dimensions. */
function coveringRows(dims: Dimension[]): AppliedFilter[][] {
  const uncovered = new Set<string>();
  const key = (i: number, a: number, j: number, b: number) => `${i}:${a}|${j}:${b}`;
  for (let i = 0; i < dims.length; i++) {
    for (let j = i + 1; j < dims.length; j++) {
      dims[i]!.values.forEach((_, a) => dims[j]!.values.forEach((__, b) => uncovered.add(key(i, a, j, b))));
    }
  }
  const rows: AppliedFilter[][] = [];
  while (uncovered.size > 0 && rows.length < 40) {
    const pick: number[] = dims.map(() => 0);
    for (let i = 0; i < dims.length; i++) {
      let best = 0;
      let bestGain = -1;
      dims[i]!.values.forEach((_, a) => {
        let gain = 0;
        for (let j = 0; j < i; j++) if (uncovered.has(key(j, pick[j]!, i, a))) gain++;
        for (let j = i + 1; j < dims.length; j++) {
          for (let b = 0; b < dims[j]!.values.length; b++) if (uncovered.has(key(i, a, j, b))) { gain++; break; }
        }
        if (gain > bestGain) { bestGain = gain; best = a; }
      });
      pick[i] = best;
    }
    const covers = () => {
      let n = 0;
      for (let i = 0; i < dims.length; i++) {
        for (let j = i + 1; j < dims.length; j++) {
          if (uncovered.has(key(i, pick[i]!, j, pick[j]!))) n++;
        }
      }
      return n;
    };
    if (covers() === 0) {
      // Greedy stalled: seed the row from the first pair still uncovered.
      const [left, right] = [...uncovered][0]!.split("|");
      const [i, a] = left!.split(":").map(Number);
      const [j, b] = right!.split(":").map(Number);
      pick[i!] = a!;
      pick[j!] = b!;
    }
    for (let i = 0; i < dims.length; i++) {
      for (let j = i + 1; j < dims.length; j++) {
        uncovered.delete(key(i, pick[i]!, j, pick[j]!));
      }
    }
    rows.push(dims.map((d, i) => ({ id: d.id, value: d.values[pick[i]!]! })));
  }
  return rows;
}
