/**
 * T-254 UTM helper tests.
 *   npx tsx src/lib/utm.test.ts
 */
import {
  parseCookie,
  readUtm,
  serialiseCookie,
  toColumns,
  UTM_MAX_LEN,
} from "./utm";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

console.log("utm.test.ts (T-254)");

suite("readUtm picks up all five keys from URLSearchParams", () => {
  const p = new URLSearchParams(
    "utm_source=linkedin&utm_medium=cpc&utm_campaign=demo2&utm_term=hire&utm_content=cta",
  );
  const v = readUtm(p);
  assert(v?.utm_source === "linkedin", "source");
  assert(v?.utm_medium === "cpc", "medium");
  assert(v?.utm_campaign === "demo2", "campaign");
  assert(v?.utm_term === "hire", "term");
  assert(v?.utm_content === "cta", "content");
});

suite("readUtm returns undefined when no key is set", () => {
  const v = readUtm(new URLSearchParams("foo=bar"));
  assert(v === undefined, `expected undefined, got ${JSON.stringify(v)}`);
});

suite("readUtm trims whitespace and drops empty values", () => {
  const p = new URLSearchParams("utm_source=  &utm_medium=   cpc   ");
  const v = readUtm(p);
  assert(v?.utm_source === undefined, "empty dropped");
  assert(v?.utm_medium === "cpc", "trimmed value");
});

suite("readUtm clamps at UTM_MAX_LEN", () => {
  const long = "a".repeat(UTM_MAX_LEN + 50);
  const p = new URLSearchParams(`utm_campaign=${long}`);
  const v = readUtm(p);
  assert(v?.utm_campaign?.length === UTM_MAX_LEN, `clamped to ${v?.utm_campaign?.length}`);
});

suite("readUtm accepts a plain record", () => {
  const v = readUtm({ utm_source: "email", utm_medium: "newsletter" });
  assert(v?.utm_source === "email", "source from record");
});

suite("toColumns returns all five columns, nulls for missing", () => {
  const c = toColumns({ utm_source: "google" });
  assert(c.utmSource === "google", "source column");
  assert(c.utmMedium === null, "medium is null");
  assert(c.utmCampaign === null, "campaign is null");
  assert(c.utmTerm === null, "term is null");
  assert(c.utmContent === null, "content is null");
});

suite("toColumns with undefined values produces all-null columns", () => {
  const c = toColumns(undefined);
  assert(c.utmSource === null, "all null");
  assert(c.utmMedium === null, "all null");
});

suite("serialiseCookie / parseCookie round-trip preserves values", () => {
  const at = new Date("2026-09-14T10:00:00Z");
  const raw = serialiseCookie(
    { utm_source: "linkedin", utm_campaign: "demo2" },
    at,
  );
  const parsed = parseCookie(raw);
  assert(parsed?.at === at.toISOString(), "timestamp preserved");
  assert(parsed?.v.utm_source === "linkedin", "source preserved");
  assert(parsed?.v.utm_campaign === "demo2", "campaign preserved");
  assert(parsed?.v.utm_medium === undefined, "unset stays undefined");
});

suite("parseCookie returns null on garbage input", () => {
  assert(parseCookie(null) === null, "null → null");
  assert(parseCookie("") === null, "empty → null");
  assert(parseCookie("{}") === null, "shape missing keys → null");
  assert(parseCookie("not json") === null, "not json → null");
  assert(parseCookie('{"v":{},"at":123}') === null, "wrong at type → null");
});

suite("parseCookie sanitises values from a tampered cookie", () => {
  const parsed = parseCookie(
    JSON.stringify({
      v: { utm_source: "x".repeat(UTM_MAX_LEN + 500) },
      at: "2026-09-14T10:00:00Z",
    }),
  );
  assert(
    parsed?.v.utm_source?.length === UTM_MAX_LEN,
    "clamped on parse",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
