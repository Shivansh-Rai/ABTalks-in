/**
 * Text comparison for entity matching and bullet de-duplication.
 *
 * Everything here is token-based rather than character-based. Character edit
 * distance says "Acme Labs" and "Acme Labz" are nearly identical AND says
 * "Backend Engineer" and "Frontend Engineer" are too — which is exactly the
 * wrong answer for deciding whether two rows are the same job. Comparing sets
 * of meaningful words keeps "Backend" and "Frontend" apart while still seeing
 * through word order, punctuation and corporate suffixes.
 *
 * Pure and dependency-free.
 */

/**
 * Words that carry no identity. Dropping them lets "Acme Labs Pvt. Ltd." and
 * "Acme Labs" match, and stops "The" or "and" from inflating a similarity
 * score between two otherwise unrelated names.
 */
const NOISE = new Set([
  "the", "a", "an", "and", "of", "at", "in", "for", "to", "with", "on",
  "inc", "llc", "ltd", "limited", "pvt", "private", "plc", "gmbh", "corp",
  "corporation", "co", "company", "technologies", "technology", "tech",
  "solutions", "systems", "labs", "lab", "group", "holdings", "services",
  "university", "college", "institute", "school", "of",
]);

export function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Identity tokens: noise words removed, duplicates collapsed. */
export function identityTokens(value: string): Set<string> {
  const kept = tokens(value).filter((t) => !NOISE.has(t));
  // A name made entirely of noise ("The Company") still has to match itself.
  return new Set(kept.length > 0 ? kept : tokens(value));
}

/**
 * Overlap of two token sets, 0-1, normalised by the SMALLER set.
 *
 * Smaller rather than the union on purpose: "Backend Engineer" against
 * "Senior Backend Engineer, Platform" should read as a strong match, and
 * dividing by the union would punish the longer title for carrying more words.
 */
export function tokenOverlap(a: string, b: string): number {
  const setA = identityTokens(a);
  const setB = identityTokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const t of setA) if (setB.has(t)) shared++;
  return shared / Math.min(setA.size, setB.size);
}

/** Same organisation, institution or project by name. */
export function sameName(a: string | null, b: string | null, threshold = 0.8): boolean {
  if (!a || !b) return false;
  const ta = identityTokens(a);
  const tb = identityTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  return tokenOverlap(a, b) >= threshold;
}

/* ─── Bullets ────────────────────────────────────────────────────────────── */

/**
 * Splits a stored description back into bullet lines.
 *
 * Descriptions written by this feature use "• " prefixes; ones typed by a
 * candidate may use "-", "*", numbers, or plain newlines. All of them split the
 * same way, because a bullet the candidate typed must be recognised as already
 * present when the résumé offers it again.
 */
export function splitBullets(description: string | null): string[] {
  if (!description) return [];
  return description
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:[•\-*–—]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0);
}

export function joinBullets(bullets: readonly string[]): string | null {
  if (bullets.length === 0) return null;
  return bullets.map((b) => `• ${b}`).join("\n");
}

/**
 * Turns a prose block into bullet lines: line breaks and bullet markers first,
 * then sentence boundaries. A boundary needs a space and a capital after the
 * stop, so "Node.js", "v2.1" and "99.9%" stay whole; "e.g." and "i.e." are
 * never treated as the end of a sentence.
 */
export function proseToBullets(text: string | null): string[] {
  if (!text) return [];
  return splitBullets(text)
    .flatMap((line) => line.split(/\s+[•▪●]\s+/))
    .flatMap((line) =>
      line.split(/(?<!\b(?:e\.g|i\.e|etc|vs|approx|incl|Mr|Ms|Dr|St)\.)(?<=[.!?])\s+(?=[A-Z])/),
    )
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * `joinBullets`, dropping trailing bullets until the block fits `maxChars` —
 * whole points are dropped rather than one being cut mid-sentence.
 */
export function joinBulletsWithin(
  bullets: readonly string[],
  maxChars: number,
): string | null {
  const kept = [...bullets];
  let joined = joinBullets(kept);
  while (joined !== null && joined.length > maxChars && kept.length > 1) {
    kept.pop();
    joined = joinBullets(kept);
  }
  return joined !== null && joined.length > maxChars
    ? joined.slice(0, maxChars)
    : joined;
}

/**
 * Two bullets say the same thing.
 *
 * The bar is high (0.85 of the shorter bullet's meaningful words) because the
 * cost is asymmetric: a false match silently drops a real achievement, while a
 * missed match leaves a near-duplicate line the candidate can delete in a
 * second.
 */
export function sameBullet(a: string, b: string): boolean {
  const na = tokens(a).join(" ");
  const nb = tokens(b).join(" ");
  if (na.length === 0 || nb.length === 0) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return tokenOverlap(a, b) >= 0.85;
}

/**
 * Existing bullets, then any incoming bullet that is genuinely new.
 *
 * Existing lines keep their position and their exact wording — the candidate
 * wrote them.
 */
export function mergeBullets(
  existing: readonly string[],
  incoming: readonly string[],
  max = 12,
): { merged: string[]; added: number } {
  const merged = [...existing];
  let added = 0;
  for (const bullet of incoming) {
    const text = bullet.trim();
    if (text.length === 0) continue;
    if (merged.length >= max) break;
    if (merged.some((e) => sameBullet(e, text))) continue;
    merged.push(text);
    added++;
  }
  return { merged, added };
}
